// 2026-10-12 #7 — 채널별 남은 돈의 기간 계산 바탕: 채널별 DB 비용 · 버킷별 매출 · 계약 행 키.
import { describe, expect, it } from "vitest";
import {
  periodBounds,
  periodDbCost,
  periodDbCostByChannel,
  periodRevenue,
  periodRevenueByBucket,
  type RevenueContract,
} from "@/util/finance-period";
import { contractChannelKey } from "@/util/contract-link";

const slot = (수납액 = 0, 수납일 = "") => ({ 수납액, 수납일 });
type Row = RevenueContract & { bucket: string };
const row = (bucket: string, over: Partial<RevenueContract> = {}): Row => ({
  bucket, 계약일: "2026-10-05", 수임비: 100, 수납1: slot(), 수납2: slot(), 수납3: slot(), 반환액: 0, 해지일: "", ...over,
});

const overview = {
  purchases: [{ 구매일: "2026-09-28", 주문금액: 100 }, { 구매일: "2026-10-02", 주문금액: 200 }, { 구매일: "", 주문금액: 3 }],
  productions: [{ 시작일: "2026-10-01", 기간예산: 1000 }],
  banners: [{ 날짜: "2026-10-09", 주문금액: 50 }, { 날짜: "", 주문금액: 7 }],
};

describe("periodDbCostByChannel — 채널별 DB 비용(periodDbCost 와 같은 날짜 규칙)", () => {
  it("매입DB 구매일·직접생산 시작일·현수막 날짜로 나누고, 날짜 없는 행은 「전체」에서만 센다", () => {
    expect(periodDbCostByChannel(overview, ["2026-10-01", "2026-10-08"])).toEqual({ 매입DB: 200, 직접생산: 1000, 현수막: 0 });
    expect(periodDbCostByChannel(overview, null)).toEqual({ 매입DB: 303, 직접생산: 1000, 현수막: 57 });
    expect(periodDbCostByChannel(undefined, null)).toEqual({ 매입DB: 0, 직접생산: 0, 현수막: 0 });
  });
  it("세 값의 합 = periodDbCost (정의 하나)", () => {
    for (const range of [null, ["2026-10-01", "2026-10-08"] as const, ["2026-09-01", "2026-09-30"] as const]) {
      const c = periodDbCostByChannel(overview, range);
      expect(c.매입DB + c.직접생산 + c.현수막).toBe(periodDbCost(overview, range));
    }
  });
});

describe("periodRevenueByBucket — 행마다 버킷 하나, Σ버킷 = 전체", () => {
  const rows = [
    row("현수막", { 계약일: "2026-09-20", 수임비: 300, 수납1: slot(200, "2026-10-06") }),
    row("매입DB", { 계약일: "2026-10-02", 수임비: 80, 반환액: 80, 해지일: "2026-10-13" }), // 해지 — 반환은 해지일
    row("현수막", { 계약일: "2026-07-01", 수임비: 100, 수납1: slot(50, "2026-10-03") }), // 이월(옛 계약)도 기간으로
    row("manual", { 계약일: "2026-10-07", 수임비: 120 }),
  ];
  const today = "2026-10-15";
  const ranges = [
    null,
    periodBounds("month", "", "", today),
    periodBounds("week", "", "", today),
    periodBounds("custom", "2026-10-01", "2026-10-10", today),
  ];
  it("어느 기간이든 버킷 합 = periodRevenue(전체 행)", () => {
    for (const range of ranges) {
      const byBucket = periodRevenueByBucket(rows, (r) => r.bucket, range);
      const total = periodRevenue(rows, range);
      const sum = (k: "revenue" | "contracts" | "fee" | "received" | "refunded") => [...byBucket.values()].reduce((s, v) => s + v[k], 0);
      expect(sum("revenue")).toBe(total.revenue);
      expect(sum("contracts")).toBe(total.contracts);
      expect(sum("refunded")).toBe(total.refunded);
    }
  });
  it("해지 반환은 해지일이 든 기간에 그 버킷에서 빠진다", () => {
    const week = periodRevenueByBucket(rows, (r) => r.bucket, periodBounds("week", "", "", today));
    expect(week.get("매입DB")).toMatchObject({ contracts: 0, refunded: 80, revenue: -80 });
    const early = periodRevenueByBucket(rows, (r) => r.bucket, ["2026-10-01", "2026-10-10"]);
    expect(early.get("매입DB")).toMatchObject({ contracts: 1, refunded: 0, revenue: 80 });
    expect(early.get("현수막")).toMatchObject({ contracts: 0, received: 250, revenue: 250 });
  });
});

describe("contractChannelKey — 서버·브라우저 공용 계약 행 키", () => {
  const base = { row: 7, 계약일: "2026-10-01", 업체명: "샘플상사" };
  it("AK 가 있으면 행+AK — 업체명·계약일을 바꿔도 같다", () => {
    const linked = { ...base, linkedMeetingId: "m-1" };
    expect(contractChannelKey(linked)).toBe("7|ak:m-1");
    expect(contractChannelKey({ ...linked, 업체명: "샘플상사(주)", 계약일: "2026-10-02" })).toBe("7|ak:m-1");
    expect(contractChannelKey({ ...base, linkedMeetingId: " manual:k " })).toBe("7|ak:manual:k");
  });
  it("AK 가 비면 행+계약일+업체명, 행이 다르면 다른 키", () => {
    expect(contractChannelKey({ ...base, linkedMeetingId: "" })).toBe("7|2026-10-01|샘플상사");
    expect(contractChannelKey({ ...base, linkedMeetingId: "   " })).toBe("7|2026-10-01|샘플상사");
    expect(contractChannelKey({ ...base, row: undefined })).toBe("|2026-10-01|샘플상사");
    expect(contractChannelKey({ ...base, row: 8 })).not.toBe(contractChannelKey(base));
  });
});
