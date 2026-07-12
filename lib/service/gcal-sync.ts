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
  findEventBySalesptId,
  insertEvent,
  patchEvent,
  type GcalEventInput,
} from "@/repo/gcal-client";
import {
  clearGcalCell,
  keepOnlyMarkers,
  readGcalMap,
  readGcalStates,
  setGcalEventId,
  type GcalEventKind,
} from "@/repo/gcal-event-ids";
import { findById as findMeetingById } from "@/repo/meetings";
import { findById as findTodoById } from "@/repo/todos";
import { listAllMeetings, listAllTodos } from "@/repo/gcal-schedule-read";

/** gcal_event_ids 맵 값 = eventId(등록됨) | "-"(일정별 토글로 제외, gcal-2b) | 키없음(기본 ON). */
const EXCLUDE_MARKER = "-";

// ── 도메인 → 이벤트 매핑 ─────────────────────────────────────────

/** 시각 이벤트 시작·끝(기본 1시간). 자정 넘으면 end 날짜를 다음날로(end<start = 구글 400 방지). */
function timedRange(dateISO: string, hhmm: string): { start: string; end: string } {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  const endTotal = h * 60 + m + 60;
  const eh = String(Math.floor(endTotal / 60) % 24).padStart(2, "0");
  const em = String(endTotal % 60).padStart(2, "0");
  const endDate = endTotal >= 1440 ? nextDay(dateISO) : dateISO;
  return { start: `${dateISO}T${hhmm}:00`, end: `${endDate}T${eh}:${em}:00` };
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

/** 반환: true=실제 등록/갱신됨, false=skip(미연결·제외 마커). resyncAll 카운트 정확도용. */
async function upsert(
  email: string,
  spreadsheetId: string,
  kind: GcalEventKind,
  id: string,
  input: GcalEventInput,
): Promise<boolean> {
  const conn = await getGcalConnection(email);
  if (!conn.connected || !conn.refreshToken) return false; // 미연결 skip
  const calendarId = conn.settings.calendarId || "primary";
  const map = await readGcalMap(spreadsheetId, kind, id);
  if (map[email] === EXCLUDE_MARKER) return false; // 일정별 토글로 뺌 → 자동 등록 안 함(gcal-2b)
  // 맵에 내 키가 있으면 그 이벤트, 없으면 salesptId 로 구글 조회(저장 실패로 유실됐어도
  // 재삽입 전 기존 이벤트를 찾아 **중복 생성 방지** — insert-then-save 비원자성 보완).
  let eventId: string | null = map[email] ?? null;
  if (!eventId) eventId = await findEventBySalesptId(conn.refreshToken, calendarId, id);
  if (eventId) {
    const ok = await patchEvent(conn.refreshToken, calendarId, eventId, input);
    if (ok) {
      if (map[email] !== eventId) await setGcalEventId(spreadsheetId, kind, id, email, eventId);
      return true;
    }
    // patch 404(구글에서 삭제됨) → 아래로 떨어져 재삽입.
  }
  const newId = await insertEvent(conn.refreshToken, calendarId, input);
  await setGcalEventId(spreadsheetId, kind, id, email, newId);
  return true;
}

/**
 * 이 일정에 매핑된 **모든 연결 사용자**의 구글 이벤트 삭제 + 맵 셀 전체 폐기.
 * 멀티계정(부부·직원) 시트에서 타 사용자 이벤트가 고아로 남거나, 행 재사용이 stale 맵을
 * 상속해 타 사용자 이벤트를 덮어쓰는 사고를 방지. 각 사용자는 자기 토큰으로 삭제.
 */
async function removeAll(
  spreadsheetId: string,
  kind: GcalEventKind,
  id: string,
  preserveMarkers = false,
): Promise<void> {
  const map = await readGcalMap(spreadsheetId, kind, id);
  const entries = Object.entries(map).filter(([, ev]) => ev && ev !== EXCLUDE_MARKER);
  for (const [userEmail, eventId] of entries) {
    const conn = await getGcalConnection(userEmail);
    if (conn.connected && conn.refreshToken) {
      await deleteEvent(conn.refreshToken, conn.settings.calendarId || "primary", eventId);
    }
  }
  // 셀 정리 — 되돌릴 수 있는 전이(취소·숨김)=마커 보존(실제 이벤트 지웠을 때만 재기록) /
  // 행 삭제(비가역)=마커 포함 전체 비움(빈 셀은 skip). 행 삭제 시 "-" 잔존→행 재사용 오염 방지.
  if (preserveMarkers) {
    if (entries.length) await keepOnlyMarkers(spreadsheetId, kind, id);
  } else if (Object.keys(map).length) {
    await clearGcalCell(spreadsheetId, kind, id);
  }
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
    if (m.상태 === "취소") await removeAll(spreadsheetId, "meeting", m.id, true);
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
      await removeAll(spreadsheetId, "meeting", id, true); // 취소=이벤트 삭제, 제외 마커는 보존
      return;
    }
    const input = meetingToInput(m);
    if (input) await upsert(email, spreadsheetId, "meeting", id, input);
  }, `meeting-change ${id}`);
}

