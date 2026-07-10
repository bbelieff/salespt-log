/**
 * Layer: service — 앱 일정 → 구글 캘린더 단방향 동기화 엔진 (gcal-2a, google-calendar-sync §3).
 *
 * 연결된 사용자만 대상(미연결 = getGcalConnection 1회 후 즉시 skip, cost≈0). 멱등: 일정 행의
 * gcal_event_ids 맵으로 insert/patch/delete 판정(§2). 생성/수정 훅은 fire-and-forget(앱 저장
 * 항상 성공, gcal 실패는 warn + 재시도 1회). 삭제 훅은 행 클리어 전 await(맵 read 레이스 방지).
 *
 * 스코프(gcal-2a): 미팅·투두·일반이벤트 생성/수정/삭제의 **직접 대상**. 자손 미팅 cascade 전파와
 * 일정별 개별 토글·[다시 올리기]는 gcal-2b. 기본 ON(맵에 키 없으면 자동 등록).
 */
import type { Meeting, Todo } from "@/types";
import { getGcalConnection } from "@/repo/gcal-token";
import {
  deleteEvent,
  insertEvent,
  patchEvent,
  type GcalEventInput,
} from "@/repo/gcal-client";
import {
  readGcalMap,
  setGcalEventId,
  type GcalEventKind,
} from "@/repo/gcal-event-ids";
import { findById as findMeetingById } from "@/repo/meetings";
import { findById as findTodoById } from "@/repo/todos";

// ── 도메인 → 이벤트 매핑 ─────────────────────────────────────────

/** 시각 이벤트 시작·끝(기본 1시간). */
function timedRange(dateISO: string, hhmm: string): { start: string; end: string } {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  const endTotal = h * 60 + m + 60;
  const eh = String(Math.floor(endTotal / 60) % 24).padStart(2, "0");
  const em = String(endTotal % 60).padStart(2, "0");
  return { start: `${dateISO}T${hhmm}:00`, end: `${dateISO}T${eh}:${em}:00` };
}

/** 종일 이벤트 end.date 는 exclusive → 다음날. */
function nextDay(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** 미팅 → 이벤트(대상 아니면 null). 제목=업체명 맨 앞(§2, prefix 금지). */
export function meetingToInput(m: Meeting): GcalEventInput | null {
  if (!m.미팅날짜) return null;
  const description =
    [m.미팅사유, m.예약비고].filter(Boolean).join(" / ") || "세일즈PT 경영일지";
  const base = {
    summary: `${m.업체명} 미팅`,
    location: m.장소 || undefined,
    description,
    salesptId: m.id,
  };
  if (m.미팅시간) {
    const { start, end } = timedRange(m.미팅날짜, m.미팅시간);
    return { ...base, start, end, allDay: false };
  }
  return { ...base, start: m.미팅날짜, end: nextDay(m.미팅날짜), allDay: true };
}

/** 투두/일반이벤트 → 이벤트(대상 아니면 null). 예정시각 없으면 종일(§2 QA #14/#16). */
export function todoToInput(t: Todo): GcalEventInput | null {
  if (!t.예정일자) return null; // 예정일 없으면 대상 아님
  if (!t.showOnCalendar) return null; // 앱 캘린더 숨김이면 구글도 제외
  const base = {
    summary: t.제목,
    location: t.장소 || undefined,
    description: t.상세 || undefined,
    salesptId: t.id,
  };
  if (t.예정시각) {
    const { start, end } = timedRange(t.예정일자, t.예정시각);
    return { ...base, start, end, allDay: false };
  }
  return { ...base, start: t.예정일자, end: nextDay(t.예정일자), allDay: true };
}

// ── 멱등 upsert / remove ─────────────────────────────────────────

async function upsert(
  email: string,
  spreadsheetId: string,
  kind: GcalEventKind,
  id: string,
  input: GcalEventInput,
): Promise<void> {
  const conn = await getGcalConnection(email);
  if (!conn.connected || !conn.refreshToken) return; // 미연결 skip
  const calendarId = conn.settings.calendarId || "primary";
  const map = await readGcalMap(spreadsheetId, kind, id);
  const existing = map[email];
  if (existing) {
    const ok = await patchEvent(conn.refreshToken, calendarId, existing, input);
    if (ok) return;
    // 구글에서 이미 삭제됨 → 아래로 떨어져 재삽입.
  }
  const eventId = await insertEvent(conn.refreshToken, calendarId, input);
  await setGcalEventId(spreadsheetId, kind, id, email, eventId);
}

async function remove(
  email: string,
  spreadsheetId: string,
  kind: GcalEventKind,
  id: string,
  preMap?: Record<string, string>,
): Promise<void> {
  const conn = await getGcalConnection(email);
  if (!conn.connected || !conn.refreshToken) return;
  const calendarId = conn.settings.calendarId || "primary";
  const map = preMap ?? (await readGcalMap(spreadsheetId, kind, id));
  const eventId = map[email];
  if (!eventId) return;
  await deleteEvent(conn.refreshToken, calendarId, eventId);
  // 행이 아직 있으면 키 제거(취소 등), 클리어됐으면 no-op(맵은 행과 함께 폐기).
  await setGcalEventId(spreadsheetId, kind, id, email, null);
}

/** 실패해도 앱 흐름 비차단 — 재시도 1회 후 warn(throw 안 함). */
async function guard(fn: () => Promise<void>, label: string): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await fn();
      return;
    } catch (e) {
      if (attempt === 1) {
        console.warn(
          `[gcal-sync] ${label} 동기화 실패(무시):`,
          e instanceof Error ? e.message : e,
        );
      }
    }
  }
}

