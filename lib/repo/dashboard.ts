/**
 * Layer: repo — 대시보드 view 데이터 수집 (read-only).
 *
 * SSOT: docs/domains/sheet-structure.md
 * 시트 데이터 출처 (사용자 결정 2026-05-08):
 *
 * 01 영업관리 탭:
 *   E1:E6 — funnel 6단계 합계 (생산/유입/컨택/미팅예약/미팅완료/계약)
 *   I2:I6 — 5지표 % (DB퀄리티/컨택성공률/미팅실행률/미팅숙련도/영업생산성)
 *   K3:L6 — 채널별 (생산총합, 계약총합) — 4채널
 *   N{38,72,106,140,174,208,242,276} — 주차별 계약수 (1~8주, stride 34)
 *   R1:U6 — 채널별 6단계 stacking matrix (사용자가 박은 24셀)
 *           rows: 1=생산, 2=유입, 3=컨택, 4=미팅예약, 5=미팅완료, 6=계약
 *           cols: R=매입DB, S=직접생산, T=현수막, U=콜·지·기·소
 *
 * 대시보드(자동작성) 탭:
 *   B21:G21 — 재무 (수임비/수수료/매출/비용/이익/이익률)
 *   C33:H40 — 8주차 활동량 (6번째 컬럼)
 *
 * 03 DB관리 비용은 별도 — `lib/service/dashboard.ts` 가 db.ts 의 readPurchases /
 * readProductions / readBanners 로 raw row 합산 (2026-05-15 사고: 김미란 시트
 * F56/K56/U56 SUM 수식 누락으로 대시보드 비용 0 → 시트 템플릿 의존 제거, 서버 단일진실원천).
 *
 * 1회 batchGet 으로 영업관리 + 대시보드 영역 read.
 */
import { sheetsClient } from "./sheets-client";
import { SHEET_RANGES } from "@/config";
import { STATS_WEEKS } from "@/config/cohort-dates";

export interface DashboardSheetData {
  /** 대시보드 B21:G21 재무: 수임비, 수수료, 총매출, 총비용, 영업이익, 영업이익률 */
  finance: number[];
  /** 01 영업관리!E1:E6 funnel 6단계 합계 */
  funnelTotals: number[];
  /** 01 영업관리!I2:I6 5지표 % */
  productivity: number[];
  /** 01 영업관리!K3:L6 채널별 (생산, 계약) — 4채널 */
  channelKL: { 생산: number; 계약: number }[];
  /** 01 영업관리!R1:U6 채널별 6단계 stacking — [stage][channel] (6행 × 4열) */
  channelStacking: number[][];
  /** 01 영업관리 N{38,72,...,276} 주차별 계약수 — 8개 */
  weeklyContracts: number[];
  /** 대시보드 C33:H40 8주차 활동량 (6번째 컬럼) */
  weeklyActivity: number[];
}

const SALES_TAB = SHEET_RANGES.sales.tab;
const DASH_TAB = SHEET_RANGES.dashboard.tab;

function tabRef(t: string) {
  return /[ ()]/.test(t) ? `'${t}'` : t;
}

// 주차별 계약수(N) 행: blockStart(10)+28=38 부터 stride 34 — [38,72,…,276] (STATS_WEEKS 파생)
const WEEK_ROWS = Array.from({ length: STATS_WEEKS }, (_, i) => 38 + i * 34);

const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

/** 주차별 5지표 (대시보드 C33:H40 의 C~G = 생산/유입/컨택/미팅/계약). 활동량(H) 제외. */
export interface WeeklyPerf {
  week: number;
  생산: number;
  유입: number;
  컨택: number;
  미팅: number;
  계약: number;
}

/** 전광판용 — 대시보드 'III. 주차별 성과'(C33:H40) 에서 8주 × 5지표 read (read-only). */
export async function readWeeklyPerformance(
  spreadsheetId: string,
): Promise<WeeklyPerf[]> {
  const res = await sheetsClient().spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: [`${tabRef(DASH_TAB)}!C33:H40`],
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const rows = res.data.valueRanges?.[0]?.values ?? [];
  return Array.from({ length: STATS_WEEKS }, (_, w) => {
    const row = rows[w] ?? [];
    return {
      week: w + 1,
      생산: num(row[0]),
      유입: num(row[1]),
      컨택: num(row[2]),
      미팅: num(row[3]),
      계약: num(row[4]),
    };
  });
}

/** 01 영업관리!R1:U6 채널별 6단계 stacking 만 단독 read (loadDay 경량 사용). [stage][channel].
 *  stage 0=생산·1=유입·…, channel 0=매입DB·1=직접생산·2=현수막·3=콜지기소. */
export async function readChannelStacking(spreadsheetId: string): Promise<number[][]> {
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: `${tabRef(SALES_TAB)}!R1:U6`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const raw = res.data.values ?? [];
  return Array.from({ length: 6 }, (_, r) =>
    Array.from({ length: 4 }, (_, c) => num(raw[r]?.[c])),
  );
}

export async function readDashboard(
  spreadsheetId: string,
): Promise<DashboardSheetData> {
  const ranges = [
    `${tabRef(DASH_TAB)}!B21:G21`, // [0] 재무
    `${tabRef(SALES_TAB)}!E1:E6`, // [1] funnel 합계
    `${tabRef(SALES_TAB)}!I2:I6`, // [2] 5지표
    `${tabRef(SALES_TAB)}!K3:L6`, // [3] 채널별 K/L (생산/계약 합계)
    `${tabRef(SALES_TAB)}!R1:U6`, // [4] 채널별 6단계 stacking
    ...WEEK_ROWS.map((r) => `${tabRef(SALES_TAB)}!N${r}`), // [5..12] 주차별 계약수
    `${tabRef(DASH_TAB)}!C33:H40`, // [13] 8주차 활동량
  ];

  const res = await sheetsClient().spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const get = (i: number) => res.data.valueRanges?.[i]?.values ?? [];

  const finance = (get(0)[0] ?? []).slice(0, 6).map(num);
  const funnelTotals = get(1).map((row) => num(row[0]));
  const productivity = get(2).map((row) => num(row[0]));
  const channelKL = get(3).map((row) => ({
    생산: num(row[0]),
    계약: num(row[1]),
  }));
  // R1:U6 → 6행 × 4열, 각 행 = [매입DB, 직접생산, 현수막, 콜지기소]
  const stackingRaw = get(4);
  const channelStacking = Array.from({ length: 6 }, (_, r) =>
    Array.from({ length: 4 }, (_, c) => num(stackingRaw[r]?.[c])),
  );

  const weeklyContracts = WEEK_ROWS.map((_, i) => num(get(5 + i)[0]?.[0]));
  const weeklyActivity = get(13).map((row) => num(row[5]));

  return {
    finance,
    funnelTotals,
    productivity,
    channelKL,
    channelStacking,
    weeklyContracts,
    weeklyActivity,
  };
}
