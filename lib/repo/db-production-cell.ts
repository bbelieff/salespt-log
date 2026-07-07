/** Layer: repo — 03 직접생산 생산개수(M) 셀 동기화 (db.ts 에서 분리 — 500줄 캡). */
import { SHEET_RANGES } from "@/config";
import { sheetsClient } from "./sheets-client";
import { mirrorSheetRow } from "./db/mirror";

const T = /[s()]/.test(SHEET_RANGES.dbManagement.tab)
  ? `'${SHEET_RANGES.dbManagement.tab}'`
  : SHEET_RANGES.dbManagement.tab;

/** 직접생산 생산개수(M) 단일 셀 동기화 — app-owned 유입 기간합(ADR-0024). 항상 overwrite, §2.5 비대상. */
export async function writeProductionCountCell(
  spreadsheetId: string,
  row: number,
  count: number,
): Promise<void> {
  const sec = SHEET_RANGES.dbManagement.sections.직접생산;
  // 직접생산 I:O 는 단일문자 컬럼 — startCol(I) + cols offset → 생산개수 컬럼(M).
  const col = String.fromCharCode(
    sec.startCol.charCodeAt(0) + sec.cols.indexOf("생산개수"),
  );
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId,
    range: `${T}!${col}${row}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[count]] },
  });
  mirrorSheetRow({ spreadsheetId, tab: "db", rowKey: `직접생산:r${row}`, payload: { 생산개수: count } }); // P1 병합
}
