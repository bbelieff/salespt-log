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
import * as Sentry from "@sentry/nextjs";
import type {
  DashboardView,
  DashboardChannelMatrix,
  DashboardCostBreakdown,
  ContractPayment,
  Meeting,
  Channel,
} from "@/types";
import { findUserByEmail } from "@/repo/users";
import { resolveOwnArenaSheetId } from "@/repo/users-arena";
import { readDashboard } from "@/repo/dashboard";
import { readBanners, readProductions, readPurchases } from "@/repo/db";
import { readAll as readContractPayments } from "@/repo/contract-payment";
import { readProfileBundle } from "@/repo/sales";
import { dbEnabled, readSalesRowsFromDb } from "@/repo/db/client";
import { readContractsFromDb, readMeetingsFromDb } from "@/repo/db/read-daily";
import { readDbTabFromDb } from "@/repo/db/read-db-tab";
import { captureServerEvent } from "@/lib/analytics/api-timing";
import { isCarryoverContract } from "./contract-payment";
import { findByDateRange } from "@/repo/meetings";
import { terminatedByChannel } from "./termination-count";
import { chooseDailySource } from "./daily-source";
import { computeDbAggregates, diffDashboardAggregates } from "./dashboard-aggregates";

const CHANNELS: DashboardChannelMatrix["채널"][] = [
  "매입DB",
  "직접생산",
  "현수막",
  "콜·지·기·소",
];

const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

/**
 * 총매출 = 수임비합 + 수수료합(수납1/2/3 수납액) − 반환액합(계약해지, contract-termination).
 * 수납탭(payment/page.tsx)의 totalRevenue 와 **동일 정의** → 두 화면 매출 일치.
 * 해지 계약도 수임비·수납은 그대로 합산하고 **반환액만 차감**(soft delete 여도 유지 — 스펙).
 * (과거: 대시보드가 수임비만 합산해 수수료 누락 → 수납탭과 어긋남.)
 */
export function computeContractRevenue(payments: ContractPayment[]): {
  totalFee: number;
  totalReceived: number;
  totalRefunded: number;
  revenue: number;
} {
  let totalFee = 0;
  let totalReceived = 0;
  let totalRefunded = 0;
  for (const p of payments) {
    // 이월(AI=이월) 계약은 아레나로 넘어간 것 — 본인(옛 기수) 매출·영업이익에서
    // 제외(carryover-profit §1). 시트 수식(02!D3)·서비스 레이어 합산 일관.
    if (p.구분 === "이월") continue;
    totalFee += num(p.수임비);
    totalReceived +=
      num(p.수납1.수납액) + num(p.수납2.수납액) + num(p.수납3.수납액);
    totalRefunded += num(p.반환액);
  }
  return {
    totalFee,
    totalReceived,
    totalRefunded,
    revenue: totalFee + totalReceived - totalRefunded,
  };
}

export interface RevenueParts {
  totalFee: number; // Σ수임비
  totalReceived: number; // Σ수납액(수수료)
  totalRefunded: number; // Σ반환액(계약해지)
  revenue: number; // = totalFee + totalReceived − totalRefunded
}

/**
 * 시작일(courseStart) 기준 매출 2분할 — 아레나 집계 vs 이월(비집계) + 전체
 * (arena-start-revenue-split §B). 판정은 단일 결정점 isCarryoverContract
 * (깃발 OR 계약일<시작일). 점수·전광판은 arena 만 쓰고, 대시보드는 3값 모두 표시.
 */
