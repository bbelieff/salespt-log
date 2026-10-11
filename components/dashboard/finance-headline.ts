/**
 * 대시보드 매출·비용·영업이익 묶음의 한 줄 문장(belie 2026-10-12 #8) — 순수 함수, 새 조회 없음.
 *
 * 입력은 DashboardFinance 가 이미 계산한 기간 매출·비용 그대로다. 영업이익 = 매출 − 비용
 * (FinanceSummaryBoxes 와 같은 식)이고, 금액 문자열은 formatMoney(금액 표시 단일 원천)와 같은
 * 반올림을 거쳐 아래 영업이익 칸 숫자와 1원도 다르지 않다(손실은 절대값으로 말한다).
 * 추가 비용(경비장부)을 못 읽었으면 영업이익을 말하지 않는다 — 칸은 0원으로 계산하지만 문장은 사실만.
 *
 * lib/util 에 두지 않는 이유: lib/util 은 import 0 규칙(tests/structural/period-hardcode.test.ts)인데
 * formatMoney 를 써야 한다. SSOT: docs/design/components.md §9 「대시보드 한 줄 문장」.
 */
import { formatMoney } from "@/lib/format/money";
import type { DateRange, FinancePeriod } from "@/util/finance-period";
import type { Headline } from "@/components/ui/CardHeadline";

/**
 * 「전체」(그리고 날짜를 덜 고른 「직접 설정」 — 이때 숫자도 전체 기간이다) 접두어.
 * 미래 날짜로 미리 적은 수납·계약이 있으면 「지금까지」가 조금 앞서 말할 수 있어
 * 대안 「전체 기간에」를 목업 /headlines 에 나란히 두었다(belie 선택 대기, 계산은 같다).
 */
export const ALL_PERIOD_PREFIX = "지금까지";

export interface FinanceHeadlineInput {
  period: FinancePeriod;
  /** periodBounds 결과 — null 이면 전체 기간. */
  range: DateRange;
  revenue: number;
  cost: number;
  /** 추가 비용(경비장부)을 읽었는지. */
  additionalKnown: boolean;
}

/** 기간 칩 → 문장 접두어: 지금까지 / N월에 / 이번 주에 / 고른 기간에. */
export function financePrefix(period: FinancePeriod, range: DateRange): string {
  if (range === null) return ALL_PERIOD_PREFIX;
  if (period === "month") return `${Number(range[0].slice(5, 7))}월에`;
  if (period === "week") return "이번 주에";
  return "고른 기간에";
}

export function financeHeadline({ period, range, revenue, cost, additionalKnown }: FinanceHeadlineInput): Headline | null {
  if (!Number.isFinite(revenue) || !Number.isFinite(cost)) return null;
  const p = financePrefix(period, range);
  // 0·음수 판정만 매출·비용 각각 반올림, 영업이익은 칸과 같이 (매출 − 비용)을 한 번 반올림.
  const r = Math.round(revenue);
  const c = Math.round(cost);
  if (!additionalKnown) return r > 0 ? { text: `${p} 매출 ${formatMoney(revenue)}원을 올렸어요`, tone: "neutral" } : null;
  if (r === 0 && c === 0) return { text: `${p} 기록된 매출·비용이 없어요`, tone: "neutral" };
  if (r < 0) return { text: `${p} 계약해지 반환으로 매출이 마이너스예요`, tone: "loss" };
  const profit = Math.round(revenue - cost);
  if (profit > 0) return { text: `${p} ${formatMoney(profit)}원을 남겼어요`, emoji: "💰", tone: "profit" };
  if (profit === 0) return { text: `${p} 매출과 비용이 같아요`, tone: "neutral" };
  if (r === 0) return { text: `${p} 비용 ${formatMoney(cost)}원을 먼저 썼어요`, tone: "loss" };
  return { text: `${p} 비용이 매출보다 ${formatMoney(-profit)}원 많아요`, tone: "loss" };
}
