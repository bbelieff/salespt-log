/**
 * Layer: repo(db) — sheet_rows 행의 마지막 DB 저장 시각(updated_at) 읽기.
 *
 * 「영업기록 없이 추가」 업체를 미팅에 연결할 때(contract-meeting-link) 양쪽 값이 다르면 **최근에 기록한 쪽**을
 * 기본으로 고른다(belie 2026-09-29). 사람이 고친 시각이 따로 없어서 행의 마지막 저장 시각을 근사로 쓴다 —
 * 시트 수렴·백필 잡도 이 값을 바꿀 수 있어 "대략 최근" 이다. 화면은 기본값만 정하고 사용자가 고른다.
 * DB 가 꺼진 기수는 빈 결과(호출부가 실무/수납 쪽을 기본으로).
 */
import { dbEnabled, ensureSchema, getDbPool } from "./client";

export type RowRef = { tab: string; rowKey: string };

/** 각 행의 updated_at(ISO). 없는 행은 결과에 없다. 키 = `${tab}:${rowKey}`. */
export async function readRowsUpdatedAt(
  spreadsheetId: string,
  refs: RowRef[],
): Promise<Record<string, string>> {
  if (!dbEnabled() || refs.length === 0) return {};
  await ensureSchema();
  const res = await getDbPool().query(
    `select tab, row_key, updated_at from sheet_rows
     where spreadsheet_id = $1 and (tab, row_key) in (select * from unnest($2::text[], $3::text[]))`,
    [spreadsheetId, refs.map((r) => r.tab), refs.map((r) => r.rowKey)],
  );
  const out: Record<string, string> = {};
  for (const r of res.rows as { tab: string; row_key: string; updated_at: Date | string }[]) {
    out[`${r.tab}:${r.row_key}`] = new Date(r.updated_at).toISOString();
  }
  return out;
}
