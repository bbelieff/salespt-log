/**
 * Layer: repo — Postgres 배치 읽기, 전광판(아레나 스코어보드) 주차별 5지표용 (BBE-63, R7 Phase 3 #14).
 *
 * `lib/service/scoreboard.ts` 의 `cachedWeekly`(대시보드 C33:H40 batchGet)·`cachedContractPayments`
 * (02 전량 batchGet) 를 파일럿(=아레나 참가자 전원, isArenaCohortLabel)에 한해 DB 로 대체하기 위한
 * 배치 조회. `pg` 는 이 파일에서만 다룬다(tests/structural/layers.test.ts postgres-isolation 가드).
 *
 * 왜 배치(ANY($1))인가: 전광판은 기수당 최대 수십 명(시즌2는 90여 명)을 한 화면에 집계한다.
 * `lib/repo/db/profile-stats.ts`(BBE-64, PR #713)와 동일 패턴 — 시트 batchGet N회를 쿼리 3회로
 * 대체(sales·meetings·contracts). courseStart(O1)는 DB 대응값이 없어(수강기간은 R7 Phase 1 #8
 * 전까지 DB 미이관) 이 배치에 포함하지 않는다 — 호출부가 기존 cachedCourseStart(시트, 캐시됨)를
 * 그대로 쓴다.
 */
import type { Meeting, ContractPayment } from "@/types";
import { dbEnabled, getDbPool, ensureSchema, type DbSalesRow } from "./client";
import { meetingFromDbPayload, contractFromDbPayload, isContractHeaderZoneJunk } from "./read-daily";

export interface ScoreboardRawRows {
  salesRows: DbSalesRow[];
  meetings: Meeting[];
  contracts: ContractPayment[];
}

// readSalesRowsFromDb(client.ts)와 동일 정규화(.slice(0,10) + Number.isFinite 가드) — 그 함수의
// 배치 형제라고 자처하는 이상 같은 방어를 적용한다(profile-stats.ts 의 동일 선례 주석 참고).
function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
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
 * N개 spreadsheetId 의 sales·meetings·contracts 원본 행을 한 번에 조회(쿼리 3회, 병렬).
 * 호출부(service 레이어)가 `isDbReadPilot`+`dbEnabled()` 로 이미 걸러진 spreadsheetId 목록만
 * 넘겨야 한다(이 함수 자체는 게이트를 다시 걸지 않음 — readMeetingsFromDb 등 형제 함수와 동일
 * "호출부 책임" 컨벤션).
 *
 * 반환 Map 은 요청한 모든 id 에 대해 항상 항목을 갖는다(빈 시트도 `{salesRows:[],meetings:[],
 * contracts:[]}`) — 호출부가 `?? []` 를 반복하지 않게. 부부/멀티계정이 spreadsheetId 를 공유해도
 * (profile-stats.ts 선례와 동일 이유) 이 함수는 시트 단위로만 묶는다 — 사람 단위 병합은 호출부 몫.
 */
export async function readScoreboardRowsFromDbBatch(
  spreadsheetIds: string[],
): Promise<Map<string, ScoreboardRawRows>> {
  if (!dbEnabled()) throw new Error("[db] DATABASE_URL 미설정 — 호출부 게이트 오류");
  const out = new Map<string, ScoreboardRawRows>();
  if (spreadsheetIds.length === 0) return out;
  for (const id of spreadsheetIds) out.set(id, { salesRows: [], meetings: [], contracts: [] });

  await ensureSchema();
  const pool = getDbPool();
  const [salesRes, meetingsRes, contractsRes] = await Promise.all([
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
    pool.query(
      `select spreadsheet_id, row_key, payload from sheet_rows
       where spreadsheet_id = any($1) and tab = 'contracts'
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
  for (const row of contractsRes.rows as {
    spreadsheet_id: string;
    row_key: string;
    payload: Record<string, unknown>;
  }[]) {
    const bucket = out.get(row.spreadsheet_id);
    if (!bucket) continue;
    const n = Number(row.row_key.replace(/^r/, ""));
    if (!Number.isFinite(n)) continue;
    const cp = contractFromDbPayload(row.payload, n);
    if (cp && !isContractHeaderZoneJunk(row.payload, cp)) bucket.contracts.push(cp);
  }
  // readContractsFromDb 와 동일하게 행번호 오름차순 정렬(시트 순서 재현 — splitContractRevenue 등
  // 순서 의존 소비처가 있을 수 있어 단건 조회 결과와 순서를 맞춘다).
  for (const bucket of out.values()) {
    bucket.contracts.sort((a, b) => (a.row ?? 0) - (b.row ?? 0));
  }
  return out;
}
