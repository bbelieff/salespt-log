/**
 * Layer: repo — ADR-0038 시트 없는 수강생(`local:` 번호)의 03 DB관리 4섹션 행 추가.
 *
 * 시트 수강생은 시트가 첫 빈 행을 골라 행 번호(= 행의 정체)를 정한다(db.ts appendKeyless).
 * 시트 없는 수강생은 시트가 없으므로 DB 가 번호를 정한다 — 예약된 번호·살아 있는 행을 피한 가장
 * 작은 번호. 번호 고르기와 DB 행 저장을 **같은 잠금 안에서** 끝내야 동시 추가 두 건이 같은 번호를
 * 집지 않는다(시트 수강생의 fire-and-forget 미러와 다른 점 — 재시도해도 시트 중복행이 생길 일이 없다).
 */
import { upsertDbTabRowNow } from "./db-tab-append-mirror";
import { readReservedRows, withScopeLock } from "./db/db-append-idempotency";
import type { IdemPool } from "./db/expense-idempotency";
import { mintRowKey } from "./db/row-key";

/** firstDataRow 부터 excluded 에 없는 가장 작은 번호. */
export function nextFreeRow(firstDataRow: number, excluded?: Set<number>): number {
  let row = firstDataRow;
  while (excluded?.has(row)) row += 1;
  return row;
}

export async function appendSheetlessDbTabRow(
  pool: IdemPool,
  spreadsheetId: string,
  section: "매입DB" | "직접생산" | "현수막" | "콜지기소",
  firstDataRow: number,
  payload: (row: number) => Record<string, unknown>,
): Promise<{ row: number; replayed: boolean }> {
  const row = await withScopeLock(pool, spreadsheetId, section, async (db) => {
    const free = nextFreeRow(firstDataRow, await readReservedRows(db, spreadsheetId, section));
    await upsertDbTabRowNow(spreadsheetId, mintRowKey(section), payload(free));
    return free;
  });
  return { row, replayed: false };
}
