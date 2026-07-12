/** Layer: repo — 02 계약해지 필드(AL~AO) 쓰기 (contract-termination).
 *  contract-payment.ts 500줄 캡으로 분리. 읽기(rowToCP)·clear 는 본체가 담당. */
import { ensureGridColumns, sheetsClient } from "./sheets-client";
import { resolveLayout, tabRef } from "./contract-payment";
import { type ContractWriteOpts, persistContractRow } from "./db/contracts-clear";

export interface TerminationWrite {
  해지일: string; // ISO — 존재 = 해지
  해지사유: string;
  반환액: number;
  해지숨김: boolean; // soft delete — 카드 숨김(데이터 보존)
}

/** AL~AO 한 번에 기록. 기존 02 시트는 A:AK(37열)뿐일 수 있어 그리드 41열 선보장
 *  (banner-post-grid-columns 사고 계열 — 없는 컬럼 쓰기는 조용히 reject). */
export async function writeTermination(
  spreadsheetId: string,
  row: number,
  t: TerminationWrite,
  opts?: ContractWriteOpts,
): Promise<void> {
  const { tab, firstDataRow } = await resolveLayout(spreadsheetId);
  if (row < firstDataRow) {
    throw new Error(`[contract-termination] 헤더 행 보호: row ${row} 거부`);
  }
  await ensureGridColumns(spreadsheetId, tab, 41); // AO = 41열
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId,
    range: `${tabRef(tab)}!AL${row}:AO${row}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[t.해지일, t.해지사유, t.반환액, t.해지숨김 ? "Y" : ""]],
    },
  });
  // 필드명 payload(dual-write 규칙). 시트 "Y" 표기와 무관하게 boolean 저장.
  // R3-3: 파일럿 = DB 동기 병합(실패=throw), 비파일럿 = R2 미러(async).
  await persistContractRow(
    spreadsheetId,
    row,
    { 해지일: t.해지일, 해지사유: t.해지사유, 반환액: t.반환액, 해지숨김: t.해지숨김 },
    opts,
  );
}
