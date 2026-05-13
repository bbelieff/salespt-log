/**
 * Layer: repo — Registry M 컬럼(sort_order) 일괄 update (users.ts 에서 분리, 500줄 cap).
 *
 * PR C-1 (2026-05-13). admin 드래그 정렬 결과를 받아 박스 내 카드들에 1..N 의
 * sortOrder 를 일괄 반영. /admin/users + /admin/trainers 공용.
 *
 * 설계: 호출자(API route)가 email → order 매핑을 통째로 넘김. 박스 단위 의미는
 * 호출자가 알고 있고 (drag 한 박스의 멤버 emails 만), 여기는 row 매칭 + M 컬럼
 * batchUpdate 만. 다른 컬럼은 절대 건드리지 않음.
 *
 * 청크: PR B-3 migrate 와 동일하게 100 row/call.
 */
import { registry } from "@/config";
import { readRange, sheetsClient } from "./sheets-client";
import { invalidateRegistry } from "./users";

const DATA_RANGE = (tab: string) => `${tab}!A2:M`;
const CHUNK_SIZE = 100;

export async function setUserSortOrders(
  orders: { email: string; sortOrder: number }[],
): Promise<{ updated: number; skipped: number }> {
  if (orders.length === 0) return { updated: 0, skipped: 0 };
  const reg = registry();
  const rows = await readRange(reg.spreadsheetId, DATA_RANGE(reg.tab));
  const emailToRow = new Map<string, number>();
  for (let i = 0; i < rows.length; i++) {
    const e = String(rows[i]?.[0] ?? "").trim().toLowerCase();
    if (e) emailToRow.set(e, i + 2); // header offset
  }
  const updates: { range: string; values: unknown[][] }[] = [];
  let skipped = 0;
  for (const o of orders) {
    const sheetRow = emailToRow.get(o.email.toLowerCase());
    if (!sheetRow) {
      skipped++;
      continue;
    }
    if (!Number.isFinite(o.sortOrder) || o.sortOrder < 0) {
      skipped++;
      continue;
    }
    updates.push({
      range: `${reg.tab}!M${sheetRow}`,
      values: [[String(Math.floor(o.sortOrder))]],
    });
  }
  if (updates.length > 0) {
    for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
      const chunk = updates.slice(i, i + CHUNK_SIZE);
      await sheetsClient().spreadsheets.values.batchUpdate({
        spreadsheetId: reg.spreadsheetId,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: chunk,
        },
      });
    }
    invalidateRegistry();
  }
  return { updated: updates.length, skipped };
}