export function splitContractRevenue(
  payments: ContractPayment[],
  courseStartISO: string,
): { arena: RevenueParts; carryover: RevenueParts; total: RevenueParts } {
  const arena: RevenueParts = { totalFee: 0, totalReceived: 0, totalRefunded: 0, revenue: 0 };
  const carryover: RevenueParts = { totalFee: 0, totalReceived: 0, totalRefunded: 0, revenue: 0 };
  for (const p of payments) {
    const t = isCarryoverContract(p, courseStartISO) ? carryover : arena;
    t.totalFee += num(p.수임비);
    t.totalReceived +=
      num(p.수납1.수납액) + num(p.수납2.수납액) + num(p.수납3.수납액);
    t.totalRefunded += num(p.반환액); // 계약해지 반환 — 매출 차감(contract-termination)
  }
  arena.revenue = arena.totalFee + arena.totalReceived - arena.totalRefunded;
  carryover.revenue = carryover.totalFee + carryover.totalReceived - carryover.totalRefunded;
  const total: RevenueParts = {
    totalFee: arena.totalFee + carryover.totalFee,
    totalReceived: arena.totalReceived + carryover.totalReceived,
    totalRefunded: arena.totalRefunded + carryover.totalRefunded,
    revenue: arena.revenue + carryover.revenue,
  };
  return { arena, carryover, total };
}

/** Date → "YYYY-MM-DD" (로컬 기준). courseStart 비교용. */
function toISODate(d: Date): string {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 수강생출신 트레이너의 아레나 self-view override sheetId 결정(P14). trainer 행일 때
 * 본인 이메일의 활성 아레나 행 우선, 이름 매칭 폴백(me.ts 토글과 동일 resolver). */
export async function resolveArenaOverride(
  email: string,
): Promise<string | undefined> {
  const u = await findUserByEmail(email);
  if (u?.role !== "trainer") return undefined;
  return (await resolveOwnArenaSheetId(email, u.name)) ?? undefined;
}

/** 해석된 입력(시트/DB 공용) → DashboardView 조립. 매출 split·이익·주차·비용 분해는 동일. */
function assembleView(input: {
  courseStartISO: string;
  fee: number; // 누적수임비 (시트 B21 or DB 재계산)
  channelMatrix: DashboardChannelMatrix[]; // 4채널 6단계
  weeklyContracts: number[]; // 8주
  weeklyActivity: number[]; // 8주
  costByChannel: number[]; // [매입DB, 직접생산, 현수막]
  payments: ContractPayment[];
}): DashboardView {
  const split = splitContractRevenue(input.payments, input.courseStartISO);
  const { totalFee, totalReceived, revenue } = split.arena;
  const cost = input.costByChannel.reduce((s, c) => s + c, 0);
  const profit = revenue - cost;
  const profitRate = revenue > 0 ? (profit / revenue) * 100 : 0;
  const weeklyTrend = Array.from({ length: 8 }, (_, i) => ({
    주차: i + 1,
    계약수: num(input.weeklyContracts[i]),
    활동량: num(input.weeklyActivity[i]),
  }));
  const [pc, prc, bc] = input.costByChannel;
  return {
    kpi: {
      영업이익: profit,
      영업이익률: profitRate,
      총매출: revenue,
      총비용: cost,
      누적수임비: input.fee,
      수임비합: totalFee,
      수수료합: totalReceived,
      이월매출: split.carryover.revenue,
      전체매출: split.total.revenue,
    },
    channelMatrix: input.channelMatrix,
    weeklyTrend,
    costBreakdown: [
      { 채널: "매입DB", 비용: num(pc) },
      { 채널: "직접생산", 비용: num(prc) },
      { 채널: "현수막", 비용: num(bc) },
    ],
    콜지기소수임비: 0,
  };
}

export async function loadDashboard(
  email: string,
  overrideSheetId?: string,
): Promise<DashboardView> {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`[dashboard] 사용자(${email})를 찾을 수 없습니다.`);
  // 수강생출신 트레이너의 "내 아레나 일지" self-view — 본인 아레나 시트로 override(P14).
  const sheetId = overrideSheetId || user.spreadsheetId;

  // R2-7b: 파일럿 기수는 DB 집계 서빙(대시보드 시트 왕복 0). 실패 시 시트 경로로 강등
  // (안전밸브 — 사용자 화면 에러 금지). 서빙=DB 후에도 역방향 그림자로 시트 대조 감시(R3 전까지).
  if (chooseDailySource(user.cohort, dbEnabled()) === "db") {
    try {
      const { view, termByChannel } = await loadDashboardFromDb(sheetId, user.courseStartISO);
      reverseShadowCompare(sheetId, view); // 서빙=DB raw 로 시트 대조(async 감시) — 오버레이 前
      // 해지 계약수 제외: 그림자 dispatch 이후 렌더 직전 오버레이(원본 view 무변 → diff 0 사수).
      return applyTerminationExclusion(view, termByChannel);
    } catch (e) {
      Sentry.captureException(e, { tags: { where: "loadDashboard-db-serve" } });
      // ↓ 시트 경로로 강등
    }
  }

  return loadDashboardFromSheet(sheetId);
}

