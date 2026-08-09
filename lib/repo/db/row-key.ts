/**
 * Layer: repo — 03 DB관리 row_key 발급/조회 (BBE-59, R7-#10 Phase 1).
 *
 * 배경: append 4경로(../db.ts)는 row_key 를 시트 findFirstEmptyRow 가 쓰기 시점에 할당한
 * 행번호로 짓는다(`{섹션}:r{row}`) — DB 가 키를 알기 전에 시트 쓰기가 먼저 끝나야 하고,
 * 재시도하면 시트가 다른 빈 행을 다시 골라 같은 논리적 append 가 DB 에 두 행으로 남는다
 * (매출 이중계상 위험 — db-tab-sync.ts 가 append 를 dual-sync 제외한 이유). 행이 clear 후
 * 재사용되면 새 항목이 옛 row_key 를 물려받아 jsonb 얕은 병합이 옛 필드를 잔존시키는 문제도
 * 같은 뿌리(콜지기소 발굴id 가 이미 한 번 겪음, lead-chain §4-3 B3).
 *
 * 해법: append 는 행번호와 무관한 UUID 키(mintRowKey)를 새로 발급 — 재시도해도 항상 같은
 * 키로 멱등 upsert, 재사용 행도 완전히 새 DB 행이 되어 잔존 필드가 생기지 않는다. 마이그레이션
 * 전까지 레거시(`r{row}`)·신규(uuid) 키가 공존하므로, update/clear 는 물리 행(section+row)에
 * **현재 매핑된 키**를 findCurrentRowKey 로 조회해서 그 키를 써야 한다.
 *
 * ⚠️ 순환참조 주의: ../db.ts(시트 레이어)가 이 파일을 import 한다. read-db-tab.ts 는 반대로
 * ../db.ts 를 import 하므로, 이 파일은 read-db-tab.ts 를 참조하지 않고 client.ts 만 직접 쓴다.
 */
import { randomUUID } from "node:crypto";
import { dbEnabled, ensureSchema, getDbPool } from "./client";

/** 신규 append 전용 키 발급 — `{섹션}:{uuid}`. 재시도해도 호출자가 같은 값을 재사용하면 멱등. */
export function mintRowKey(section: string): string {
  return `${section}:${randomUUID()}`;
}

/**
 * 물리 행(section+row)에 현재 매핑된 row_key 조회.
 *  · 레거시 행(마이그레이션 전 또는 이 PR 이전 append) = `{섹션}:r{row}` 그 자체(exact match).
 *  · 신규 행(이 PR 이후 append) = `{섹션}:{uuid}`, payload._row 로 행번호를 식별.
 * 우선순위: 레거시 exact match 우선(과거 행 대다수) → `_row` 매치(uuid 형, 동률이면 최신
 * updated_at). 매치가 없으면 null — DB 미설정, 아직 미러 안 됨(fire-and-forget 지연/실패),
 * 백필 전 등 호출부가 판단할 수 없는 상태이므로 **레거시 키로 폴백**시켜 기존 동작을 보존한다.
 */
export async function findCurrentRowKey(
  spreadsheetId: string,
  section: string,
  row: number,
): Promise<string | null> {
  if (!dbEnabled()) return null;
  await ensureSchema();
  const legacyKey = `${section}:r${row}`;
  const res = await getDbPool().query(
    `select row_key from sheet_rows
     where spreadsheet_id = $1 and tab = 'db'
       and (
         row_key = $2
         or (row_key like $3 and (payload->>'_row')::int = $4)
       )
     order by (row_key = $2) desc, updated_at desc
     limit 1`,
    [spreadsheetId, legacyKey, `${section}:%`, row],
  );
  return (res.rows[0]?.row_key as string | undefined) ?? null;
}

/** update/clear 가 실제로 쓸 키 확정 — 조회 실패/미설정이면 레거시 형으로 폴백(기존 동작 보존). */
export async function resolveWriteKey(
  spreadsheetId: string,
  section: string,
  row: number,
): Promise<string> {
  const found = await findCurrentRowKey(spreadsheetId, section, row).catch(() => null);
  return found ?? `${section}:r${row}`;
}