// ── 훅 진입점 ────────────────────────────────────────────────────

/** 미팅 생성 직후(객체 보유) — fire-and-forget. 취소 상태면 삭제. */
export function onMeetingCreated(
  email: string,
  spreadsheetId: string,
  m: Meeting,
): void {
  void guard(async () => {
    if (m.상태 === "취소") await remove(email, spreadsheetId, "meeting", m.id);
    else {
      const input = meetingToInput(m);
      if (input) await upsert(email, spreadsheetId, "meeting", m.id, input);
    }
  }, `meeting-create ${m.id}`);
}

/** 미팅 수정/상태전이 직후(id로 재조회 reconcile) — fire-and-forget. */
export function onMeetingChanged(
  email: string,
  spreadsheetId: string,
  id: string,
): void {
  void guard(async () => {
    const m = await findMeetingById(spreadsheetId, id);
    if (!m || m.상태 === "취소") {
      await remove(email, spreadsheetId, "meeting", id);
      return;
    }
    const input = meetingToInput(m);
    if (input) await upsert(email, spreadsheetId, "meeting", id, input);
  }, `meeting-change ${id}`);
}

/** 미팅 삭제 — 행 클리어 **전** await(맵 read 후 이벤트 삭제). non-throwing. */
export async function syncMeetingRemoved(
  email: string,
  spreadsheetId: string,
  id: string,
): Promise<void> {
  await guard(
    () => remove(email, spreadsheetId, "meeting", id),
    `meeting-remove ${id}`,
  );
}

/** 투두/일반이벤트 생성 직후(객체 보유) — fire-and-forget. */
export function onTodoCreated(
  email: string,
  spreadsheetId: string,
  t: Todo,
): void {
  void guard(async () => {
    const input = todoToInput(t);
    if (input) await upsert(email, spreadsheetId, "todo", t.id, input);
  }, `todo-create ${t.id}`);
}

/** 투두/일반이벤트 수정 직후(id로 재조회 reconcile) — fire-and-forget. */
export function onTodoChanged(
  email: string,
  spreadsheetId: string,
  id: string,
): void {
  void guard(async () => {
    const t = await findTodoById(spreadsheetId, id);
    if (!t) {
      await remove(email, spreadsheetId, "todo", id);
      return;
    }
    const input = todoToInput(t);
    if (input) await upsert(email, spreadsheetId, "todo", id, input);
    else await remove(email, spreadsheetId, "todo", id); // 예정일 제거/숨김 → 있으면 삭제
  }, `todo-change ${id}`);
}

/** 투두/일반이벤트 삭제 — 행 클리어 **전** await. non-throwing. */
export async function syncTodoRemoved(
  email: string,
  spreadsheetId: string,
  id: string,
): Promise<void> {
  await guard(
    () => remove(email, spreadsheetId, "todo", id),
    `todo-remove ${id}`,
  );
}
