/**
 * unitPriceFromTotal — 부가세 역산 (PR-C3 / R4).
 */
import { describe, it, expect } from "vitest";
import { unitPriceFromTotal } from "@/lib/pricing";

describe("unitPriceFromTotal (부가세 역산 개당단가)", () => {
  it("부가세 포함 → 1.1 로 나눈 공급가 ÷ 개수", () => {
    expect(unitPriceFromTotal(110000, 10, true)).toBe(10000);
  });
  it("부가세 미포함 → 총액 ÷ 개수", () => {
    expect(unitPriceFromTotal(100000, 10, false)).toBe(10000);
  });
  it("나누어 떨어지지 않으면 원 단위 반올림", () => {
    expect(unitPriceFromTotal(110000, 3, true)).toBe(33333); // 100000/3
    expect(unitPriceFromTotal(100, 3, false)).toBe(33);
  });
  it("개수 0/음수 → 0 (0 나눗셈 방지)", () => {
    expect(unitPriceFromTotal(100000, 0, false)).toBe(0);
    expect(unitPriceFromTotal(100000, -1, true)).toBe(0);
  });
  it("총액 0 → 0", () => {
    expect(unitPriceFromTotal(0, 10, true)).toBe(0);
  });
});
