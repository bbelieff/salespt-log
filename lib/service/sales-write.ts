/**
 * Layer: service — sales(01 영업관리) 쓰기 정본 오케스트레이션 (R3-1 + **R3⑤**, db-write-flip §2).
 *
 * 게이트(`chooseWriteSource`, 읽기 게이트와 대칭)로 분기:
 *   • "db"(파일럿 + DB 켜짐) → **DB 동기 저장(정본)** + 시트 **수렴 미러**(비차단).
 *       DB 실패 = throw(시트 폴백 금지 — §0 정본 이원화 금지).
 *   • "sheet"(그 외) → R2 그대로. **비파일럿 완전 불변.**
 * 롤백 = 게이트 한 곳만 뒤집으면 즉시 R2 복귀(§4).
 *
 * **시트 미러 = 수렴 동기화(스냅샷 재생 금지)** — 실행 시점 **최신 DB 행**을 읽어 시트 E:H 를 내려찍는다.
 * 스냅샷을 재생하면 나중에 도착한 잡이 옛 값으로 되돌린다(예: 미팅 삭제로 H 2→1 을 수렴시킨 뒤
 * 삭제 전 스냅샷을 든 컨택저장 미러가 재시도로 늦게 착지하면 시트 H 가 2 로 되살아난다).
 * 같은 시트의 미러 잡은 **직렬 큐**로 순서를 보장한다 — 이 파일이 DB 정본 경로의 **유일한 시트 writer**.
 */
import * as Sentry from "@sentry/nextjs";
import {
  dbEnabled,
  readSalesRowFromDb,
  upsertSheetRow,
  writeSalesRowsToDb,
  type SalesRowForDb,
} from "@/repo/db/client";
import { readMeetingsFromDb } from "@/repo/db/read-daily";
import { salesDbPayload } from "@/repo/db/sales-payload";
import { batchWriteChannelDailyRows, decrementMeetingReservation } from "@/repo/sales";
import { writeProductionCell } from "@/repo/sales-production-cell";
import { isWithinSalesWindow, writeSalesRowCells } from "@/repo/sales-row-write";
import { captureServerEvent } from "@/lib/analytics/api-timing";
import type { Channel, ChannelDailyRow } from "@/types";
import { chooseWriteSource } from "./daily-source";

export interface SalesCtx {
  spreadsheetId: string;
  cohort: string;
  email: string;
}

/** 파일럿(DB 정본) 여부 — 쓰기 게이트. 단일 판정 지점. */
function isDbCanonical(cohort: string): boolean {
  return chooseWriteSource(cohort, dbEnabled()) === "db";
}

// ── 시트 수렴 미러 (시트별 직렬 큐) ───────────────────────────────
const sheetSyncTails = new Map<string, Promise<void>>();

/** 한 행 수렴 미러를 큐에 태운다(비차단). 같은 시트 잡은 **직렬** — 인터리빙으로 옛 값이 이기지 않게. */
export function queueSalesRowSync(ctx: SalesCtx, date: string, channel: Channel): void {
  const key = ctx.spreadsheetId;
  const tail = (sheetSyncTails.get(key) ?? Promise.resolve())
    .then(() => runSalesRowSync(ctx, date, channel))
    .catch(() => {}); // runSalesRowSync 가 Sentry 계수 — 큐는 항상 전진
  sheetSyncTails.set(key, tail);
  void tail.finally(() => {
    if (sheetSyncTails.get(key) === tail) sheetSyncTails.delete(key);
  });
}

/** 수렴 동기화 — **실행 시점 최신 DB 행** → 시트 E:H. 선형 백오프 3회.
 *  최종 실패는 Sentry 계수만(정본은 DB, 저장은 이미 성공). 편집기간 밖은 조용히 종료. */
async function runSalesRowSync(ctx: SalesCtx, date: string, channel: Channel): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const row = await readSalesRowFromDb(ctx.spreadsheetId, date, channel);
      if (!row) return; // DB 에 정본 행 없음 — 시트에 반영할 것 없음
      await writeSalesRowCells(ctx.spreadsheetId, date, channel, row); // false = 편집기간 밖(정상)
      return;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 300 * attempt));
    }
  }
  Sentry.captureException(lastErr, { tags: { where: "sales-sheet-sync" } });
  captureServerEvent("sheet_mirror_error", { tab: "sales" });
}

