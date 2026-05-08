/**
 * Layer: service — 대시보드 유스케이스 (read-only).
 *
 * SSOT: docs/domains/data-model.md §대시보드 데이터 출처
 *
 * 책임:
 *   1. email → spreadsheetId resolve
 *   2. 대시보드 탭 1회 batchGet
 *   3. cell → DashboardView 매핑
 *
 * 현재 상태 (2026-05-08):
 *   - 확정 셀: D21=총매출 (= '01 영업관리'!N6)
 *   - 미확정: E21(총비용), 채널별 6단계 24 cells, 8주차 16 cells, 비용 3 cells, 콜지기소 수임비
 *   - 미확정 셀은 prototype 더미값 fallback. 시트 디스커버리 후 매핑 보강.
 */
import type {
  DashboardView,
  DashboardKPI,
  DashboardChannelMatrix,
  DashboardWeeklyPoint,
  DashboardCostBreakdown,
} from "@/types";

/** prototype 더미값 — 시트 디스커버리 완료 시 실제 fetch로 교체. */
const PROTOTYPE_DUMMY: DashboardView = {
  kpi: {
    영업이익: 7_692_000,
    영업이익률: 61.6,
    총매출: 12_500_000,
    총비용: 4_808_000,
    누적수임비: 10_400_000,
  },
  channelMatrix: [
    { 채널: "매입DB", 생산: 162, 유입: 130, 컨택진행: 110, 미팅예약: 50, 미팅완료: 42, 계약: 8 },
    { 채널: "직접생산", 생산: 78, 유입: 78, 컨택진행: 65, 미팅예약: 32, 미팅완료: 28, 계약: 6 },
    { 채널: "현수막", 생산: 96, 유입: 50, 컨택진행: 45, 미팅예약: 14, 미팅완료: 12, 계약: 4 },
    { 채널: "콜·지·기·소", 생산: 24, 유입: 24, 컨택진행: 22, 미팅예약: 14, 미팅완료: 9, 계약: 5 },
  ],
  weeklyTrend: [
    { 주차: 1, 영업이익: -20, 활동량: 50 },
    { 주차: 2, 영업이익: -10, 활동량: 60 },
    { 주차: 3, 영업이익: 60, 활동량: 70 },
    { 주차: 4, 영업이익: 100, 활동량: 75 },
    { 주차: 5, 영업이익: 130, 활동량: 80 },
    { 주차: 6, 영업이익: 180, 활동량: 85 },
    { 주차: 7, 영업이익: 150, 활동량: 78 },
    { 주차: 8, 영업이익: 180, 활동량: 82 },
  ],
  costBreakdown: [
    { 채널: "매입DB", 비용: 2_800_000 },
    { 채널: "직접생산", 비용: 1_200_000 },
    { 채널: "현수막", 비용: 800_000 },
  ],
  콜지기소수임비: 2_100_000,
};

/**
 * 대시보드 view 로드.
 *
 * TODO (시트 디스커버리 후):
 *   - findUserByEmail → spreadsheetId
 *   - readDashboard(spreadsheetId) — 1회 batchGet "대시보드(자동작성)!A1:Z40"
 *   - cell(grid, "D21") → 총매출 등 매핑
 *   - 채널별 6단계는 영업관리 분해 영역 또는 04 업체관리 GROUPBY로 별도 fetch
 *
 * 현재: prototype 더미 그대로 반환 (UI 검증 우선, 데이터 wiring은 후속 PR).
 */
export async function loadDashboard(email: string): Promise<DashboardView> {
  // 시트 디스커버리 후 email → spreadsheetId → readDashboard 흐름으로 wiring.
  // 현재는 email 인자만 받고 prototype 더미 반환.
  void email;
  return PROTOTYPE_DUMMY;
}
