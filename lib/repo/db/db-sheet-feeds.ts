/**
 * DB 시트 자동 확인 연결(0016_db_sheet_feeds) — 수강생이 연결한 공급처 구글시트 한 줄 = 한 연결.
 * 고객 원문은 저장하지 않는다(seen = 해시 지문, pending_inflow = 유입 반영을 아직 묻지 않은 DB id).
 */
import { randomUUID } from "node:crypto";
import { dbEnabled, getDbPool } from "./client";

export type DbSheetFeedRow = {
  id: string; email: string; spreadsheetId: string; sheetId: string; gid: string;
  supplier: string; channel: string; rules: Record<string, string>;
  seen: string[]; pendingInflow: string[]; reviewCount: number;
  enabled: boolean; failCount: number; lastSlot: string | null; lastCheckedAt: string | null; lastAdded: number; lastError: string | null;
};

function pool() {
  if (!dbEnabled()) throw new Error("db_sheet_feed_unavailable");
  return getDbPool();
}
const COLUMNS = `id, email, spreadsheet_id, sheet_id, gid, supplier, channel, rules, seen, pending_inflow, review_count,
  enabled, fail_count, last_slot, last_checked_at, last_added, last_error`;
type Raw = {
  id: string; email: string; spreadsheet_id: string; sheet_id: string; gid: string; supplier: string; channel: string;
  rules: Record<string, string> | null; seen: string[] | null; pending_inflow: string[] | null; review_count: number;
  enabled: boolean; fail_count: number; last_slot: string | null; last_checked_at: Date | string | null; last_added: number; last_error: string | null;
};
function toRow(r: Raw): DbSheetFeedRow {
  return {
    id: r.id, email: r.email, spreadsheetId: r.spreadsheet_id, sheetId: r.sheet_id, gid: r.gid, supplier: r.supplier, channel: r.channel,
    rules: r.rules ?? {}, seen: r.seen ?? [], pendingInflow: r.pending_inflow ?? [], reviewCount: r.review_count,
    enabled: r.enabled, failCount: r.fail_count, lastSlot: r.last_slot,
    lastCheckedAt: r.last_checked_at ? new Date(r.last_checked_at).toISOString() : null, lastAdded: r.last_added, lastError: r.last_error,
  };
}

export async function listFeedsForSheet(spreadsheetId: string): Promise<DbSheetFeedRow[]> {
  const r = await pool().query<Raw>(`select ${COLUMNS} from public.db_sheet_feeds where spreadsheet_id=$1 order by created_at`, [spreadsheetId]);
  return r.rows.map(toRow);
}

/** 이번 시각 칸에 아직 확인하지 않은 켜진 연결. */
export async function listDueFeeds(slot: string): Promise<DbSheetFeedRow[]> {
  const r = await pool().query<Raw>(
    `select ${COLUMNS} from public.db_sheet_feeds where enabled and (last_slot is null or last_slot <> $1) order by last_checked_at nulls first`,
    [slot],
  );
  return r.rows.map(toRow);
}

/** 같은 시트를 다시 연결하면 설정만 바꾸고 켠다(본 줄 기억은 새로 계산한 값으로). */
export async function upsertFeed(input: { email: string; spreadsheetId: string; sheetId: string; gid: string; supplier: string; channel: string; rules: Record<string, string>; seen: string[] }): Promise<DbSheetFeedRow> {
  const r = await pool().query<Raw>(
    `insert into public.db_sheet_feeds (id, email, spreadsheet_id, sheet_id, gid, supplier, channel, rules, seen)
     values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::text[])
     on conflict (spreadsheet_id, sheet_id, gid) do update set
       email=excluded.email, supplier=excluded.supplier, channel=excluded.channel, rules=excluded.rules,
       seen=(select array(select distinct unnest(public.db_sheet_feeds.seen || excluded.seen))),
       enabled=true, fail_count=0, last_error=null
     returning ${COLUMNS}`,
    [randomUUID(), input.email.toLowerCase(), input.spreadsheetId, input.sheetId, input.gid, input.supplier, input.channel, JSON.stringify(input.rules), input.seen],
  );
  return toRow(r.rows[0]!);
}

export async function countFeeds(spreadsheetId: string): Promise<number> {
  const r = await pool().query<{ n: number }>("select count(*)::int as n from public.db_sheet_feeds where spreadsheet_id=$1", [spreadsheetId]);
  return r.rows[0]?.n ?? 0;
}

/**
 * 이번 시각 칸을 먼저 차지한다(두 번 돌아도 한 번만). 이미 다른 실행이 차지했으면 false.
 */
export async function claimFeedSlot(id: string, slot: string): Promise<boolean> {
  const r = await pool().query(
    "update public.db_sheet_feeds set last_slot=$2 where id=$1 and enabled and (last_slot is null or last_slot <> $2) returning id",
    [id, slot],
  );
  return r.rows.length > 0;
}

export async function recordFeedSuccess(id: string, result: { seen: string[]; added: string[]; review: number }): Promise<void> {
  await pool().query(
    `update public.db_sheet_feeds set
       seen=(select array(select distinct unnest(seen || $2::text[]))),
       pending_inflow=(select array(select distinct unnest(pending_inflow || $3::text[]))),
       review_count=$4, last_added=$5, fail_count=0, last_error=null, last_checked_at=now()
     where id=$1`,
    [id, result.seen, result.added, result.review, result.added.length],
  );
}

/** 실패 기록 — 연속 pauseAfter 번이면 끈다. 사용자에게 보일 짧은 안내만 남긴다(고객 값 없음). */
export async function recordFeedFailure(id: string, message: string, pauseAfter: number): Promise<void> {
  await pool().query(
    `update public.db_sheet_feeds set fail_count=fail_count+1, last_error=$2, last_checked_at=now(),
       enabled = case when fail_count+1 >= $3 then false else enabled end
     where id=$1`,
    [id, message.slice(0, 200), pauseAfter],
  );
}

export async function setFeedEnabled(spreadsheetId: string, id: string, enabled: boolean): Promise<boolean> {
  const r = await pool().query(
    "update public.db_sheet_feeds set enabled=$3, fail_count=case when $3 then 0 else fail_count end, last_error=case when $3 then null else last_error end where id=$1 and spreadsheet_id=$2 returning id",
    [id, spreadsheetId, enabled],
  );
  return r.rows.length > 0;
}

/** 유입 반영 팝업에서 답한 DB id 를 빼낸다. */
export async function clearPendingInflow(spreadsheetId: string, ids: string[]): Promise<void> {
  await pool().query(
    "update public.db_sheet_feeds set pending_inflow=(select array(select x from unnest(pending_inflow) x where not (x = any($2::text[])))) where spreadsheet_id=$1",
    [spreadsheetId, ids],
  );
}

export async function deleteFeed(spreadsheetId: string, id: string): Promise<boolean> {
  const r = await pool().query("delete from public.db_sheet_feeds where id=$1 and spreadsheet_id=$2 returning id", [id, spreadsheetId]);
  return r.rows.length > 0;
}
