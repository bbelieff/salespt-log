/**
 * Layer: repo — Postgres(Supabase) 파일럿 클라이언트 (db-migration-pilot §2·§3).
 *
 * 가드레일:
 *   • `pg` 는 **lib/repo/db/ 전용** import (googleapis 격리와 동일 — 구조 테스트 강제).
 *   • **DATABASE_URL 미설정 = 전면 no-op** — 로컬·CI·파일럿 밖 환경에 영향 0.
 *   • URL·비밀번호를 로그/에러 메시지에 절대 포함하지 않는다(§3 secret 원칙).
 *
 * 연결: Supabase Session Pooler URI(sslmode=require) 1개 — pg Pool.
 * 스키마: 첫 사용 시 CREATE TABLE IF NOT EXISTS 자동 실행(멱등, 수동 마이그레이션 불필요).
 * 파일럿 스키마 = jsonb 미러(sheet_rows) — 정규화는 P2 에서(YAGNI).
 */
import { Pool } from "pg";

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

/** 파일럿 활성 여부 — DATABASE_URL 존재. false 면 모든 함수가 조용히 no-op. */
export function dbEnabled(): boolean {
  return !!process.env.DATABASE_URL?.trim();
}

/** db/ 내부 전용 pool 접근자 — read-daily.ts 등 형제 모듈이 공유(R2-2). */
export function getDbPool(): Pool {
  return getPool();
}

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Supabase Session Pooler — 전송 암호화 필수. 파일럿은 검증 완화(공용 CA 체인
      // 이슈 회피, Supabase 권장 패턴). P2 정본 전환 시 CA 고정 재검토.
      ssl: { rejectUnauthorized: false },
      max: 5, // 파일럿 트래픽 소규모 — Session Pooler 커넥션 절약
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
    });
  }
  return pool;
}

/** sheet_rows 스키마 보장 — 앱에서 첫 DB 사용 시 1회(promise 캐시), 멱등. */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = doEnsureSchema().catch((e) => {
      schemaReady = null; // 실패 시 다음 호출이 재시도
      throw e;
    });
  }
  return schemaReady;
}

async function doEnsureSchema(): Promise<void> {
  // 기획서 §2 DDL 그대로 (jsonb 미러). IF NOT EXISTS 로 멱등.
  await getPool().query(`
    create table if not exists sheet_rows (
      id bigserial primary key,
      cohort text not null,
      email text,
      spreadsheet_id text not null,
      tab text not null,
      row_key text not null,
      payload jsonb not null,
      updated_at timestamptz not null default now(),
      unique (spreadsheet_id, tab, row_key)
    )`);
  await getPool().query(
    `create index if not exists sheet_rows_cohort_tab on sheet_rows (cohort, tab)`,
  );
  await getPool().query(
    `create index if not exists sheet_rows_payload on sheet_rows using gin (payload)`,
  );
}

export interface SheetRowUpsert {
  cohort: string;
  email: string;
  spreadsheetId: string;
  tab: string;
  rowKey: string;
  /** 행 전체 키-값(컬럼명 기준) — 호출자가 직렬화 가능한 plain object 로 전달. */
  payload: Record<string, unknown>;
}

/** sheet_rows upsert SQL($1~$6) — 미러(단건)·정본 트랜잭션(다건)이 공유해 드리프트 방지.
 * jsonb 병합(기존 || 신규): 부분 payload 갱신이 기존 키를 지우지 않음. 자연키 = (spreadsheet_id,tab,row_key). */
const UPSERT_SHEET_ROW_SQL = `insert into sheet_rows (cohort, email, spreadsheet_id, tab, row_key, payload, updated_at)
     values ($1, $2, $3, $4, $5, $6::jsonb, now())
     on conflict (spreadsheet_id, tab, row_key)
     do update set cohort = $1, email = $2,
       payload = sheet_rows.payload || excluded.payload, updated_at = now()`;

/** dual-write upsert — row_key 기준 멱등. DATABASE_URL 미설정이면 skip(no-op).
 * payload 는 **jsonb 병합**(기존 || 신규) — 단일 셀 갱신(부분 payload)이 기존 키를
 * 지우지 않는다. clear 계열은 {_cleared:true} 병합(행 삭제 대신 마킹 — 대조 시 제외). */
export async function upsertSheetRow(
  row: SheetRowUpsert,
): Promise<{ skipped: boolean }> {
  if (!dbEnabled()) return { skipped: true };
  await ensureSchema();
  await getPool().query(UPSERT_SHEET_ROW_SQL, [
    row.cohort, row.email, row.spreadsheetId, row.tab, row.rowKey, JSON.stringify(row.payload),
  ]);
  return { skipped: false };
}

/** R3-1 쓰기 정본 — sales 다채널 4지표를 **한 트랜잭션**으로 원자 upsert(정본, db-write-flip §2).
 * upsertSheetRow 와 같은 SQL·병합·자연키({date}:{channel}). 실패 시 ROLLBACK 후 **throw**
 * — 시트 폴백 금지(§0 정본 이원화 금지, 저장 실패로 응답). DATABASE_URL 미설정 호출은 게이트 오류
 * (호출부가 chooseWriteSource 로 선판정). 시트 미러는 호출부가 비동기(fire-and-forget)로 별도 수행. */
