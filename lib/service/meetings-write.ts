/**
 * Layer: service — 04 미팅 쓰기·소스드 읽기 프리미티브 (R3-2 PR-2, db-write-flip §2·§6).
 *
 * 파일럿 기수({8,9,연습}∪arena) = **DB 동기 정본**(실패=throw·시트폴백 금지) + 시트 수렴 동기화.
 * 비파일럿·DATABASE_URL 미설정 = R2 바이트 동일(시트 정본 + repo 내 비동기 DB 미러 + 즉시 gcal 훅).
 * 롤백 = chooseWriteSource 한 곳. contact.ts(500줄 캡)·contract-payment.ts 는 repo 직접 호출을
 * 이 프리미티브로 1:1 치환만 한다 — 게이트·gcal·큐 로직은 전부 여기.
 *
 * 시트 미러 = 연산 재생이 아닌 **수렴 동기화**(PR-1 todos 패턴): 시트별 직렬 큐의 잡이 실행 시점
 * **최신 DB 상태**를 읽어 시트를 update-or-append/clear 로 수렴 — 생성↔삭제 역전·append 재시도
 * 중복·미러 순서 역전이 자기수정. gcal 이벤트ID 맵은 시트 행(AT)에 있으므로 reconcile 은 잡 안
 * **행 보장 후 await**(탈출 시 삭제 잡과 경합 → 지울 수 없는 고아 이벤트).
 *
 * 쓰기 플로우 내부 read(병합기반·cascade 탐색)는 파일럿에서 DB 실패 시 **throw** — 시트 silent
 * fallback 은 정본 이원화(§0)라 금지. 표면 read(loadDay 등)의 기존 fallback 은 각자 파일 소관.
 */
import * as Sentry from "@sentry/nextjs";
import {
  appendMeeting,
  clearMeeting,
  findByDate,
  findById,
  findByPreviousMeetingId,
  updateMeeting,
  upsertMeetingRowSnapshot,
} from "@/repo/meetings";
import { upsertCarriedRawSnapshot } from "@/repo/carryover";
import { chooseWriteSource } from "./daily-source";
import { clearRowInDb, dbEnabled, writeRowToDb } from "@/repo/db/client";
import {
  clearMirrorPending,
  listMirrorPending,
  markMirrorPending,
} from "@/repo/db/mirror-pending";
import {
  readMeetingRowStateFromDb,
  readMeetingsFromDb,
} from "@/repo/db/read-daily";
import { captureServerEvent } from "@/lib/analytics/api-timing";
import {
  onMeetingCreated,
  reconcileMeetingEvent,
  syncMeetingRemoved,
} from "@/service/gcal-sync";
import { Meeting } from "@/types";

/** 프리미티브 공통 컨텍스트 — 호출 서비스가 resolve 해 전달(추가 레지스트리 read 방지). */
export interface MeetingCtx {
  spreadsheetId: string;
  cohort: string;
  email: string;
}

function isDb(ctx: MeetingCtx): boolean {
  return chooseWriteSource(ctx.cohort, dbEnabled()) === "db";
}

// ── 시트 수렴 동기화 (DB 정본 경로 전용) ──────────────────────────

/** 시트별 미러 잡 직렬화 — append 슬롯 경합·행별 순서 역전 방지 (프로세스 내). */
const sheetSyncTails = new Map<string, Promise<void>>();

/** DB 쓰기 성공 후 호출 — 해당 미팅 행을 최신 DB 상태로 시트에 수렴시키는 잡을 적재.
 * 잡 끝에 같은 시트의 다른 pending 행도 재드라이브(§7-3 self-heal). */
export function queueMeetingSheetSync(ctx: MeetingCtx, id: string): void {
  const key = ctx.spreadsheetId;
  const tail = (sheetSyncTails.get(key) ?? Promise.resolve())
    .then(() => runSheetSync(ctx, id))
    .then(() => drainPendingMeetingSheet(ctx, id))
    .catch(() => {}); // runSheetSync 가 Sentry 계수 — 큐는 항상 전진
  sheetSyncTails.set(key, tail);
  void tail.finally(() => {
    if (sheetSyncTails.get(key) === tail) sheetSyncTails.delete(key);
  });
}

/** 1행 수렴 동기화 — 최신 DB 상태 기준. 선형 백오프 3회.
 * 성공(무예외 완료) → mirror_pending 해제. 최종 실패 → mirror_pending 마킹 + Sentry 계수(§2.2·§7-3). */
async function runSheetSync(ctx: MeetingCtx, id: string): Promise<void> {
  const ref = { spreadsheetId: ctx.spreadsheetId, tab: "meetings" as const, rowKey: id };
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await syncMeetingRowToSheet(ctx, id);
      await clearMirrorPending(ref).catch(() => {});
      return;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 300 * attempt));
    }
  }
  await markMirrorPending(ref).catch(() => {});
  Sentry.captureException(lastErr, { tags: { where: "meeting-sheet-sync" } });
  captureServerEvent("sheet_mirror_error", { tab: "meetings" });
}