/** 미팅 삭제 — 행 클리어 **전** await(맵 read 후 전 사용자 이벤트 삭제). non-throwing. */
export async function syncMeetingRemoved(
  spreadsheetId: string,
  id: string,
): Promise<void> {
  await guard(() => removeAll(spreadsheetId, "meeting", id), `meeting-remove ${id}`);
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

/** 투두/일반이벤트 수정 직후(reconcile) — fire-and-forget(시트 정본 경로용). */
export function onTodoChanged(
  email: string,
  spreadsheetId: string,
  id: string,
  known?: Todo,
): void {
  void reconcileTodoEvent(email, spreadsheetId, id, known);
}

/** R3-2: **awaitable** reconcile — 수렴 동기화 잡이 await 해서 gcal 작업을 미러 큐 직렬화 안에
 * 가둔다(fire-and-forget 으로 큐를 탈출하면 삭제 잡의 맵 읽기와 경합 → 이벤트ID 미기록 고아 이벤트).
 * `known` 전달 시 그 값으로 reconcile(재조회 생략 — DB 정본 경로는 시트 재조회가 stale 레이스).
 * guard 내장 = non-throwing. */
export async function reconcileTodoEvent(
  email: string,
  spreadsheetId: string,
  id: string,
  known?: Todo,
): Promise<void> {
  await guard(async () => {
    const t = known ?? (await findTodoById(spreadsheetId, id));
    if (!t) {
      await removeAll(spreadsheetId, "todo", id, true);
      return;
    }
    const input = todoToInput(t);
    if (input) await upsert(email, spreadsheetId, "todo", id, input);
    else await removeAll(spreadsheetId, "todo", id, true); // 예정일 제거/숨김 → 삭제(마커 보존)
  }, `todo-change ${id}`);
}

/** 투두/일반이벤트 삭제 — 행 클리어 **전** await(전 사용자 이벤트 삭제). non-throwing. */
export async function syncTodoRemoved(
  spreadsheetId: string,
  id: string,
): Promise<void> {
  await guard(() => removeAll(spreadsheetId, "todo", id), `todo-remove ${id}`);
}

// ── gcal-2b: 일정별 개별 토글 / [다시 올리기] ──────────────────────

/** 이 사용자 이벤트만 삭제(토글 OFF 용) — 타 사용자·마커 무접촉. */
async function removeOne(
  email: string,
  spreadsheetId: string,
  kind: GcalEventKind,
  id: string,
): Promise<void> {
  const conn = await getGcalConnection(email);
  if (!conn.connected || !conn.refreshToken) return;
  const map = await readGcalMap(spreadsheetId, kind, id);
  const eventId = map[email];
  if (eventId && eventId !== EXCLUDE_MARKER) {
    await deleteEvent(conn.refreshToken, conn.settings.calendarId || "primary", eventId);
  }
}

/**
 * 일정별 개별 토글. on=true → 제외 마커 해제 + 재등록 / on=false → 이벤트 삭제 + 제외 마커.
 * 미연결이면 {connected:false}(라우트가 "먼저 연결" 안내). 결과 반영까지 await(토스트 정확).
 */
export async function toggleSchedule(
  email: string,
  spreadsheetId: string,
  kind: GcalEventKind,
  id: string,
  on: boolean,
): Promise<{ connected: boolean }> {
  const conn = await getGcalConnection(email);
  if (!conn.connected || !conn.refreshToken) return { connected: false };
  if (on) {
    await setGcalEventId(spreadsheetId, kind, id, email, null); // 제외 마커 해제(기본 ON)
    let input: GcalEventInput | null = null;
    if (kind === "meeting") {
      const m = await findMeetingById(spreadsheetId, id);
      if (m && m.상태 !== "취소") input = meetingToInput(m);
    } else {
      const t = await findTodoById(spreadsheetId, id);
      if (t) input = todoToInput(t);
    }
    if (input) await upsert(email, spreadsheetId, kind, id, input);
  } else {
    await removeOne(email, spreadsheetId, kind, id);
    await setGcalEventId(spreadsheetId, kind, id, email, EXCLUDE_MARKER); // 제외 마커
  }
  return { connected: true };
}

/**
 * [다시 올리기] — 제외(토글 OFF) 안 한 전체 일정을 멱등 재푸시. 제외 항목은 배치 상태조회로
 * 미리 걸러 불필요한 per-item 조회를 줄이고, 실제 등록/갱신된 건수만 센다.
 * (ON 항목은 upsert 가 per-item 시트조회 — 수동 저빈도 버튼이라 Sheets 클라이언트 backoff 로 흡수.)
 */
export async function resyncAll(
  email: string,
  spreadsheetId: string,
): Promise<{ connected: boolean; pushed: number }> {
  const conn = await getGcalConnection(email);
  if (!conn.connected || !conn.refreshToken) return { connected: false, pushed: 0 };
  let pushed = 0;

  const meetings = (await listAllMeetings(spreadsheetId)).filter((m) => m.상태 !== "취소");
  const mOn = await readGcalStates(spreadsheetId, "meeting", meetings.map((m) => m.id), email);
  for (const m of meetings) {
    if (!mOn[m.id]) continue; // 제외(토글 OFF) skip
    const input = meetingToInput(m);
    if (!input) continue;
    try {
      if (await upsert(email, spreadsheetId, "meeting", m.id, input)) pushed++;
    } catch (e) {
      console.warn(`[gcal-sync] resync-meeting ${m.id} 실패:`, e instanceof Error ? e.message : e);
    }
  }

  const todos = await listAllTodos(spreadsheetId);
  const tOn = await readGcalStates(spreadsheetId, "todo", todos.map((t) => t.id), email);
  for (const t of todos) {
    if (!tOn[t.id]) continue;
    const input = todoToInput(t);
    if (!input) continue;
    try {
      if (await upsert(email, spreadsheetId, "todo", t.id, input)) pushed++;
    } catch (e) {
      console.warn(`[gcal-sync] resync-todo ${t.id} 실패:`, e instanceof Error ? e.message : e);
    }
  }
  return { connected: true, pushed };
}
