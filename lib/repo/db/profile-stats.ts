/**
 * Layer: repo — Postgres 배치 읽기, 프로필 퍼널 통계용 (BBE-64).
 *
 * `readProfileBundle`(lib/repo/sales.ts) 의 stats 부분을 파일럿 기수에 한해 DB 로 대체하기
 * 위한 원본 행 배치 조회. `pg` 는 이 파일에서만 다룬다(tests/structural/layers.test.ts
 * postgres-isolation 가드).
 *
 * 왜 배치(ANY($1))인가: admin/트레이너/회장 화면은 N명(수십 명)을 한 번에 나열한다.
 * 기존 lib/repo/db/* 는 전부 spreadsheetId 1건 기준(readMeetingsFromDb 등) — 여기서
 * N명분을 한 번에 끌어와 시트 batchGet N회를 쿼리 2회로 대체한다(readMeetingsFromDb/
 * readSalesRowsFromDb 의 단건 조회와 동일 필터 규칙을 배치로 재현).
 */
import type { Meeting } from "@/types";
import { dbEnabled, getDbPool, ensureSchema, type DbSalesRow } from "./client";
import { meetingFromDbPayload } from "./read-daily";

export interface ProfileStatsRawRows {
  salesRows: DbSalesRow[];
  meetings: Meeting[];
}

// readSalesRowsFromDb(client.ts)의 toNum과 동일 규칙 — Number.isFinite 가드까지 그대로.
function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// readSalesRowsFromDb(client.ts)와 동일한 정규화(.slice(0,10)) — 이 함수가 그 형제라고
// 자처하는 이상 같은 방어를 적용한다(적대적 리뷰 2026-08-06: 누락 시 오염된 date 가
// inStatsWindow 정규식에서 조용히 fail-closed 되어 미팅예정 과소집계 가능).
function salesRowFromPayload(p: Record<string, unknown>): DbSalesRow {
  return {
    date: String(p.date ?? "").slice(0, 10),
    channel: String(p.channel ?? ""),
    production: toNum(p.production),
    inflow: toNum(p.inflow),
    contactProgress: toNum(p.contactProgress),
    meetingReservation: toNum(p.meetingReservation),
  };
}

/**
 * N개 spreadsheetId 의 sales·meetings 원본 행을 한 번에 조회 — 시트 batchGet N회를
 * 쿼리 2회로 대체. 호출부(service 레이어)가 `isDbReadPilot`+`dbEnabled()` 로 이미
 * 걸러진 spreadsheetId 목록만 넘겨야 한다(이 함수 자체는 게이트를 다시 걸지 않음 —
 * readMeetingsFromDb 등 형제 함수와 동일하게 "호출부 책임" 컨벤션).
 *
 * 반환 Map 은 요청한 모든 id 에 대해 항상 항목을 갖는다(빈 시트도 `{salesRows:[],
 * meetings:[]}`) — 호출부가 `?? []` 를 반복하지 않게.
 */
export async function readProfileStatsRowsFromDbBatch(
  spreadsheetIds: string[],
): Promise<Map<string, ProfileStatsRawRows>> {
  if (!dbEnabled()) throw new Error("[db] DATABASE_URL 미설정 — 호출부 게이트 오류");
  const out = new Map<string, ProfileStatsRawRows>();
  if (spreadsheetIds.length === 0) return out;
  for (const id of spreadsheetIds) out.set(id, { salesRows: [], meetings: [] });

  await ensureSchema();
  const pool = getDbPool();
  const [salesRes, meetingsRes] = await Promise.all([
    pool.query(
      `select spreadsheet_id, payload from sheet_rows
       where spreadsheet_id = any($1) and tab = 'sales'
         and coalesce((payload->>'_cleared')::boolean, false) = false`,
      [spreadsheetIds],
    ),
    pool.query(
      `select spreadsheet_id, payload from sheet_rows
       where spreadsheet_id = any($1) and tab = 'meetings'
         and coalesce((payload->>'_cleared')::boolean, false) = false`,
      [spreadsheetIds],
    ),
  ]);

  for (const row of salesRes.rows as { spreadsheet_id: string; payload: Record<string, unknown> }[]) {
    const bucket = out.get(row.spreadsheet_id);
    if (!bucket) continue;
    const sr = salesRowFromPayload(row.payload);
    if (sr.date === "" || sr.channel === "") continue; // readSalesRowsFromDb 와 동일 필터
    bucket.salesRows.push(sr);
  }
  for (const row of meetingsRes.rows as { spreadsheet_id: string; payload: Record<string, unknown> }[]) {
    const bucket = out.get(row.spreadsheet_id);
    if (!bucket) continue;
    const m = meetingFromDbPayload(row.payload);
    if (m) bucket.meetings.push(m);
  }
  return out;
}
