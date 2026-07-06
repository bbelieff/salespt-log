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

/** dual-write upsert — row_key 기준 멱등. DATABASE_URL 미설정이면 skip(no-op). */
export async function upsertSheetRow(
  row: SheetRowUpsert,
): Promise<{ skipped: boolean }> {
  if (!dbEnabled()) return { skipped: true };
  await ensureSchema();
  await getPool().query(
    `insert into sheet_rows (cohort, email, spreadsheet_id, tab, row_key, payload, updated_at)
     values ($1, $2, $3, $4, $5, $6, now())
     on conflict (spreadsheet_id, tab, row_key)
     do update set cohort = $1, email = $2, payload = $6, updated_at = now()`,
    [row.cohort, row.email, row.spreadsheetId, row.tab, row.rowKey, JSON.stringify(row.payload)],
  );
  return { skipped: false };
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
