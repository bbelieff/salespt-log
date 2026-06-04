/**
 * Layer: service — 대시보드 유스케이스 (read-only).
 *
 * SSOT: docs/domains/data-model.md §대시보드 데이터 출처
 *
 * 매핑 (사용자 결정 2026-05-08):
 *   - KPI 누적수임비: 대시보드 B21 (수임비 cell — 시트 수식 유지)
 *   - Funnel:     01 영업관리!E1:E6 (6단계 합계)
 *   - 5지표:     01 영업관리!I2:I6 (시트 자체 계산)
 *   - 채널 6단계 stacking: 01 영업관리!R1:U6 (6단계×4채널 24셀)
 *   - 주차별 계약수: 01 영업관리!N{38,72,106,140,174,208,242,276}
 *   - 주차별 활동량: 대시보드 C33:H40 (6번째 컬럼)
 *   - 채널 비용: 03 DB관리 raw row 합산 (db.ts readPurchases/readProductions/readBanners).
 *     **2026-05-15 변경 (김미란 사고)**: 옛 F56/K56/U56 SUM cell 의존 → 서버 sum 으로 교체.
 *     일부 시트 (예: 김미란) 에 SUM 수식이 없거나 잘못된 경우에도 정확한 비용 계산 보장.
 *   - **총매출 (2026-05-16 변경, 수납↔대시보드 매출 불일치 사고)**:
 *     옛 대시보드!D21 (시트 수식) 의존 → `readAll(contract-payment)` row 수임비 합산.
 *     PR #195 비용 통일 패턴과 동일 — 시트 템플릿마다 D21 수식이 N행 합 한도가 다르거나
 *     특정 row 누락하는 케이스 발견 → 수납탭 표시 총매출과 대시보드 KPI 매출이 어긋남.
 *     서버에서 02 계약수납관리 row 직접 합산이 단일 진실원천.
 *   - 콜·지·기·소 수임비 박스: 제거 (사용자 결정)
 */
import type {
  DashboardView,
  DashboardChannelMatrix,
  DashboardCostBreakdown,
  ContractPayment,
} from "@/types";
import { findUserByEmail } from "@/repo/users";
import { readDashboard } from "@/repo/dashboard";
import { readBanners, readProductions, readPurchases } from "@/repo/db";
import { readAll as readContractPayments } from "@/repo/contract-payment";

const CHANNELS: DashboardChannelMatrix["채널"][] = [
  "매입DB",
  "직접생산",
  "현수막",
  "콜·지·기·소",
];

const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

/**
 * 총매출 = 수임비합 + 수수료합(수납1/2/3 수납액). 수납탭(payment/page.tsx)의
 * totalRevenue = totalContract + totalReceived 와 **동일 정의** → 두 화면 매출 일치.
 * (과거: 대시보드가 수임비만 합산해 수수료 누락 → 수납탭과 어긋남.)
 */
export function computeContractRevenue(payments: ContractPayment[]): {
  totalFee: number;
  totalReceived: number;
  revenue: number;
} {
  let totalFee = 0;
  let totalReceived = 0;
  for (const p of payments) {
    totalFee += num(p.수임비);
    totalReceived +=
      num(p.수납1.수납액) + num(p.수납2.수납액) + num(p.수납3.수납액);
  }
  return { totalFee, totalReceived, revenue: totalFee + totalReceived };
}

export async function loadDashboard(email: string): Promise<DashboardView> {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`[dashboard] 사용자(${email})를 찾을 수 없습니다.`);

  // 영업관리/대시보드 + 03 DB관리 raw row 4개 영역 병렬 read.
  // **db.ts 의 readPurchases/readProductions/readBanners 가 비용 단일 진실원천**:
  //   - readPurchases: 매입DB B:G — 주문금액(F) 합 = 매입DB 비용
  //   - readProductions: 직접생산 I:N — 기간예산(K) 합 = 직접생산 비용
  //   - readBanners: 현수막 P:V — 주문금액(U) 합 = 현수막 비용
  // 옛 F56/K56/U56 SUM cell 의존 제거 — 시트 템플릿마다 SUM 수식 유무 차이로 비용 0
  // 표시되던 사고 (2026-05-15, 김미란 케이스) 원천 차단.
  const [data, purchases, productions, banners, payments] = await Promise.all([
    readDashboard(user.spreadsheetId),
    readPurchases(user.spreadsheetId),
    readProductions(user.spreadsheetId),
    readBanners(user.spreadsheetId),
    readContractPayments(user.spreadsheetId),
  ]);

  const purchaseCost = purchases.rows.reduce((s, p) => s + num(p.주문금액), 0);
  const productionCost = productions.rows.reduce(
    (s, p) => s + num(p.기간예산),
    0,
  );
  const bannerCost = banners.rows.reduce((s, b) => s + num(b.주문금액), 0);
  const costByChannel = [purchaseCost, productionCost, bannerCost];

  // === KPI: 누적수임비 (시트 B21) + 매출 (서버 sum) + 비용 (서버 sum) ===
  // 매출은 02 계약수납관리 row 수임비 합 (단일 진실원천, 2026-05-16):
  //   - 옛 D21 시트 수식: 일부 양식에서 row 누락 / 범위 불일치 (수납탭과 어긋남)
  //   - 서버 sum: 수납탭이 표시하는 동일 row 데이터원천 → 절대 어긋날 수 없음
  // 이익은 매출 − 3채널 비용으로 재계산해 정합성 유지.
  const fee = num(data.finance[0]);
  // 총매출 = 수임비합 + 수수료합 (수납탭 SSOT 동일). 수수료(수납액) 누락 버그 수정.
  const { totalFee, totalReceived, revenue } = computeContractRevenue(payments);
  const cost = costByChannel.reduce((s, c) => s + c, 0);
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

  // === 비용 분해: 03 DB관리 raw row sum ===
  const costBreakdown: DashboardCostBreakdown[] = [
    { 채널: "매입DB", 비용: purchaseCost },
    { 채널: "직접생산", 비용: productionCost },
    { 채널: "현수막", 비용: bannerCost },
  ];

  return {
    kpi: {
      영업이익: profit,
      영업이익률: profitRate,
      총매출: revenue,
      총비용: cost,
      누적수임비: fee,
      수임비합: totalFee,
      수수료합: totalReceived,
    },
    channelMatrix,
    weeklyTrend,
    costBreakdown,
    콜지기소수임비: 0, // 사용자 결정 2026-05-08: 박스 제거 (UI 무시)
  };
}
