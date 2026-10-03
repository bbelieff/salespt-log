/**
 * 업체정보 [재무] 매출 칸 키·연도 라벨·기준 연도 (company-info-restructure → company-finance-won-grid,
 * belie 2026-09-28) — 순수 함수.
 *  ① 연도 라벨: 기준 연도 기준 "Y(2026)" · "Y-1(2025)" …
 *  ② 기준 연도: 저장값(네 자리·2000~2100) → 없으면 오늘 연도 · 입력 검사 · 문서 연도 → 칸 번호
 *  ③ 매출증가율 표기 "+12.5%" / "-3.0%"
 * 금액 읽기는 tests/util/company-money.test.ts, 합계·증가율 계산은 tests/service/company-finance.test.ts.
 */
import { describe, expect, it } from "vitest";
import {
  SALES_GROWTH_DEFS,
  baseYearInputError,
  formatGrowthRate,
  parseBaseYear,
  resolveBaseYear,
  salesGrowthName,
  salesSlotOf,
  salesYearTag,
} from "@/util/company-sales";

describe("① 연도 라벨", () => {
  it("기준 연도에서 센 달력 연도를 괄호로", () => {
    expect([0, 1, 2, 3].map((i) => salesYearTag(i, 2026))).toEqual([
      "Y(2026)",
      "Y-1(2025)",
      "Y-2(2024)",
      "Y-3(2023)",
    ]);
    expect(salesYearTag(1, 2027)).toBe("Y-1(2026)");
  });
  it("증가율 칸 이름", () => {
    expect(SALES_GROWTH_DEFS.map((d) => salesGrowthName(d.fromAgo))).toEqual(["Y-3→Y-2", "Y-2→Y-1", "Y-1→Y"]);
  });
});

describe("② 기준 연도", () => {
  const TODAY = new Date(2026, 8, 28);
  it("저장값이 맞으면 그 해, 비었거나 틀리면 오늘 연도", () => {
    expect(resolveBaseYear("2025", TODAY)).toBe(2025);
    expect(resolveBaseYear(" 2024 ", TODAY)).toBe(2024);
    expect(resolveBaseYear("", TODAY)).toBe(2026);
    expect(resolveBaseYear("25", TODAY)).toBe(2026);
    expect(resolveBaseYear("1999", TODAY)).toBe(2026);
    expect(resolveBaseYear(undefined, new Date(2027, 0, 2))).toBe(2027);
  });
  it("2000~2100 네 자리만", () => {
    expect(parseBaseYear("2000")).toBe(2000);
    expect(parseBaseYear("2100")).toBe(2100);
    expect(parseBaseYear("2101")).toBeNull();
    expect(parseBaseYear("20a6")).toBeNull();
    expect(baseYearInputError("2026")).toBe("");
    expect(baseYearInputError("1999")).toContain("2000~2100");
  });
  it("문서 연도 → 칸 번호(0=Y … 3=Y-3), 밖이면 null", () => {
    expect(salesSlotOf(2026, 2026)).toBe(0);
    expect(salesSlotOf(2023, 2026)).toBe(3);
    expect(salesSlotOf(2022, 2026)).toBeNull();
    expect(salesSlotOf(2027, 2026)).toBeNull();
    expect(salesSlotOf(2026, 2027)).toBe(1); // 기준 연도를 바꾸면 칸도 한 칸 밀린다
  });
});

describe("③ 매출증가율 표기", () => {
  it("formatGrowthRate — 소수 한 자리, 부호", () => {
    expect(formatGrowthRate(240, 270)).toBe("+12.5%");
    expect(formatGrowthRate(100, 97)).toBe("-3.0%");
    expect(formatGrowthRate(100, 100)).toBe("0.0%");
    expect(formatGrowthRate(0, 100)).toBe(""); // 이전 해 0 → 계산 불가
  });
});
