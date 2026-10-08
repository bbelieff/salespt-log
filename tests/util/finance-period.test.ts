import { describe, expect, it } from "vitest";
import {
  allocateExpenseByDay,
  customIncomplete,
  periodBounds,
  periodDbCost,
  periodLedgerCost,
  periodRevenue,
  todayKst,
  type RevenueContract,
} from "@/util/finance-period";

const slot = (수납액 = 0, 수납일 = "") => ({ 수납액, 수납일 });
const contract = (over: Partial<RevenueContract> = {}): RevenueContract => ({
  계약일: "2026-10-05", 수임비: 100, 수납1: slot(), 수납2: slot(), 수납3: slot(), 반환액: 0, 해지일: "", ...over,
});

describe("periodBounds — 브라우저 시간대와 무관한 KST 날짜 계산", () => {
  it("이번 주는 월~일, 이번 달은 1일~말일", () => {
    expect(periodBounds("week", "", "", "2026-10-08")).toEqual(["2026-10-05", "2026-10-11"]); // 목요일
    expect(periodBounds("week", "", "", "2026-10-11")).toEqual(["2026-10-05", "2026-10-11"]); // 일요일
    expect(periodBounds("week", "", "", "2026-10-05")).toEqual(["2026-10-05", "2026-10-11"]); // 월요일
    expect(periodBounds("month", "", "", "2026-02-14")).toEqual(["2026-02-01", "2026-02-28"]);
    expect(periodBounds("month", "", "", "2028-02-14")).toEqual(["2028-02-01", "2028-02-29"]);
    expect(periodBounds("week", "", "", "2026-12-31")).toEqual(["2026-12-28", "2027-01-03"]);
  });
  it("전체는 제한 없음, 직접 설정은 두 날짜가 순서대로 있을 때만", () => {
    expect(periodBounds("all", "", "", "2026-10-08")).toBeNull();
    expect(periodBounds("custom", "2026-09-01", "2026-09-30", "2026-10-08")).toEqual(["2026-09-01", "2026-09-30"]);
    expect(periodBounds("custom", "2026-09-30", "2026-09-01", "2026-10-08")).toBeNull();
    expect(periodBounds("custom", "2026-09-01", "", "2026-10-08")).toBeNull();
    expect(customIncomplete("custom", null)).toBe(true);
    expect(customIncomplete("all", null)).toBe(false);
  });
  it("todayKst 는 UTC 15시 이후를 다음 날로 본다", () => {
    expect(todayKst(new Date("2026-10-07T15:30:00Z"))).toBe("2026-10-08");
    expect(todayKst(new Date("2026-10-07T14:59:00Z"))).toBe("2026-10-07");
  });
});

describe("periodRevenue — 아레나 구분 없이 기간으로 (ADR-0034)", () => {
  it("이월 계약도 그대로 합산한다", () => {
    const rows = [contract({ 계약일: "2026-07-01" }), contract({ 계약일: "2026-10-01", 수임비: 50 })];
    expect(periodRevenue(rows, null)).toMatchObject({ contracts: 2, fee: 150, revenue: 150 });
  });
  it("수임비는 계약일, 수납은 수납일, 반환은 해지일로 기간에 넣는다", () => {
    const rows = [
      contract({ 계약일: "2026-09-20", 수임비: 100, 수납1: slot(30, "2026-10-02"), 수납2: slot(40, "2026-09-25") }),
      contract({ 계약일: "2026-10-03", 수임비: 200, 반환액: 70, 해지일: "2026-10-06" }),
      contract({ 계약일: "2026-10-04", 수임비: 10, 반환액: 5, 해지일: "2026-11-01" }),
    ];
    const oct = periodRevenue(rows, ["2026-10-01", "2026-10-31"]);
    expect(oct).toEqual({ contracts: 2, fee: 210, received: 30, refunded: 70, revenue: 170 });
    const all = periodRevenue(rows, null);
    expect(all).toEqual({ contracts: 3, fee: 310, received: 70, refunded: 75, revenue: 305 });
  });
  it("해지일이 없으면 반환은 계약일 기준", () => {
    expect(periodRevenue([contract({ 계약일: "2026-10-03", 반환액: 9 })], ["2026-10-01", "2026-10-31"]).refunded).toBe(9);
  });
});

describe("periodDbCost — 서버 대시보드와 같은 날짜·금액", () => {
  const overview = {
    purchases: [{ 구매일: "2026-09-28", 주문금액: 100 }, { 구매일: "2026-10-02", 주문금액: 200 }],
    productions: [{ 시작일: "2026-10-01", 기간예산: 1000 }],
    banners: [{ 날짜: "2026-10-09", 주문금액: 50 }, { 날짜: "", 주문금액: 7 }],
  };
  it("채널별 날짜에 전액을 넣는다", () => {
    expect(periodDbCost(overview, ["2026-10-01", "2026-10-08"])).toBe(1200);
    expect(periodDbCost(overview, null)).toBe(1357); // 날짜 없는 행은 전체에서만
    expect(periodDbCost(undefined, null)).toBe(0);
  });
});

describe("periodLedgerCost — 원장 일할 배분", () => {
  it("기간 지출은 원래 전액을 하루 단위로 나누고, 반복 지출은 발생일, 미래는 세지 않는다", () => {
    const entries = [
      { source: "one_time" as const, amountWon: 50, originalAmountWon: 100, periodStart: "2026-10-01", periodEnd: "2026-10-10" },
      { source: "recurring" as const, amountWon: 30, periodStart: "2026-10-05", periodEnd: "2026-10-05" },
      { source: "recurring" as const, amountWon: 99, periodStart: "2026-09-05", periodEnd: "2026-09-05" },
    ];
    // 10/01~10/08(오늘) = 하루 10 × 8 = 80 + 반복 30
    expect(periodLedgerCost(entries, ["2026-10-01", "2026-10-31"], "2026-10-08")).toBe(110);
    expect(periodLedgerCost(entries, null, "2026-10-08")).toBe(209);
    expect(periodLedgerCost(entries, ["2026-11-01", "2026-11-30"], "2026-10-08")).toBe(0);
  });
  it("배분은 양끝 포함, 나머지 원은 앞선 날에", () => {
    expect(allocateExpenseByDay(10, "2026-10-01", "2026-10-03").map((d) => d.amountWon)).toEqual([4, 3, 3]);
    expect(() => allocateExpenseByDay(10, "bad", "2026-10-03")).toThrow("expense_invalid_period");
  });
});