/** 1회 시트 반영(최신 DB 상태) — 실패 시 throw(runSheetSync 가 재시도·표식 관리). */
async function syncMeetingRowToSheet(ctx: MeetingCtx, id: string): Promise<void> {
  const state = await readMeetingRowStateFromDb(ctx.spreadsheetId, id);
  if (!state) return; // DB 에 행 자체가 없음 — 동기화할 정본 없음
  if (state.cleared) {
    // 이벤트 삭제(맵은 행 AT 에 있으므로 클리어 전) → 행 클리어(없으면 no-op). 멱등.
    await syncMeetingRemoved(ctx.spreadsheetId, id);
    await clearMeeting(ctx.spreadsheetId, id, { mirror: false });
    return;
  }
  if (state.meeting) {
    await upsertMeetingRowSnapshot(ctx.spreadsheetId, state.meeting);
    // 이월(구분=이월) 행은 gcal 비대상(carryRaw 분기와 동일 의미론) — 옛 기수 이벤트가
    // 읽기전용 시트에 잔존하는데 새 아레나 id 로 insert 하면 같은 미팅이 캘린더에 중복 생성됨
    // (적대리뷰). 이월이 아닐 때만 reconcile. 행 보장 후 await 로 큐 직렬화 안에 가둠(non-throwing).
    if (state.meeting.구분 !== "이월") {
      await reconcileMeetingEvent(ctx.email, ctx.spreadsheetId, id, state.meeting);
    }
    return;
  }
  if (state.carryRaw) {
    // 구형 이월 payload — Meeting 복원 불가, raw split write 로 수렴(gcal 비대상: 이월 행 동일 의미론).
    await upsertCarriedRawSnapshot(
      ctx.spreadsheetId,
      { 원본id: state.carryRaw.원본id, raw: state.carryRaw.raw },
      id,
    );
    return;
  }
  // 파싱 불가 payload — 시트 반영 불가(정본 DB 는 그대로, 읽기도 DB)
}

/** self-heal: 같은 시트의 밀린(mirror_pending) 미팅 행을 재드라이브. 1회 최대 25행. 큐 직렬화 안 순차. */
async function drainPendingMeetingSheet(ctx: MeetingCtx, justSyncedId: string): Promise<void> {
  if (!dbEnabled()) return;
  const keys = await listMirrorPending(ctx.spreadsheetId, "meetings", 25).catch(() => []);
  for (const key of keys) {
    if (key === justSyncedId) continue;
    await runSheetSync(ctx, key);
  }
}

// ── 쓰기 프리미티브 ────────────────────────────────────────────

/** 미팅 생성 — 파일럿: DB 동기 저장 → 시트/gcal 은 수렴 잡. 비파일럿: R2 그대로. */
export async function createMeetingRecord(
  ctx: MeetingCtx,
  meeting: Meeting,
): Promise<void> {
  const m = await withInheritedLeadLink(ctx, Meeting.parse(meeting));
  if (isDb(ctx)) {
    await writeRowToDb({ ...ctx, tab: "meetings", rowKey: m.id, payload: m });
    queueMeetingSheetSync(ctx, m.id); // 시트 반영 + (행 보장 후) gcal 등록
    return;
  }
  await appendMeeting(ctx.spreadsheetId, m);
  onMeetingCreated(ctx.email, ctx.spreadsheetId, m); // gcal 자동 등록(fire-and-forget)
}

/** 발굴 링크 승계 — 리스케줄·추가미팅은 **새 행(새 id)** 이라 계보(previousMeetingId)로 원본의
 * `발굴id` 를 이어받지 않으면, 매칭됐던 발굴이 일정 변경 한 번에 피커로 **부활**한다(이월 스펙 위반,
 * lead-chain §4-5). 클라이언트가 이미 실어보냈으면(폼 spread) 그대로 두고, **부재 시에만** 1회 조회.
 * 원본 read 실패는 무시(승계 없이 진행) — 최악은 dangling(안전 실패), 저장을 막지 않는다.
 * **비파일럿은 스킵** — 발굴id 는 DB payload 전용(시트 컬럼 0)이라 시트 원본은 발굴id 를 실을 수 없어
 * 승계가 구조적 no-op. 비파일럿 생성 경로에 무의미한 시트 read 를 더하지 않는다(R2 불변 보존, PR-6 리뷰). */
async function withInheritedLeadLink(ctx: MeetingCtx, m: Meeting): Promise<Meeting> {
  if (!isDb(ctx) || !m.previousMeetingId || m.발굴id) return m;
  const prev = await getMeetingRecord(ctx, m.previousMeetingId).catch(() => null);
  return prev?.발굴id ? { ...m, 발굴id: prev.발굴id } : m;
}

/** 미팅 부분 수정 — 파일럿은 병합 결과 Meeting 반환, 비파일럿(시트 병합)은 null.
 * 병합기반 = DB(정본). _cleared(삭제됨)=에러 — self-heal 로 삭제 부활 금지.
 * DB 공백(R2 미러 누락분)만 시트에서 self-heal(아래 DB 쓰기가 공백을 메꿈). */
