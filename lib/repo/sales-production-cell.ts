/**
 * Layer: repo — 01 영업관리 생산(E) 단일셀 기입 (sales.ts 에서 분리 — 500줄 캡).
 *
 * 매입DB·콜·지·기·소의 생산(E)은 03 DB관리 집계가 소유(ADR-0020) — 컨택탭이 아니라 여기서 쓴다.
 * 콜·지·기·소는 추가로 **유입(F) = 생산(E)** (ADR-0029, 접수 건수 파생) → E:F 를 같은 값으로 1회 기입.
 */
import { SHEET_RANGES } from "@/config";
import type { Channel } from "@/types";
import { sheetsClient } from "./sheets-client";
import { mirrorSheetRow } from "./db/mirror";
import { assertWritableCol, parseISO, readCourseStart, salesRowFor } from "./sales";

const T = /[\s()]/.test(SHEET_RANGES.sales.tab)
  ? `'${SHEET_RANGES.sales.tab}'`
  : SHEET_RANGES.sales.tab;

/** 생산(E) 기입 — 항상 overwrite, 편집기간(1~10주) 밖은 skip.
 *  콜·지·기·소면 유입(F)도 같은 값으로 동시 기입(ADR-0029). */
export async function writeProductionCell(
  spreadsheetId: string,
  date: string,
  channel: Channel,
  count: number,
): Promise<void> {
  const courseStart = await readCourseStart(spreadsheetId);
  let sheetRow: number;
  try {
    sheetRow = salesRowFor(parseISO(date), channel, courseStart);
  } catch {
    return; // 편집 가능 기간 밖 — 영업관리 E 대상 아님
  }
  const cols = SHEET_RANGES.sales.metricCols;
  assertWritableCol(cols.production, "writeProductionCell");
  const alsoInflow = channel === "콜·지·기·소"; // ADR-0029: 유입 = 생산(접수 건수) 파생
  if (alsoInflow) assertWritableCol(cols.inflow, "writeProductionCell");
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId,
    range: alsoInflow
      ? `${T}!${cols.production}${sheetRow}:${cols.inflow}${sheetRow}`
      : `${T}!${cols.production}${sheetRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [alsoInflow ? [count, count] : [count]] },
  });
  mirrorSheetRow({
    spreadsheetId,
    tab: "sales",
    rowKey: `${date}:${channel}`,
    payload: alsoInflow
      ? { date, channel, production: count, inflow: count }
      : { date, channel, production: count },
  }); // P1 병합
}
