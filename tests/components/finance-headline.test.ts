import { describe, expect, it } from "vitest";
import { ALL_PERIOD_PREFIX, financeHeadline, financePrefix } from "@/components/dashboard/finance-headline";
import { formatMoney } from "@/lib/format/money";
import type { DateRange, FinancePeriod } from "@/util/finance-period";

// belie 2026-10-12 #8 — 재무 묶음 한 줄 문장. 표 기반: 접두어 × 분기 × 반올림(칸과 같은 숫자).
const OCT: DateRange = ["2026-10-01", "2026-10-31"];
const WEEK: DateRange = ["2026-10-12", "2026-10-18"];
const CUSTOM: DateRange = ["2026-10-03", "2026-10-09"];

const h = (revenue: number, cost: number, o: { period?: FinancePeriod; range?: DateRange; additionalKnown?: boolean } = {}) =>
  financeHeadline({ period: o.period ?? "all", range: o.range ?? null, revenue, cost, additionalKnown: o.additionalKnown ?? true });

describe("financePrefix — 기간 칩 → 접두어", () => {
  it.each([
    ["all", null, "지금까지"],
    ["custom", null, "지금까지"], // 날짜를 덜 고르면 숫자도 전체 기간
    ["month", OCT, "10월에"],
    ["month", ["2026-03-01", "2026-03-31"], "3월에"],
    ["week", WEEK, "이번 주에"],
    ["custom", CUSTOM, "고른 기간에"],
  ] as const)("%s %j → %s", (period, range, prefix) => {
    expect(financePrefix(period, range)).toBe(prefix);
  });
  it("전체 접두어는 상수 하나로 바꾼다(대안 「전체 기간에」는 목업 비교용)", () => {
    expect(ALL_PERIOD_PREFIX).toBe("지금까지");
  });
});

describe("financeHeadline — 분기", () => {
  it("영업이익 > 0 → 남겼어요 💰 (profit)", () => {
    expect(h(1_500_000, 905_480)).toEqual({ text: "지금까지 594,520원을 남겼어요", emoji: "💰", tone: "profit" });
    expect(h(1_500_000, 905_480, { period: "month", range: OCT })?.text).toBe("10월에 594,520원을 남겼어요");
    expect(h(1_500_000, 905_480, { period: "week", range: WEEK })?.text).toBe("이번 주에 594,520원을 남겼어요");
    expect(h(1_500_000, 905_480, { period: "custom", range: CUSTOM })?.text).toBe("고른 기간에 594,520원을 남겼어요");
    expect(h(1_500_000, 905_480, { period: "custom", range: null })?.text).toBe("지금까지 594,520원을 남겼어요");
  });

  it("매출·비용 모두 0 → 기록 없음 (neutral)", () => {
    expect(h(0, 0)).toEqual({ text: "지금까지 기록된 매출·비용이 없어요", tone: "neutral" });
  });

  it("매출 0·비용 > 0 → 비용을 먼저 썼어요 (loss)", () => {
    expect(h(0, 300_000)).toEqual({ text: "지금까지 비용 300,000원을 먼저 썼어요", tone: "loss" });
  });

  it("매출 > 0·영업이익 < 0 → 비용이 매출보다 N원 많아요 (절대값, loss)", () => {
    expect(h(500_000, 620_000)).toEqual({ text: "지금까지 비용이 매출보다 120,000원 많아요", tone: "loss" });
  });

  it("영업이익 0 → 매출과 비용이 같아요 (neutral)", () => {
    expect(h(700_000, 700_000)).toEqual({ text: "지금까지 매출과 비용이 같아요", tone: "neutral" });
  });

  it("그 기간 반환이 커서 매출 < 0 → 반환 문구 (loss)", () => {
    expect(h(-1_000, 0)).toEqual({ text: "지금까지 계약해지 반환으로 매출이 마이너스예요", tone: "loss" });
    expect(h(-1_500_000, 300_000, { period: "month", range: OCT })?.text).toBe("10월에 계약해지 반환으로 매출이 마이너스예요");
  });

  it("추가 비용(경비장부)을 못 읽으면 영업이익 대신 매출만 — 매출 0 이하면 문장 없음", () => {
    expect(h(1_200_000, 300_000, { additionalKnown: false })).toEqual({ text: "지금까지 매출 1,200,000원을 올렸어요", tone: "neutral" });
    expect(h(0, 300_000, { additionalKnown: false })).toBeNull();
    expect(h(-5_000, 0, { additionalKnown: false })).toBeNull();
  });

  it("숫자가 아니면 문장 없음", () => {
    expect(h(Number.NaN, 0)).toBeNull();
    expect(h(0, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("8자리 금액도 콤마 전체 금액(축약 없음)", () => {
    expect(h(15_000_000, 2_654_322)?.text).toBe("지금까지 12,345,678원을 남겼어요");
  });
});

describe("financeHeadline — 영업이익 칸과 같은 반올림", () => {
  it("100.4 / 100.4 → 같아요", () => {
    expect(h(100.4, 100.4)?.text).toBe("지금까지 매출과 비용이 같아요");
  });

  it.each([
    [100.5, 0.4],
    [100.4, 0.5],
    [0.6, 100.5],
    [1_000_000.5, 1_000_100],
    [250.25, 1_000.75],
  ])("매출 %s 비용 %s → 칸(formatMoney(매출−비용))의 절대값과 같은 숫자", (revenue, cost) => {
    const box = formatMoney(revenue - cost).replace("-", "");
    const text = h(revenue, cost)?.text ?? "";
    expect(text).toContain(`${box}원`);
  });
});
