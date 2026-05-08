/**
 * Layer: repo — 대시보드(자동작성) 탭 read.
 *
 * SSOT: docs/domains/sheet-structure.md §1
 * 시트 인스펙션 결과 (2026-05-08):
 *   I.  누적 재무 성과 (row 20-21): B21~G21
 *   II. 영업 퍼널 (row 25-29):
 *       B25:B30 = 생산/유입/컨택진행/미팅예약/미팅완료/계약 (6단계 합계)
 *       H25:H29 = 5지표 % (DB퀄리티/컨택성공률/미팅실행률/미팅숙련도/영업생산성)
 *   III. 주차별 성과 (row 32-41): C33:H40 = 8주 × 6컬럼 (생산/유입/컨택/미팅/계약/활동량)
 *        row 41 = 합계
 *   IV. 채널별 성과 (row 44-48): B45:E48 = 4채널 × (생산/계약/계약단가)
 *   V. 계약 파이프라인 (row 50+) — 미사용
 *
 * 1회 batchGet으로 5개 영역 모두 읽음.
 */
import { sheetsClient } from "./sheets-client";
import { SHEET_RANGES } from "@/config";

export interface DashboardSheetData {
  /** 재무 [B21~G21]: 수임비, 수수료, 총매출, 총비용, 영업이익, 영업이익률 */
  finance: (number | string | null)[];
  /** funnel 6단계 [B25~B30]: 생산~계약 */
  funnelTotals: number[];
  /** 5지표 % [H25~H29]: DB퀄리티/컨택성공률/미팅실행률/미팅숙련도/영업생산성 */
  productivity: number[];
  /** 8주 + 합계 [C33:H41]: 8 row × 6 col (생산/유입/컨택/미팅/계약/활동량) */
  weekly: number[][];
  /** 4채널 × (채널, 생산, 계약, 계약단가) [B45:E48] */
  channelPerf: (string | number)[][];
}

const TAB = SHEET_RANGES.dashboard.tab; // "대시보드(자동작성)"

function tabRef(t: string) {
  return /[ ()]/.test(t) ? `'${t}'` : t;
}

export async function readDashboard(
  spreadsheetId: string,
): Promise<DashboardSheetData> {
  const ranges = [
    `${tabRef(TAB)}!B21:G21`, // finance
    `${tabRef(TAB)}!B25:B30`, // funnel totals (6 stages)
    `${tabRef(TAB)}!H25:H29`, // 5 indicators
    `${tabRef(TAB)}!C33:H40`, // weekly 8 rows × 6 cols
    `${tabRef(TAB)}!B45:E48`, // channel perf 4 rows × 4 cols
  ];

  const res = await sheetsClient().spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const get = (i: number) => res.data.valueRanges?.[i]?.values ?? [];

  // helper — number 또는 0 (DIV/0! 같은 에러 문자열 → 0)
  const num = (v: unknown): number =>
    typeof v === "number" && Number.isFinite(v) ? v : 0;

  return {
    finance: (get(0)[0] ?? []).slice(0, 6).map((v) =>
      typeof v === "number" || typeof v === "string" ? v : null,
    ),
    funnelTotals: get(1).map((row) => num(row[0])),
    productivity: get(2).map((row) => num(row[0])),
    weekly: get(3).map((row) => Array.from({ length: 6 }, (_, i) => num(row[i]))),
    channelPerf: get(4).map((row) => [
      String(row[0] ?? ""),
      num(row[1]),
      num(row[2]),
      typeof row[3] === "number" ? row[3] : 0,
    ]),
  };
}
