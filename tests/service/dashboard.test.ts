/**
 * 단위 테스트 — 대시보드 총매출 = 수임비합 + 수수료합(수납액).
 *
 * 버그: 대시보드가 수임비만 합산해 수납탭(totalRevenue = 수임비 + 수납액)과 어긋남.
 * 불변식: computeContractRevenue(payments).revenue == Σ수임비 + Σ(수납1+2+3 수납액).
 */
import { describe, expect, it } from "vitest";
import { computeContractRevenue } from "@/service/dashboard";
import { ContractPayment } from "@/types";

function cp(
  수임비: number,
  수납액들: [number, number, number],
  구분?: string,
) {
  return ContractPayment.parse({
    수임비,
    수납1: { 수납액: 수납액들[0] },
    수납2: { 수납액: 수납액들[1] },
    수납3: { 수납액: 수납액들[2] },
    ...(구분 ? { 구분 } : {}),
  });
}

describe("computeContractRevenue", () => {
  it("총매출 = 수임비합 + 수수료합", () => {
    const payments = [
      cp(3_000_000, [2_000_000, 0, 0]),
      cp(1_500_000, [500_000, 300_000, 0]),
    ];
    const r = computeContractRevenue(payments);
    expect(r.totalFee).toBe(4_500_000); // 3,000,000 + 1,500,000
    expect(r.totalReceived).toBe(2_800_000); // 2,000,000 + 800,000
    expect(r.revenue).toBe(7_300_000); // = 수임비합 + 수수료합
    // 수납탭 정의(totalContract + totalReceived)와 동일해야 함.
    expect(r.revenue).toBe(r.totalFee + r.totalReceived);
  });

  it("수수료(수납액)만 있어도 총매출에 포함 — 누락 버그 회귀 방지", () => {
    const r = computeContractRevenue([cp(0, [0, 0, 1_000_000])]);
    expect(r.revenue).toBe(1_000_000);
  });

  it("빈 목록 = 0", () => {
    expect(computeContractRevenue([]).revenue).toBe(0);
  });

  it("이월(구분=이월) 계약은 매출·수임비·수수료에서 제외 (carryover-profit §1)", () => {
    const payments = [
      cp(3_000_000, [2_000_000, 0, 0]), // native
      cp(5_000_000, [4_000_000, 0, 0], "이월"), // 아레나로 이월 → 제외
    ];
    const r = computeContractRevenue(payments);
    expect(r.totalFee).toBe(3_000_000); // 이월분 5,000,000 제외
    expect(r.totalReceived).toBe(2_000_000); // 이월분 4,000,000 제외
    expect(r.revenue).toBe(5_000_000);
  });

  it("전부 이월이면 매출 0 (옛 기수 영업이익 0 회귀 방지)", () => {
    const r = computeContractRevenue([
      cp(9_000_000, [9_000_000, 0, 0], "이월"),
    ]);
    expect(r.revenue).toBe(0);
  });
});
