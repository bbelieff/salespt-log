/** Layer: repo — 04→02 수임비 동기화 (contract-payment.ts 에서 분리 — 500줄 캡). */
import { sheetsClient } from "./sheets-client";
import { findRowByLink, resolveLayout, tabRef } from "./contract-payment";
import { type ContractWriteOpts, persistContractRow } from "./db/contracts-clear";
import { queueContractRowSync } from "./contract-sheet-sync";

/**
 * 04 업체관리에서 수임비가 수정됐을 때, 매칭되는 02 계약수납관리 row의
 * E열(수임비)을 sync 업데이트. (계약일+업체명)으로 매칭.
 *
 * 매칭 row 없으면 null 반환 — 호출 측에서 fan-out으로 새 row 생성하거나
 * 사용자에게 안내 가능.
 *
 * BBE-246: 파일럿 = DB 동기 병합(실패=throw) 먼저 + 시트는 비동기 수렴잡 큐.
 * 비파일럿 = R2 그대로(시트 동기 + DB 비동기 미러).
 */
export async function syncFeeFromContract(
  spreadsheetId: string,
  data: { 계약일: string; 업체명: string; 수임비: number; meetingId?: string },
  opts?: ContractWriteOpts,
): Promise<{ row: number } | null> {
  const row = await findRowByLink(spreadsheetId, {
    meetingId: data.meetingId,
    계약일: data.계약일,
    업체명: data.업체명,
  });
  if (!row) return null;
  if (opts?.syncDb) {
    await persistContractRow(spreadsheetId, row, { 수임비: data.수임비 }, opts);
    queueContractRowSync(spreadsheetId, row);
    return { row };
  }
  const { tab } = await resolveLayout(spreadsheetId);
  const range = `${tabRef(tab)}!E${row}`;
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[data.수임비]] },
  });
  await persistContractRow(spreadsheetId, row, { 수임비: data.수임비 }, opts); // R2
  return { row };
}
