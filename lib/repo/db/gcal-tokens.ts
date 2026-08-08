/**
 * Layer: repo — gcal 토큰·설정 Postgres 저장 (BBE-58, R7 Phase 1 #9).
 *
 * 레지스트리 시트 S(암호화 refresh token)·T(설정 JSON) 열의 DB 대응. `pg` 는 이 파일에서만
 * 다룬다(tests/structural/layers.test.ts postgres-isolation 가드). 자연키 = email
 * (migrations/0002_gcal_tokens.sql 헤더의 결정 근거 참조).
 *
 * ⚠️ **보안(ADR-0028 §3)**: `tokenEnc` 는 AES-256-GCM **암호문**이다. 이 모듈은 복호화하지
 * 않으며(복호화는 gcal-token.ts 가 gcal-crypto 로), 어떤 경로로도 이 값을 로그에 남기지
 * 않는다 — 에러 메시지에도 포함 금지.
 *
 * ⚠️ **행 존재 = 정본 표식**: `null` 반환(행 없음) 과 `{tokenEnc:""}`(행 있고 해제됨)은
 * 의미가 다르다. 전자만 시트 폴백 대상이며, 후자를 폴백시키면 **연결 해제가 되살아난다**.
 * 이 구분은 호출부(gcal-token.ts)가 강제한다.
 */
import { dbEnabled, getDbPool, ensureSchema } from "./client";

export interface GcalTokenRow {
  /** AES-256-GCM 암호문(`v1:iv:tag:ct`) 또는 ""(연결 해제). 절대 로그 금지. */
  tokenEnc: string;
  /** GcalSettings JSON 문자열. ""(빈 문자열) = 기본 설정 사용. */
  settings: string;
}

/**
 * 한 사용자의 gcal 행. **행이 없으면 null** — 시트 폴백 여부를 가르는 유일한 신호다
 * (""(해제)과 혼동 금지, 위 헤더 주의 참조).
 */
export async function readGcalTokenRow(email: string): Promise<GcalTokenRow | null> {
  if (!dbEnabled()) throw new Error("[db] DATABASE_URL 미설정 — 호출부 게이트 오류");
  await ensureSchema();
  const res = await getDbPool().query(
    `select token_enc, settings from gcal_tokens where email = $1`,
    [email.toLowerCase()],
  );
  const row = (res.rows as { token_enc: string; settings: string }[])[0];
  if (!row) return null;
  return { tokenEnc: row.token_enc ?? "", settings: row.settings ?? "" };
}

/**
 * 토큰 암호문만 upsert(설정은 건드리지 않음 — 최초 삽입 시에만 기본값 ''). 해제는 tokenEnc=""
 * 로 호출한다: 행을 **삭제하지 않는 것이 중요**하다(삭제하면 다음 읽기가 시트로 폴백해
 * 해제가 되살아난다).
 */
export async function upsertGcalToken(email: string, tokenEnc: string): Promise<void> {
  if (!dbEnabled()) throw new Error("[db] DATABASE_URL 미설정 — 호출부 게이트 오류");
  await ensureSchema();
  await getDbPool().query(
    `insert into gcal_tokens (email, token_enc) values ($1, $2)
     on conflict (email) do update set token_enc = excluded.token_enc, updated_at = now()`,
    [email.toLowerCase(), tokenEnc],
  );
}

/** 설정 JSON 만 upsert(토큰은 건드리지 않음 — 최초 삽입 시에만 기본값 ''). */
export async function upsertGcalSettings(email: string, settings: string): Promise<void> {
  if (!dbEnabled()) throw new Error("[db] DATABASE_URL 미설정 — 호출부 게이트 오류");
  await ensureSchema();
  await getDbPool().query(
    `insert into gcal_tokens (email, settings) values ($1, $2)
     on conflict (email) do update set settings = excluded.settings, updated_at = now()`,
    [email.toLowerCase(), settings],
  );
}

/**
 * 시트 → DB 최초 이전(lazy backfill) 전용 — **행이 없을 때만** 삽입한다.
 * `on conflict do nothing` 이 핵심: 이미 DB 에 값이 있으면(= 그 값이 정본) 옛 시트 값이
 * 덮어쓰지 않는다. 읽기 경로에서 fire-and-forget 으로 호출되므로 실패해도 무해해야 한다.
 */
export async function backfillGcalRowIfAbsent(
  email: string,
  tokenEnc: string,
  settings: string,
): Promise<void> {
  if (!dbEnabled()) throw new Error("[db] DATABASE_URL 미설정 — 호출부 게이트 오류");
  await ensureSchema();
  await getDbPool().query(
    `insert into gcal_tokens (email, token_enc, settings) values ($1, $2, $3)
     on conflict (email) do nothing`,
    [email.toLowerCase(), tokenEnc, settings],
  );
}