/** DB 서빙 경로 (R2-7b) — 대시보드 시트 read 0. 집계·비용·매출 전부 DB 미러에서. */
async function loadDashboardFromDb(
  sheetId: string,
  courseStartISOCache?: string,
): Promise<{ view: DashboardView; termByChannel: Record<Channel, number> }> {
  const courseStart = courseStartISOCache
    ? new Date(`${courseStartISOCache}T00:00:00`)
    : (await readProfileBundle(sheetId)).courseStart;
  const courseStartISO = toISODate(courseStart);
  const [salesRows, meetings, contracts, dbTab] = await Promise.all([
    readSalesRowsFromDb(sheetId),
    readMeetingsFromDb(sheetId),
    readContractsFromDb(sheetId),
    readDbTabFromDb(sheetId),
  ]);
  const agg = computeDbAggregates(salesRows, meetings, contracts, courseStart, courseStartISO);
  const purchaseCost = dbTab.purchases.reduce((s, p) => s + num(p.주문금액), 0);
  const productionCost = dbTab.productions.reduce((s, p) => s + num(p.기간예산), 0);
  const bannerCost = dbTab.banners.reduce((s, b) => s + num(b.주문금액), 0);
  const view = assembleView({
    courseStartISO,
    fee: agg.누적수임비,
    channelMatrix: agg.channelMatrix,
    weeklyContracts: agg.weeklyContracts,
    weeklyActivity: agg.weeklyActivity,
    costByChannel: [purchaseCost, productionCost, bannerCost],
    payments: contracts,
  });
  // 해지 계약수 오버레이 입력(채널별 차감) — 미팅은 이미 손안(추가 read 0).
  const term = terminatedByChannel(contracts, meetings);
  if (term.unknown > 0) {
    captureServerEvent("dashboard_term_unknown", { count: term.unknown, path: "db" });
  }
  return { view, termByChannel: term.byChannel };
}

/** 역방향 그림자 감시 (R2-7b) — 서빙=DB 후 시트 대시보드 값을 async 대조. diff 시 Sentry 경보
 * (안전밸브: 사후 알림 — R3 전까지 감시 지속). fire-and-forget, 응답 무영향. */
function reverseShadowCompare(sheetId: string, served: DashboardView): void {
  if (!dbEnabled()) return;
  void (async () => {
    const data = await readDashboard(sheetId);
    const stk = data.channelStacking;
    const sheetMatrix: DashboardChannelMatrix[] = CHANNELS.map((cName, ci) => ({
      채널: cName,
      생산: num(stk[0]?.[ci]), 유입: num(stk[1]?.[ci]), 컨택진행: num(stk[2]?.[ci]),
      미팅예약: num(stk[3]?.[ci]), 미팅완료: num(stk[4]?.[ci]), 계약: num(stk[5]?.[ci]),
    }));
    const diffs = diffDashboardAggregates(
      { channelMatrix: sheetMatrix, weeklyContracts: data.weeklyContracts, weeklyActivity: data.weeklyActivity, 누적수임비: num(data.finance[0]) },
      { channelMatrix: served.channelMatrix, weeklyContracts: served.weeklyTrend.map((w) => w.계약수), weeklyActivity: served.weeklyTrend.map((w) => w.활동량), 누적수임비: served.kpi.누적수임비 },
    );
    captureServerEvent("dashboard_parity_rev", { diffCount: diffs.length });
    if (diffs.length > 0) {
      // 서빙=DB 가 시트와 어긋남 — 규명 필요(사후 경보). 사용자별 강등 판단 입력.
      Sentry.captureMessage(`[dashboard-parity-rev] diff ${diffs.length}: ${diffs.slice(0, 5).map((d) => d.field).join(",")}`, "warning");
    }
  })().catch(() => { /* 감시 실패 무해 */ });
}