export async function patchMeetingRecord(
  ctx: MeetingCtx,
  id: string,
  partial: Partial<Omit<Meeting, "id">>,
): Promise<Meeting | null> {
  if (isDb(ctx)) {
    const state = await readMeetingRowStateFromDb(ctx.spreadsheetId, id);
    if (state?.cleared) throw new Error(`[meetings] 이미 삭제된 미팅: ${id}`);
    let base = state?.meeting ?? undefined;
    if (!base) base = (await findById(ctx.spreadsheetId, id)) ?? undefined;
    if (!base) throw new Error(`[meetings] 존재하지 않는 미팅: ${id}`);
    const merged = Meeting.parse({ ...base, ...partial });
    await writeRowToDb({ ...ctx, tab: "meetings", rowKey: id, payload: merged });
    queueMeetingSheetSync(ctx, id); // 시트 반영 + gcal reconcile(잡 내부, 행 보장 후)
    return merged;
  }
  await updateMeeting(ctx.spreadsheetId, id, partial); // 시트 정본(await)
  void reconcileMeetingEvent(ctx.email, ctx.spreadsheetId, id); // 시트 재조회(fresh) reconcile
  return null;
}

/** 미팅 삭제(행 clear) — gcalRemove: 본인 삭제=true(즉시 이벤트 삭제), cascade 자손=false
 * (R2 의미론 보존 — 단 파일럿은 수렴 잡의 cleared 브랜치가 어차피 멱등 제거 수행). */
export async function clearMeetingRecord(
  ctx: MeetingCtx,
  id: string,
  opts: { gcalRemove: boolean },
): Promise<void> {
  if (opts.gcalRemove) await syncMeetingRemoved(ctx.spreadsheetId, id); // 행 클리어 전(맵이 행에)
  if (isDb(ctx)) {
    await clearRowInDb({ ...ctx, tab: "meetings", rowKey: id });
    queueMeetingSheetSync(ctx, id); // cleared 상태로 수렴(행 클리어·이벤트 재확인)
    return;
  }
  await clearMeeting(ctx.spreadsheetId, id);
}

// ── 소스드 읽기 (쓰기 플로우 입력 — 파일럿=DB, 실패 throw·silent fallback 금지) ──

/** 단건 조회 — 파일럿: DB 우선, DB 에 행 자체가 없거나(legacy 미러 공백) 이월 raw 만 있으면
 * 시트에서 보충. _cleared 는 null(삭제됨). 비파일럿: 시트. */
export async function getMeetingRecord(
  ctx: MeetingCtx,
  id: string,
): Promise<Meeting | null> {
  if (isDb(ctx)) {
    const state = await readMeetingRowStateFromDb(ctx.spreadsheetId, id);
    if (state?.cleared) return null;
    if (state?.meeting) return state.meeting;
    return findById(ctx.spreadsheetId, id); // DB 공백·이월 raw — 시트 보충(self-heal 입력)
  }
  return findById(ctx.spreadsheetId, id);
}

/** 날짜 조회 — 파일럿: DB 전체 read 후 필터(예약일/미팅날짜). 비파일럿: 시트 findByDate. */
export async function findMeetingsByDateRecord(
  ctx: MeetingCtx,
  date: string,
  type: "reservation" | "meeting" = "meeting",
): Promise<Meeting[]> {
  if (isDb(ctx)) {
    const all = await readMeetingsFromDb(ctx.spreadsheetId);
    const hits = all.filter((m) =>
      type === "reservation" ? m.예약일 === date : m.미팅날짜 === date,
    );
    if (hits.length > 0) return hits;
    // DB 미러 공백(R2 fire-and-forget 누락분) self-heal — 단건 리더(getMeetingRecord)와 동일 원칙.
    // 그 날짜 행이 DB 에 전무하면 시트 보충(cascade·계약연결 탐색 누락 방지, 적대리뷰).
    return findByDate(ctx.spreadsheetId, date, type);
  }
  return findByDate(ctx.spreadsheetId, date, type);
}

/** previousMeetingId==parentId 자식 미팅 1건 — cascade 탐색. 파일럿: DB 전체 read 후 필터. */
export async function findChildMeetingRecord(
  ctx: MeetingCtx,
  parentId: string,
): Promise<Meeting | null> {
  if (isDb(ctx)) {
    const all = await readMeetingsFromDb(ctx.spreadsheetId);
    const hit = all.find((m) => m.previousMeetingId === parentId);
    if (hit) return hit;
    // DB 미러 공백(R2 누락분) self-heal — cascade walk 이 시트-only 자식을 놓쳐 자손·고아 계약카드가
    // 정리 안 되는 회귀 방지(적대리뷰 cascade-regression). 자식 없음(정상 종료)도 시트로 최종 확인.
    return findByPreviousMeetingId(ctx.spreadsheetId, parentId);
  }
  return findByPreviousMeetingId(ctx.spreadsheetId, parentId);
}
