/**
 * Layer: repo — 대시보드 탭 I/O (읽기 전용).
 *
 * SSOT: docs/domains/sheet-structure.md §1
 * 모든 대시보드 셀은 시트 수식 자동 집계 — 앱은 절대 쓰지 않는다.
 * (구조 테스트가 SHEET_RANGES.dashboard 의 쓰기 호출을 차단)
 *
 * 전략: 카드/차트 셀이 흩어져 있어도 1회 values.get 으로 통째로 읽고
 *       service 레이어에서 cell 매핑. 다중 batchGet 보다 1회 read 가 단순.
 */
import { SHEET_RANGES } from "@/config";
import { sheetsClient } from "./sheets-client";

/** 대시보드 grid (행 단위 2D). 비어있는 셀은 undefined. */
export type DashboardGrid = (string | number | boolean | null | undefined)[][];

/**
 * 대시보드 탭 1회 read.
 * - valueRenderOption: UNFORMATTED_VALUE — 숫자는 number, 빈 셀은 undefined.
 * - dateTimeRenderOption: SERIAL_NUMBER — 날짜 셀이 있다면 직렬 number 반환.
 *   (대시보드는 보통 날짜 셀 없음. service 레이어에서 필요 시 변환.)
 */
export async function readDashboard(
  spreadsheetId: string,
): Promise<DashboardGrid> {
  const { tab, summary } = SHEET_RANGES.dashboard;
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!${summary}`,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  return (res.data.values ?? []) as DashboardGrid;
}
