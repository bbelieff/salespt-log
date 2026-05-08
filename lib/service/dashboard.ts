/**
 * Layer: service — 대시보드 유스케이스 (read-only).
 *
 * SSOT: docs/domains/data-model.md §대시보드 데이터 출처
 *
 * 매핑 (사용자 결정 2026-05-08):
 *   - KPI:        대시보드 B21:G21
 *   - Funnel:     01 영업관리!E1:E6 (6단계 합계)
 *   - 5지표:     01 영업관리!I2:I6 (시트 자체 계산)
 *   - 채널 생산/계약: 01 영업관리!K3:L6 (4채널)
 *   - 채널 유입/컨택/미팅예약/미팅완료: 시트 셀 미정 — 채널별 계약 비율로 비례 분배
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

  // === KPI: 대시보드 B21:G21 ===
  const fee = num(data.finance[0]);
  const revenue = num(data.finance[2]);
  const cost = num(data.finance[3]);
  const profit = num(data.finance[4]);
  const rateRaw = num(data.finance[5]);
  const profitRate = rateRaw <= 1 ? rateRaw * 100 : rateRaw;

  // === Funnel 합계: 01 영업관리!E1:E6 ===
  const 유입T = num(data.funnelTotals[1]);
  const 컨택T = num(data.funnelTotals[2]);
  const 미팅예약T = num(data.funnelTotals[3]);
  const 미팅완료T = num(data.funnelTotals[4]);

  // === 채널별 (생산/계약): 01 영업관리!K3:L6 — 매입DB/직접생산/현수막/콜지기소 순 ===
  // matrix 6단계 중 시트에 직접 있는 건 생산/계약뿐.
  // 나머지 4단계 (유입/컨택/미팅예약/미팅완료) = 채널별 계약 비율로 비례 분배 (Phase 2 정확화).
  const ch = data.channelKL;
  const totalContract = ch.reduce((s, c) => s + c.계약, 0);
  const totalProduction = ch.reduce((s, c) => s + c.생산, 0);
  const denom = totalContract || totalProduction || 1;
  const ratio = (i: number) =>
    (totalContract > 0 ? ch[i]?.계약 ?? 0 : ch[i]?.생산 ?? 0) / denom;

  const channelMatrix: DashboardChannelMatrix[] = CHANNELS.map((cName, i) => {
    const r = ratio(i);
    return {
      채널: cName,
      생산: ch[i]?.생산 ?? 0,
      유입: Math.round(유입T * r),
      컨택진행: Math.round(컨택T * r),
      미팅예약: Math.round(미팅예약T * r),
      미팅완료: Math.round(미팅완료T * r),
      계약: ch[i]?.계약 ?? 0,
    };
  });

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
      영업이익: profit || revenue - cost,
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
