/**
 * Layer: service — 대시보드 유스케이스 (read-only).
 *
 * SSOT: docs/domains/data-model.md §대시보드 데이터 출처
 *
 * 흐름 (시트 wiring 완료 2026-05-08):
 *   email → findUserByEmail → spreadsheetId
 *        → readDashboard(spreadsheetId) (1회 batchGet 5 ranges)
 *        → cell → DashboardView 매핑
 *
 * 시트 데이터 위치 (대시보드(자동작성) 탭):
 *   I.   재무        B21:G21
 *   II.  funnel 합계  B25:B30 (6단계)
 *   II.  5지표       H25:H29 (시트 % 그대로 사용)
 *   III. 8주차       C33:H40 (8 row × 6 col)
 *   IV.  채널별 성과  B45:E48 (4채널 × 생산/계약/계약단가)
 *
 * 채널별 6단계 stacking 데이터는 시트에 없음 (Phase 2 — 별도 wiring).
 * 현재 funnel 채널 분배는 채널별 계약 비율로 추정 (정확치 X, 시각용).
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

  // === KPI: 시트 B21~G21 (수임비, 수수료, 총매출, 총비용, 영업이익, 영업이익률) ===
  const fee = num(data.finance[0]);
  const revenue = num(data.finance[2]);
  const cost = num(data.finance[3]);
  const profit = num(data.finance[4]);
  // 시트 G21 영업이익률은 0~1 (소수) 또는 % (정수). 0~1이면 *100.
  const rateRaw = num(data.finance[5]);
  const profitRate = rateRaw <= 1 ? rateRaw * 100 : rateRaw;

  // === Funnel 합계: 시트 B25~B30 (생산/유입/컨택/미팅예약/미팅완료/계약) ===
  const 유입T = num(data.funnelTotals[1]);
  const 컨택T = num(data.funnelTotals[2]);
  const 미팅예약T = num(data.funnelTotals[3]);
  const 미팅완료T = num(data.funnelTotals[4]);

  // === 채널별 성과: B45~E48 (생산/계약/계약단가) ===
  // matrix 6단계 중 시트에 직접 있는 것은 생산/계약뿐.
  // 나머지 4단계 (유입/컨택/미팅예약/미팅완료)는 채널별 계약 비율로 비례 분배.
  // (정확하진 않지만 stacked funnel 시각화용 — Phase 2 에서 정확화)
  const perfByChannel = new Map<string, { 생산: number; 계약: number; 단가: number }>();
  for (const row of data.channelPerf) {
    const [name, 생산, 계약, 단가] = row;
    perfByChannel.set(String(name), {
      생산: num(생산),
      계약: num(계약),
      단가: num(단가),
    });
  }

  // 시트 채널명 → 코드 채널명 매핑
  const sheetToCh: Record<string, DashboardChannelMatrix["채널"]> = {
    매입DB: "매입DB",
    직접생산: "직접생산",
    현수막: "현수막",
    "지인,기고객,소개": "콜·지·기·소",
    "콜·지·기·소": "콜·지·기·소",
  };

  type ChVals = { 생산: number; 계약: number; 단가: number };
  const resolved: Record<DashboardChannelMatrix["채널"], ChVals> = Object.fromEntries(
    CHANNELS.map((c) => [c, { 생산: 0, 계약: 0, 단가: 0 }]),
  ) as Record<DashboardChannelMatrix["채널"], ChVals>;
  for (const [sheetName, vals] of perfByChannel) {
    const ch = sheetToCh[sheetName];
    if (ch) resolved[ch] = vals;
  }

  // 채널 분배 비율 (계약 우선, 없으면 생산 기준)
  const totalContract = CHANNELS.reduce((s, c) => s + resolved[c].계약, 0);
  const totalProduction = CHANNELS.reduce((s, c) => s + resolved[c].생산, 0);
  const denom = totalContract || totalProduction || 1;
  const ratio = (ch: DashboardChannelMatrix["채널"]) =>
    (totalContract > 0 ? resolved[ch].계약 : resolved[ch].생산) / denom;

  const channelMatrix: DashboardChannelMatrix[] = CHANNELS.map((ch) => {
    const r = ratio(ch);
    return {
      채널: ch,
      생산: resolved[ch].생산,
      유입: Math.round(유입T * r),
      컨택진행: Math.round(컨택T * r),
      미팅예약: Math.round(미팅예약T * r),
      미팅완료: Math.round(미팅완료T * r),
      계약: resolved[ch].계약,
    };
  });

  // === 8주차: C33~H40 — 6번째 컬럼 = 활동량 ===
  const weeklyTrend = data.weekly.map((row, i) => ({
    주차: i + 1,
    영업이익: 0, // 시트에 주차별 영업이익 없음 — Phase 2
    활동량: num(row[5]),
  }));
  while (weeklyTrend.length < 8) {
    weeklyTrend.push({ 주차: weeklyTrend.length + 1, 영업이익: 0, 활동량: 0 });
  }

  // === 비용 분해: 시트에 채널별 비용 직접 없음 — Phase 2 (03 DB관리 탭) ===
  const costBreakdown: DashboardCostBreakdown[] = [
    { 채널: "매입DB", 비용: 0 },
    { 채널: "직접생산", 비용: 0 },
    { 채널: "현수막", 비용: 0 },
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
    weeklyTrend: weeklyTrend.slice(0, 8),
    costBreakdown,
    콜지기소수임비: 0, // Phase 2
  };
}
