/**
 * Layer: types — 대시보드 view 타입(read-only 매핑용 인터페이스). 다른 레이어 import 안 함.
 * index.ts 배럴에서 재수출(2026-07-19, 500줄 캡 분리). 소비자는 `@/types` 유지.
 * SSOT: data-model.md §대시보드 데이터 출처.
 */

// ── Dashboard view types (PR 12 dashboard-page) ─────────────────
// SSOT: docs/domains/data-model.md §대시보드 데이터 출처
// 대시보드 탭은 read-only (시트 수식 자동 집계). 코드는 service에서 1회 batchGet 후 매핑.

/** 4 KPI 카드 — 영업이익/이익률/총매출/총비용/누적수임비 */
export interface DashboardKPI {
  영업이익: number; // = 총매출 − 총비용
  영업이익률: number; // (영업이익 / 총매출) × 100
  총매출: number; // 대시보드 D21 (= '01 영업관리'!N6)
  총비용: number; // 대시보드 E21 (좌표 디스커버리 필요)
  누적수임비: number; // TODO: 셀 좌표 디스커버리
  수임비합: number; // 총매출 분해: Σ수임비 (배너 표시)
  수수료합: number; // 총매출 분해: Σ수납액(수수료). 총매출 = 수임비합 + 수수료합
  이월매출: number; // 아레나 시작일 이전 계약(이월·비집계) 매출 — 표시용 (arena-start-revenue-split)
  전체매출: number; // 총매출(아레나) + 이월매출 — "전체" 줄
}

/** 채널별 6단계 funnel matrix — stacked bar 데이터 */
export interface DashboardChannelMatrix {
  채널: "매입DB" | "직접생산" | "현수막" | "콜·지·기·소";
  생산: number;
  유입: number;
  컨택진행: number;
  미팅예약: number; // 영업관리 H 채널별 합계
  미팅완료: number; // = 영업관리!L (시트 자동 집계, 상태 IN ["계약","완료"]) — 취소·변경 제외
  계약: number; // 04 업체관리 K=TRUE 채널별 COUNTIFS
}

/** 주차별 추이 — 8주 LineChart (사용자 결정 2026-05-08: 영업이익 → 계약수) */
export interface DashboardWeeklyPoint {
  주차: number; // 1~8
  계약수: number; // 시트 01 영업관리!N{38,72,106,140,174,208,242,276}
  활동량: number; // 시트 대시보드(자동작성) III. 주차별 마지막 컬럼
}

/** 비용 구성 — 3 비용 채널 (콜·지·기·소 제외) PieChart/Donut */
export interface DashboardCostBreakdown {
  채널: "매입DB" | "직접생산" | "현수막";
  비용: number; // 만원
}

/** 대시보드 1회 read 응답 — Recharts/카드에 그대로 매핑 가능. */
export interface DashboardView {
  kpi: DashboardKPI;
  /** Manual/recurring ledger contribution, separate from acquisition channels. */
  additionalCost: DashboardAdditionalCost;
  channelMatrix: DashboardChannelMatrix[]; // 길이 4
  weeklyTrend: DashboardWeeklyPoint[]; // 길이 8
  costBreakdown: DashboardCostBreakdown[]; // 길이 3
  /** 콜·지·기·소 수임비 별도 (도넛 외부 표시) */
  콜지기소수임비: number;
}

/** Explicit state prevents a failed ledger read from being represented as zero. */
export type DashboardAdditionalCost =
  | {
    status: "available";
    dbCostTotal: number;
    additionalCost: number;
    recognizedThrough: string;
  }
  | {
    status: "unavailable";
    dbCostTotal: number;
    additionalCost: null;
    recognizedThrough: string;
    errorCode: "expense_ledger_unavailable" | "expense_ledger_read_failed" | "expense_ledger_course_start_invalid";
  };