/** DB 정본 부분 upsert(jsonb 병합) — 1회 재시도, 최종 실패는 throw(시트 폴백 금지). */
async function upsertSalesCells(
  ctx: SalesCtx,
  date: string,
  channel: Channel,
  cells: Record<string, number>,
): Promise<void> {
  const doUpsert = () =>
    upsertSheetRow({
      cohort: ctx.cohort,
      email: ctx.email,
      spreadsheetId: ctx.spreadsheetId,
      tab: "sales",
      rowKey: `${date}:${channel}`,
      payload: { date, channel, ...cells },
    });
  try {
    await doUpsert();
  } catch {
    await doUpsert(); // 병합이라 멱등 — 1회 재시도. 그래도 실패하면 throw.
  }
}

// ── 컨택 저장 4지표 (R3-1) ────────────────────────────────────────

/** 컨택 저장 → DB payload. 채널별 규칙은 `salesDbPayload`(시트 쓰기와 1:1) 단일 원천. */
export function toDbRows(rows: ChannelDailyRow[]): SalesRowForDb[] {
  return rows.map(salesDbPayload);
}

/** rows 를 정본에 저장. DB 정본 경로 실패는 throw(저장 실패 응답). 시트 미러는 비차단·수렴형. */
export async function persistSalesRows(
  cohort: string,
  email: string,
  spreadsheetId: string,
  rows: ChannelDailyRow[],
): Promise<void> {
  if (isDbCanonical(cohort)) {
    await writeSalesRowsToDb({ spreadsheetId, cohort, email, rows: toDbRows(rows) });
    const ctx: SalesCtx = { spreadsheetId, cohort, email };
    for (const r of rows) queueSalesRowSync(ctx, r.date, r.channel); // 수렴 미러(스냅샷 재생 아님)
  } else {
    await batchWriteChannelDailyRows(spreadsheetId, rows);
  }
}

// ── R3⑤: 단일셀 writer 2개 DB 정본 전환 ──────────────────────────

/** 생산(E) 집계 기입 — 매입DB·콜지기소(03 파생, ADR-0020/0029).
 *  파일럿: **DB 동기 정본**(실패 throw) + 시트 수렴 미러. 그 외: R2(시트 정본 + async DB 미러) 불변.
 *  편집 가능 기간(1~10주) 밖이면 **DB 에도 쓰지 않는다** — 시트가 담을 수 없는 행이 DB 에 생기면
 *  무필터 집계(대시보드 채널생산·유입대기)가 영구히 부풀기 때문. */
export async function persistProductionCell(
  ctx: SalesCtx,
  date: string,
  channel: Channel,
  count: number,
): Promise<void> {
  if (!isDbCanonical(ctx.cohort)) {
    await writeProductionCell(ctx.spreadsheetId, date, channel, count);
    return;
  }
  if (!(await isWithinSalesWindow(ctx.spreadsheetId, date, channel))) return;
  // 콜·지·기·소는 유입 = 생산(ADR-0029) — 두 키 동시.
  const cells: Record<string, number> =
    channel === "콜·지·기·소" ? { production: count, inflow: count } : { production: count };
  await upsertSalesCells(ctx, date, channel, cells);
  queueSalesRowSync(ctx, date, channel);
}

/** 미팅예약(H) 재동기화 — ADR-0010 대로 **카드 수 절대 재계산**(±1 누적 RMW 폐기).
 *  파일럿: DB 카드수로 재집계 → DB 정본 upsert → 시트 수렴. 그 외: R2(시트 −1) 불변.
 *
 *  ⚠️ 재집계에 `findMeetingsByDateRecord` 를 쓰면 안 된다 — DB 0건일 때 **시트로 폴백**하는데,
 *  삭제 경로에선 DB 0 이 진실이고 아직 미러 안 된 시트엔 카드가 남아 있어 **지운 카드가 부활**한다.
 *  파일럿은 `readMeetingsFromDb` 직접. */
export async function persistMeetingReservationCount(
  ctx: SalesCtx,
  date: string,
  channel: Channel,
): Promise<void> {
  if (!isDbCanonical(ctx.cohort)) {
    await decrementMeetingReservation(ctx.spreadsheetId, date, channel);
    return;
  }
  if (!(await isWithinSalesWindow(ctx.spreadsheetId, date, channel))) return;
  const meetings = await readMeetingsFromDb(ctx.spreadsheetId);
  const cardCount = meetings.filter((m) => m.예약일 === date && m.channel === channel).length;
  await upsertSalesCells(ctx, date, channel, { meetingReservation: cardCount });
  queueSalesRowSync(ctx, date, channel);
}
