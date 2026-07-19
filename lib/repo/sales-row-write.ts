/**
 * Layer: repo — 01 영업관리 한 행의 **E:H 통째 쓰기** (R3⑤ 수렴 미러 전용).
 *
 * DB 정본 경로의 시트 미러는 **실행 시점 최신 DB 행**을 그대로 시트에 내려찍는다(수렴 동기화).
 * PR-1(`salesDbPayload`) 이후 DB 행은 **시트가 가져야 할 값과 1:1** 이므로 채널 분기가 필요 없다:
 *   E = production · F = inflow · G = contactProgress · H = meetingReservation  (4채널 공통)
 *     - 매입DB·콜지기소: production/inflow = 03 집계 파생(writeProductionCell 이 DB 에 기록)
 *     - 직접생산: production == inflow (PR-1 매핑, 시트 E=유입 규칙과 동일)
 *     - 현수막: production = 게시
 *
 * **편집 가능 기간(1~10주) 밖이면 아무것도 쓰지 않는다**(좌표 없음) — DB 에만 있고 시트엔 없는
 * 상태가 정상. 호출부(수렴 잡)는 false 를 받고 재시도하지 않는다.
 *
 * DB 재미러 없음(정본이 이미 DB) — mirrorSheetRow 호출 안 함.
 */
import { SHEET_RANGES } from "@/config";
import type { Channel } from "@/types";
import { sheetsClient } from "./sheets-client";
import { assertWritableCol, parseISO, readCourseStart, salesRowFor } from "./sales";

const T = /[\s()]/.test(SHEET_RANGES.sales.tab)
  ? `'${SHEET_RANGES.sales.tab}'`
  : SHEET_RANGES.sales.tab;

export interface SalesRowCells {
  production: number;
  inflow: number;
  contactProgress: number;
  meetingReservation: number;
}

/** 한 행의 E:H 를 값 그대로 기입. 편집기간 밖이면 **쓰지 않고 false**. */
export async function writeSalesRowCells(
  spreadsheetId: string,
  date: string,
  channel: Channel,
  cells: SalesRowCells,
): Promise<boolean> {
  const courseStart = await readCourseStart(spreadsheetId);
  let sheetRow: number;
  try {
    sheetRow = salesRowFor(parseISO(date), channel, courseStart);
  } catch {
    return false; // 편집 가능 기간(1~10주) 밖 — 시트 좌표 없음
  }
  const cols = SHEET_RANGES.sales.metricCols;
  for (const c of [cols.production, cols.inflow, cols.contactProgress, cols.meetingReservation]) {
    assertWritableCol(c, "writeSalesRowCells");
  }
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId,
    range: `${T}!${cols.production}${sheetRow}:${cols.meetingReservation}${sheetRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[cells.production, cells.inflow, cells.contactProgress, cells.meetingReservation]],
    },
  });
  return true;
}

/** 편집 가능 기간 안인지(= 시트에 좌표가 있는지). DB 쓰기 전 가드에 사용. */
export async function isWithinSalesWindow(
  spreadsheetId: string,
  date: string,
  channel: Channel,
): Promise<boolean> {
  const courseStart = await readCourseStart(spreadsheetId);
  try {
    salesRowFor(parseISO(date), channel, courseStart);
    return true;
  } catch {
    return false;
  }
}
