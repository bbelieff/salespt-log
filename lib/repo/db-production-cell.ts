/**
 * Layer: repo — 03 직접생산 생산개수(M) 셀 동기화 (db.ts 에서 분리 — 500줄 캡).
 *
 * DB 정본화(BBE-61, R3-4b): 이 호출은 컨택 저장(saveContactMetrics)을 경유해 발화하는데, 그 저장은
 * **이미 성공해서 커밋된 뒤**다 — M 재계산이 실패했다고 그 성공을 에러로 되돌리면 안 된다
 * (db-tab-sync.ts 의 throw-on-fail dual-sync 와 다른 이유). 그래서 파일럿(opts.syncDb)이어도
 * `mirrorSheetRowAwaitable`(재시도 3회, **절대 throw 안 함**)을 쓴다 — "동기 시도"로 read-your-writes
 * 타이밍 갭은 없애되, 실패는 여느 R2 미러처럼 warn+PostHog 로만 흡수. 비파일럿은 기존 fire-and-forget 불변.
 */
import { SHEET_RANGES } from "@/config";
import { sheetsClient } from "./sheets-client";
import { mirrorSheetRow, mirrorSheetRowAwaitable } from "./db/mirror";
import { resolveWriteKey } from "./db/row-key";

const T = /[s()]/.test(SHEET_RANGES.dbManagement.tab)
  ? `'${SHEET_RANGES.dbManagement.tab}'`
  : SHEET_RANGES.dbManagement.tab;

export interface ProductionCellWriteOpts {
  /** true = 파일럿(쓰기 정본 DB) — DB 반영을 **기다린 뒤** 반환(non-throw). 생략/false = 기존 R2 미러(fire-and-forget). */
  syncDb?: boolean;
}

/** 직접생산 생산개수(M) 단일 셀 동기화 — app-owned 유입 기간합(ADR-0024). 항상 overwrite, §2.5 비대상. */
export async function writeProductionCountCell(
  spreadsheetId: string,
  row: number,
  count: number,
  opts?: ProductionCellWriteOpts,
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
  if (opts?.syncDb) {
    await mirrorSheetRowAwaitable({ spreadsheetId, tab: "db", rowKey: key, payload: { 생산개수: count } }); // BBE-61
  } else {
    mirrorSheetRow({ spreadsheetId, tab: "db", rowKey: key, payload: { 생산개수: count } }); // P1 병합(R2 불변)
  }
}
