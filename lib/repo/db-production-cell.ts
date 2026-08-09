/** Layer: repo — 03 직접생산 생산개수(M) 셀 동기화 (db.ts 에서 분리 — 500줄 캡). */
import { SHEET_RANGES } from "@/config";
import { sheetsClient } from "./sheets-client";
import { mirrorSheetRow } from "./db/mirror";
import { resolveWriteKey } from "./db/row-key";

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
  // BBE-59: 그 물리 행이 이미 UUID 키로 append 됐을 수 있다 — 레거시 키 고정 사용 시 별도 유령
  // 행이 생겨 생산개수가 실제 행에 반영 안 될 위험(db/row-key.ts 헤더). 현재 매핑된 키로 병합.
  const key = await resolveWriteKey(spreadsheetId, "직접생산", row);
  mirrorSheetRow({ spreadsheetId, tab: "db", rowKey: key, payload: { 생산개수: count } }); // P1 병합
}