/** 시트 서빙 경로 (비파일럿 + DB 강등 fallback) — 기존 동작 무변경. */
async function loadDashboardFromSheet(sheetId: string): Promise<DashboardView> {
  const [data, purchases, productions, banners, payments, profile] =
    await Promise.all([
      readDashboard(sheetId),
      readPurchases(sheetId),
      readProductions(sheetId),
      readBanners(sheetId),
      readContractPayments(sheetId),
      readProfileBundle(sheetId),
    ]);
  const courseStartISO = toISODate(profile.courseStart);
  const purchaseCost = purchases.rows.reduce((s, p) => s + num(p.주문금액), 0);
  const productionCost = productions.rows.reduce((s, p) => s + num(p.기간예산), 0);
  const bannerCost = banners.rows.reduce((s, b) => s + num(b.주문금액), 0);
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
  const view = assembleView({
    courseStartISO,
    fee: num(data.finance[0]),
    channelMatrix,
    weeklyContracts: data.weeklyContracts,
    weeklyActivity: data.weeklyActivity,
    costByChannel: [purchaseCost, productionCost, bannerCost],
    payments,
  });
  // 해지 계약수 오버레이 — 시트경로는 채널귀속용 04 미팅이 없어 1회 read(읽기전용).
  // 그림자 없음(비파일럿 raw 서빙 무변) → 바로 오버레이. raw 파이프라인 무변.
  const meetings = await readCourseMeetings(sheetId, profile.courseStart);
  const term = terminatedByChannel(payments, meetings);
  if (term.unknown > 0) {
    captureServerEvent("dashboard_term_unknown", { count: term.unknown, path: "sheet" });
  }
  return applyTerminationExclusion(view, term.byChannel);
}

/** 채널귀속용 04 미팅 전량 read (시트경로 전용) — 수강기간(넉넉히 84일) 날짜 리스트로
 *  findByDateRange 재사용(1-read, meetings.ts 무수정). 범위 밖 미팅은 unknown 폴백. */
async function readCourseMeetings(
  sheetId: string,
  courseStart: Date,
): Promise<Meeting[]> {
  const dates: string[] = [];
  for (let i = 0; i < 84; i++) {
    const d = new Date(courseStart.getTime());
    d.setDate(d.getDate() + i);
    dates.push(toISODate(d));
  }
  const map = await findByDateRange(sheetId, dates, "meeting");
  return Array.from(map.values()).flat();
}

/** 렌더 직전 오버레이 — 해지 계약수를 channelMatrix.계약 에서 차감(음수 클램프).
 *  원본 view 를 mutate 하지 않고 새 DashboardView 반환(그림자 diff 0 사수 — 필수). */
export function applyTerminationExclusion(
  view: DashboardView,
  byChannel: Record<Channel, number>,
): DashboardView {
  let changed = false;
  const channelMatrix = view.channelMatrix.map((m) => {
    const sub = byChannel[m.채널] ?? 0;
    if (sub <= 0) return m;
    changed = true;
    return { ...m, 계약: Math.max(0, m.계약 - sub) };
  });
  return changed ? { ...view, channelMatrix } : view;
}
