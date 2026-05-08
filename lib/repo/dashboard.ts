/**
 * Layer: repo — 대시보드 view 데이터 수집 (read-only).
 *
 * SSOT: docs/domains/sheet-structure.md
 * 시트 데이터 출처 (사용자 결정 2026-05-08):
 *
 * 01 영업관리 탭:
 *   E1:E6 — funnel 6단계 합계 (생산/유입/컨택/미팅예약/미팅완료/계약)
 *   I2:I6 — 5지표 % (DB퀄리티/컨택성공률/미팅실행률/미팅숙련도/영업생산성)
 *   K3:L6 — 채널별 (생산총합, 계약총합) — 4 채널
 *   N{38,72,106,140,174,208,242,276} — 주차별 계약수 (1~8주, stride 34)
 *
 * 03 DB관리 탭:
 *   F56 — 매입DB 비용
 *   K56 — 직접생산 비용
 *   U56 — 현수막 비용
 *
 * 대시보드(자동작성) 탭:
 *   B21:G21 — 재무 (수임비/수수료/매출/비용/이익/이익률) — 영업관리 자체 집계 미러
 *   C33:H40 — 8주차 활동량 등 (활동량은 6번째 컬럼)
 *
 * 1회 batchGet 으로 모든 영역 read.
 */
import { sheetsClient } from "./sheets-client";
import { SHEET_RANGES } from "@/config";

export interface DashboardSheetData {
  /** 대시보드 B21:G21 재무: 수임비, 수수료, 총매출, 총비용, 영업이익, 영업이익률 */
  finance: number[];
  /** 01 영업관리!E1:E6 funnel 6단계 합계 (생산/유입/컨택/미팅예약/미팅완료/계약) */
  funnelTotals: number[];
  /** 01 영업관리!I2:I6 5지표 % (시트 자체 계산, 0~1 또는 0~100) */
  productivity: number[];
  /** 01 영업관리!K3:L6 채널별 (생산총합, 계약총합) — 4 채널 (매입DB/직접생산/현수막/콜지기소 순) */
  channelKL: { 생산: number; 계약: number }[];
  /** 01 영업관리 N{38,72,...,276} 주차별 계약수 — 8개 */
  weeklyContracts: number[];
  /** 대시보드 C33:H40 8주차 활동량 (6번째 컬럼) */
  weeklyActivity: number[];
  /** 03 DB관리 채널별 비용: [매입DB F56, 직접생산 K56, 현수막 U56] */
  costByChannel: number[];
}

const SALES_TAB = SHEET_RANGES.sales.tab; // "01 영업관리"
const DASH_TAB = SHEET_RANGES.dashboard.tab; // "대시보드(자동작성)"
const DB_TAB = SHEET_RANGES.dbManagement.tab; // "03 DB관리"

function tabRef(t: string) {
  return /[ ()]/.test(t) ? `'${t}'` : t;
}

/** 주차별 N행: 1주차=38, stride 34. */
const WEEK_ROWS = [38, 72, 106, 140, 174, 208, 242, 276];

const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

export async function readDashboard(
  spreadsheetId: string,
): Promise<DashboardSheetData> {
  const ranges = [
    `${tabRef(DASH_TAB)}!B21:G21`, // [0] 재무
    `${tabRef(SALES_TAB)}!E1:E6`, // [1] funnel 합계
    `${tabRef(SALES_TAB)}!I2:I6`, // [2] 5지표
    `${tabRef(SALES_TAB)}!K3:L6`, // [3] 채널별 K/L
    ...WEEK_ROWS.map((r) => `${tabRef(SALES_TAB)}!N${r}`), // [4..11] 주차별 계약
    `${tabRef(DASH_TAB)}!C33:H40`, // [12] 8주차 활동량
    `${tabRef(DB_TAB)}!F56`, // [13] 매입DB 비용
    `${tabRef(DB_TAB)}!K56`, // [14] 직접생산 비용
    `${tabRef(DB_TAB)}!U56`, // [15] 현수막 비용
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
  const weeklyContracts = WEEK_ROWS.map((_, i) => num(get(4 + i)[0]?.[0]));
  const weeklyActivity = get(12).map((row) => num(row[5]));
  const costByChannel = [
    num(get(13)[0]?.[0]),
    num(get(14)[0]?.[0]),
    num(get(15)[0]?.[0]),
  ];

  return {
    finance,
    funnelTotals,
    productivity,
    channelKL,
    weeklyContracts,
    weeklyActivity,
    costByChannel,
  };
}
