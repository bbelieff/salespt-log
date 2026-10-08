/**
 * Layer: util (순수 — import 0). 기간별 매출·비용 집계의 단일 정의.
 *
 * 2026-10-08 belie: 화면의 매출은 아레나 포함 여부(이월)와 상관없이 **기간**으로만 본다.
 * 아레나 기준이 필요하면 「직접 설정」으로 날짜를 고른다. 아레나 순위표의 매출은
 * 서버 `splitContractRevenue().arena` 를 그대로 쓴다(이 파일과 무관) — ADR-0034.
 *
 * - 매출 = 수임비(계약일) + 수납액(수납일) − 반환액(해지일, 없으면 계약일). 해지 계약도
 *   수임비·수납은 그대로 두고 반환만 뺀다(ADR-0026·계약해지 규칙과 같다).
 * - 비용 = DB 비용(채널별 날짜에 전액) + 추가 비용(원장 — 기간 지출은 하루 단위로 나눠
 *   인식, 반복 지출은 발생일). 서버 대시보드·원장과 같은 배분 함수를 쓴다.
 * - range=null 은 「전체」= 기록된 기간 전체.
 */

export type FinancePeriod = "all" | "month" | "week" | "custom";
export type DateRange = readonly [string, string] | null;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isISO = (v: unknown): v is string => typeof v === "string" && ISO.test(v);
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const parseUtc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);

/** 오늘(KST) "YYYY-MM-DD" — 브라우저 시간대와 무관. */
export function todayKst(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * 기간 → [시작, 끝] (양끝 포함). 주 = 월~일, 달 = 1일~말일. 계산은 날짜 문자열만으로 해서
 * 브라우저 시간대에 흔들리지 않는다. 직접 설정은 두 날짜가 모두 있고 순서가 맞을 때만.
 */
export function periodBounds(period: FinancePeriod, customStart: string, customEnd: string, today: string): DateRange {
  if (period === "all") return null;
  if (period === "custom") return isISO(customStart) && isISO(customEnd) && customStart <= customEnd ? [customStart, customEnd] : null;
  const t = parseUtc(today);
  if (period === "month") {
    const end = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0));
    return [`${today.slice(0, 7)}-01`, toIso(end)];
  }
  const dow = t.getUTCDay() || 7;
  const mon = new Date(t); mon.setUTCDate(t.getUTCDate() - dow + 1);
  const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6);
  return [toIso(mon), toIso(sun)];
}

export const PERIOD_LABEL: Record<FinancePeriod, string> = {
  all: "전체",
  month: "이번 달",
  week: "이번 주",
  custom: "직접 설정",
};

/** 「직접 설정」인데 날짜가 덜 골라져 전체로 계산 중인지. */
export function customIncomplete(period: FinancePeriod, range: DateRange): boolean {
  return period === "custom" && range === null;
}

const inRange = (date: unknown, range: DateRange): boolean =>
  range === null || (isISO(date) && date >= range[0] && date <= range[1]);

export interface RevenueSlot { 수납액: number; 수납일: string }
export interface RevenueContract {
  계약일: string;
  수임비: number;
  수납1: RevenueSlot;
  수납2: RevenueSlot;
  수납3: RevenueSlot;
  반환액?: number;
  해지일?: string;
}

export interface PeriodRevenue {
  contracts: number;
  fee: number;
  received: number;
  refunded: number;
  revenue: number;
}

export function periodRevenue(rows: readonly RevenueContract[], range: DateRange): PeriodRevenue {
  let contracts = 0, fee = 0, received = 0, refunded = 0;
  for (const r of rows) {
    if (inRange(r.계약일, range)) {
      contracts += 1;
      fee += num(r.수임비);
    }
    for (const s of [r.수납1, r.수납2, r.수납3]) {
      if (s && inRange(s.수납일, range)) received += num(s.수납액);
    }
    const refund = num(r.반환액);
    if (refund > 0 && inRange(isISO(r.해지일) ? r.해지일 : r.계약일, range)) refunded += refund;
  }
  return { contracts, fee, received, refunded, revenue: fee + received - refunded };
}