/** type(별칭) 유지 — 미러 payload(`Record<string, unknown>`) 로 그대로 전달하려면 암묵적 인덱스 시그니처가 필요. */
export type SalesRowForDb = {
  date: string;
  channel: string;
  /** 파생 소유 채널은 **미기입**(생략) — jsonb 병합이 기존 파생값을 보존한다.
   *  채널별 규칙의 단일 원천 = `lib/repo/db/sales-payload.ts` `salesDbPayload`
   *  (매입DB=production 미기입 · 콜지기소=production·inflow 미기입 · 직접생산=production:=inflow · 현수막=그대로). */
  production?: number;
  inflow?: number;
  contactProgress: number;
  meetingReservation: number;
}
export async function writeSalesRowsToDb(p: {
  spreadsheetId: string;
  cohort: string;
  email: string;
  rows: SalesRowForDb[];
}): Promise<void> {
  if (!dbEnabled()) throw new Error("[db] DATABASE_URL 미설정 — 호출부 게이트 오류");
  if (p.rows.length === 0) return;
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("begin");
    for (const r of p.rows) {
      await client.query(UPSERT_SHEET_ROW_SQL, [
        p.cohort, p.email, p.spreadsheetId, "sales", `${r.date}:${r.channel}`, JSON.stringify(r),
      ]);
    }
    await client.query("commit");
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** R3-2 단일행 쓰기 정본 — meetings/todos/carryover 1행 upsert(정본, db-write-flip §2). tab 은 호출자
 * 지정("meetings"|"todos"). 실패=throw(시트폴백 금지 §0). DATABASE_URL 미설정 호출=게이트 오류(호출부가
 * chooseWriteSource 선판정). 시트 미러는 호출부가 비동기 수행. R3-1 다채널과 달리 단일행이라 트랜잭션 불필요. */
export async function writeRowToDb(p: {
  spreadsheetId: string;
  cohort: string;
  email: string;
  tab: string;
  rowKey: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  if (!dbEnabled()) throw new Error("[db] DATABASE_URL 미설정 — 호출부 게이트 오류");
  await ensureSchema();
  await getPool().query(UPSERT_SHEET_ROW_SQL, [
    p.cohort, p.email, p.spreadsheetId, p.tab, p.rowKey, JSON.stringify(p.payload),
  ]);
}

/** R3-2 clear 정본 — {_cleared:true} 병합(행 삭제 대신 마킹, 대조 시 제외). 실패=throw. */
export async function clearRowInDb(p: {
  spreadsheetId: string;
  cohort: string;
  email: string;
  tab: string;
  rowKey: string;
}): Promise<void> {
  await writeRowToDb({ ...p, payload: { _cleared: true } });
}

/** R2-1 읽기 전환 — 한 시트의 sales 미러 전체(≤10주×28행, 단일 쿼리).
 * payload 키는 dual-write(mirror.ts sales 훅)·backfill 과 동일:
 * {date, channel, production, inflow, contactProgress, meetingReservation}.
 * 값은 number 또는 문자열(backfill) 혼재 → 여기서 number 로 정규화. _cleared 제외. */
export interface DbSalesRow {
  date: string;
  channel: string;
  production: number;
  inflow: number;
  contactProgress: number;
  meetingReservation: number;
}

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function readSalesRowsFromDb(spreadsheetId: string): Promise<DbSalesRow[]> {
  if (!dbEnabled()) throw new Error("[db] DATABASE_URL 미설정 — 호출부 게이트 오류");
  await ensureSchema();
  const res = await getPool().query(
    `select payload from sheet_rows
     where spreadsheet_id = $1 and tab = 'sales'
       and coalesce((payload->>'_cleared')::boolean, false) = false`,
    [spreadsheetId],
  );
  return (res.rows as { payload: Record<string, unknown> }[])
    .map(({ payload: p }) => ({
      date: String(p.date ?? "").slice(0, 10),
      channel: String(p.channel ?? ""),
      production: toNum(p.production),
      inflow: toNum(p.inflow),
      contactProgress: toNum(p.contactProgress),
      meetingReservation: toNum(p.meetingReservation),
    }))
    .filter((r) => r.date !== "" && r.channel !== "");
}

/** 기수별·탭별 유효 행수 — 대조표용. _cleared 마킹 행 제외. 미설정이면 null. */
export async function countRowsByTab(
  cohort: string,
): Promise<Record<string, number> | null> {
  if (!dbEnabled()) return null;
  await ensureSchema();
  const res = await getPool().query(
    `select tab, count(*)::int as n from sheet_rows
     where cohort = $1 and coalesce((payload->>'_cleared')::boolean, false) = false
     group by tab`,
    [cohort],
  );
  const out: Record<string, number> = {};
  for (const r of res.rows as { tab: string; n: number }[]) out[r.tab] = r.n;
  return out;
}

/** sheet_rows 총 행수 — admin 진단·정합 대조용. 미설정이면 null. */
export async function countSheetRows(): Promise<number | null> {
  if (!dbEnabled()) return null;
  await ensureSchema();
  const res = await getPool().query(`select count(*)::int as n from sheet_rows`);
  return (res.rows[0]?.n as number) ?? 0;
}

/** 연결 점검(SELECT 1) — admin 진단용. 미설정 {enabled:false}. 에러 메시지에 URL 미포함. */
export async function checkDbConnection(): Promise<{
  enabled: boolean;
  ok: boolean;
  latencyMs: number | null;
  error: string | null;
}> {
  if (!dbEnabled()) return { enabled: false, ok: false, latencyMs: null, error: null };
  const t0 = Date.now();
  try {
    await getPool().query("select 1");
    return { enabled: true, ok: true, latencyMs: Date.now() - t0, error: null };
  } catch (e) {
    // 메시지에 접속 문자열이 섞이지 않도록 에러 클래스/코드 위주로 축약.
    const raw = e instanceof Error ? e.message : "unknown";
    const safe = raw.replace(/postgres(ql)?:\/\/\S+/gi, "[DATABASE_URL]");
    return { enabled: true, ok: false, latencyMs: Date.now() - t0, error: safe };
  }
}
