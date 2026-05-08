/**
 * Layer: service — 대시보드 유스케이스 (read-only).
 *
 * SSOT: docs/domains/data-model.md §대시보드 데이터 출처
 *
 * 매핑 (사용자 결정 2026-05-08):
 *   - KPI:        대시보드 B21:G21
 *   - Funnel:     01 영업관리!E1:E6 (6단계 합계)
 *   - 5지표:     01 영업관리!I2:I6 (시트 자체 계산)
 *   - 채널 6단계 stacking: 01 영업관리!R1:U6 (6단계×4채널 24셀)
 *   - 주차별 계약수: 01 영업관리!N{38,72,106,140,174,208,242,276}
 *   - 주차별 활동량: 대시보드 C33:H40 (6번째 컬럼)
 *   - 채널 비용: 03 DB관리!F56/K56/U56
 *   - 콜·지·기·소 수임비 박스: 제거 (사용자 결정)
 */
import type {
  DashboardView,
  DashboardChannelMatrix,
  DashboardCostBreakdown,
} from "@/types";
import { findUserByEmail } from "@/repo/users";
import { readDashboard } from "@/repo/dashboard";

const CHANNELS: DashboardChannelMatrix["채널"][] = [
  "매입DB",
  "직접생산",
  "현수막",
  "콜·지·기·소",
];

const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

export async function loadDashboard(email: string): Promise<DashboardView> {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`[dashboard] 사용자(${email})를 찾을 수 없습니다.`);

  const data = await readDashboard(user.spreadsheetId);

  // === KPI: 대시보드 B21:G21 + 03 DB관리 비용 ===
  // 비용은 03 DB관리 채널별 합으로 직접 계산 (단일 진실원천).
  // 시트 대시보드!E21 수식이 콜·지·기·소 포함하거나 다른 row 참조 시
  // 메인 배너 비용 ↔ 채널별 비용 도넛이 어긋나는 문제를 원천 차단.
  // 이익은 매출 − 3채널 비용으로 재계산해 정합성 유지.
  const fee = num(data.finance[0]);
  const revenue = num(data.finance[2]);
  const cost = data.costByChannel.reduce((s, c) => s + num(c), 0);
  const profit = revenue - cost;
  const profitRate = revenue > 0 ? (profit / revenue) * 100 : 0;

  // === 채널별 6단계 stacking: 01 영업관리!R1:U6 (사용자 박은 24셀) ===
  // R1:U6 layout — 6행(단계) × 4열(채널: R=매입DB, S=직접생산, T=현수막, U=콜지기소)
  //   row 1=생산, 2=유입, 3=컨택진행, 4=미팅예약, 5=미팅완료, 6=계약
  const stk = data.channelStacking; // [stage 0~5][channel 0~3]
  const channelMatrix: DashboardChannelMatrix[] = CHANNELS.map((cName, ci) => ({
    채널: cName,
    생산: num(stk[0]?.[ci]),
    유입: num(stk[1]?.[ci]),
    컨택진행: num(stk[2]?.[ci]),
    미팅예약: num(stk[3]?.[ci]),
    미팅완료: num(stk[4]?.[ci]),
    계약: num(stk[5]?.[ci]),
  }));

  // === Weekly: 01 영업관리 주차별 계약수 + 대시보드 활동량 ===
  const weeklyTrend = Array.from({ length: 8 }, (_, i) => ({
    주차: i + 1,
    계약수: num(data.weeklyContracts[i]),
    활동량: num(data.weeklyActivity[i]),
  }));

  // === 비용 분해: 03 DB관리!F56/K56/U56 ===
  const costBreakdown: DashboardCostBreakdown[] = [
    { 채널: "매입DB", 비용: num(data.costByChannel[0]) },
    { 채널: "직접생산", 비용: num(data.costByChannel[1]) },
    { 채널: "현수막", 비용: num(data.costByChannel[2]) },
  ];

  return {
    kpi: {
      영업이익: profit,
      영업이익률: profitRate,
      총매출: revenue,
      총비용: cost,
      누적수임비: fee,
    },
    channelMatrix,
    weeklyTrend,
    costBreakdown,
    콜지기소수임비: 0, // 사용자 결정 2026-05-08: 박스 제거 (UI 무시)
  };
}