export interface DbCostOverview {
  purchases?: ReadonlyArray<{ 구매일?: unknown; 주문금액?: unknown }>;
  productions?: ReadonlyArray<{ 시작일?: unknown; 기간예산?: unknown }>;
  banners?: ReadonlyArray<{ 날짜?: unknown; 주문금액?: unknown }>;
}

/**
 * DB 비용 — 서버 dashboard-cost-carryover 와 같은 날짜·금액: 매입DB 구매일·주문금액,
 * 직접생산 시작일·기간예산(ADR-0022 §3), 현수막 날짜·주문금액. 나눠 배분하지 않는다.
 * 날짜가 비었거나 깨진 행은 「전체」에서만 센다.
 */
export function periodDbCost(overview: DbCostOverview | undefined, range: DateRange): number {
  if (!overview) return 0;
  const rows: Array<{ date: unknown; amount: unknown }> = [
    ...(overview.purchases ?? []).map((p) => ({ date: p.구매일, amount: p.주문금액 })),
    ...(overview.productions ?? []).map((p) => ({ date: p.시작일, amount: p.기간예산 })),
    ...(overview.banners ?? []).map((b) => ({ date: b.날짜, amount: b.주문금액 })),
  ];
  return rows.reduce((sum, r) => sum + (inRange(r.date, range) ? num(r.amount) : 0), 0);
}

/** 양끝 포함, 나머지 원은 앞선 날에 배정한다. 서버 원장·대시보드와 같은 함수. */
export function allocateExpenseByDay(amountWon: number, periodStart: string, periodEnd: string): Array<{ date: string; amountWon: number }> {
  const days = Math.floor((parseUtc(periodEnd).getTime() - parseUtc(periodStart).getTime()) / 86_400_000) + 1;
  // NaN 가드 필수 — 날짜 문자열이 깨지면 days=NaN 이고 NaN 은 두 부등호를 모두 통과해
  // 빈 배열 → 인식금액 0 → 화면에서 조용히 사라진다(2026-07-28 P1 의 전파 경로).
  if (!Number.isFinite(days) || days < 1 || days > 3660) throw new Error("expense_invalid_period");
  const quotient = Math.floor(amountWon / days); const remainder = amountWon % days;
  const out: Array<{ date: string; amountWon: number }> = [];
  const d = parseUtc(periodStart);
  for (let i = 0; i < days; i += 1) { out.push({ date: toIso(d), amountWon: quotient + (i < remainder ? 1 : 0) }); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
}

export function recognizedAmountForRange(amountWon: number, start: string, end: string, rangeStart: string, through: string): number {
  return allocateExpenseByDay(amountWon, start, end).reduce((sum, d) => sum + (d.date >= rangeStart && d.date <= through ? d.amountWon : 0), 0);
}

export interface LedgerEntryLike {
  source: "one_time" | "recurring";
  amountWon: number;
  originalAmountWon?: number;
  periodStart: string;
  periodEnd: string;
}

/**
 * 추가 비용(원장) — `/api/expenses?view=all`(오늘까지 인식분) 항목을 기간으로 다시 자른다.
 * 기간 지출은 원래 전액을 하루 단위로 배분하고, 반복 지출은 발생일 하루에 전액. 미래는 세지 않는다.
 */
export function periodLedgerCost(entries: readonly LedgerEntryLike[] | undefined, range: DateRange, today: string): number {
  if (!entries) return 0;
  // 「전체」는 시작 제한 없음 — 가장 이른 기록일을 시작으로 쓴다(빈 문자열은 모든 날짜보다 앞).
  const rangeStart = range ? range[0] : "";
  const through = range ? (range[1] < today ? range[1] : today) : today;
  if (rangeStart > through) return 0;
  return entries.reduce((sum, e) => {
    if (e.source === "recurring") return sum + (e.periodStart >= rangeStart && e.periodStart <= through ? num(e.amountWon) : 0);
    const total = e.originalAmountWon ?? e.amountWon;
    try {
      return sum + recognizedAmountForRange(total, e.periodStart, e.periodEnd, rangeStart, through);
    } catch {
      return sum;
    }
  }, 0);
}
