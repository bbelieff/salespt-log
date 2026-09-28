/**
 * 업체정보 [재무] 매출 해석 (company-info-restructure, belie 2026-09-28) — 순수 함수.
 *  ① 연도 라벨: 주입한 오늘 기준 "Y(2026)" · "Y-1(2025)" …
 *  ② 매출 금액 읽기: 백만·억·만·원(쉼표 숫자)·앞 연도 표시("25'")·몇 월까지("26' 6월")
 *  ③ 매출증가율 3칸: "+12.5%" / "-3.0%", 못 읽거나 한쪽 없으면 ""
 *  ④ 부분 연도(올해 6월까지) 안내
 */
import { describe, expect, it } from "vitest";
import {
  SALES_GROWTH_DEFS,
  computeSalesGrowth,
  formatGrowthRate,
  parseSalesAmount,
  partialYearNote,
  salesGrowthName,
  salesYearTag,
  withSalesGrowth,
} from "@/util/company-sales";

describe("① 연도 라벨", () => {
  it("오늘(주입) 기준 달력 연도를 괄호로", () => {
    const today = new Date(2026, 8, 28);
    expect([0, 1, 2, 3].map((i) => salesYearTag(i, today))).toEqual([
      "Y(2026)",
      "Y-1(2025)",
      "Y-2(2024)",
      "Y-3(2023)",
    ]);
    expect(salesYearTag(1, new Date(2027, 0, 1))).toBe("Y-1(2026)");
  });
  it("증가율 칸 이름", () => {
    expect(SALES_GROWTH_DEFS.map((d) => salesGrowthName(d.fromAgo))).toEqual(["Y-3→Y-2", "Y-2→Y-1", "Y-1→Y"]);
  });
});

describe("② parseSalesAmount", () => {
  it.each([
    ["250백만", 250_000_000, null],
    ["1.2억", 120_000_000, null],
    ["3,200만", 32_000_000, null],
    ["1억 2,500만", 125_000_000, null],
    ["2억5천만", 250_000_000, null],
    ["25' 250백만", 250_000_000, null],
    ["25’ 250백만", 250_000_000, null],
    ["2025년 1.2억", 120_000_000, null],
    ["26' 6월 100백만", 100_000_000, 6],
    ["26' 1~6월 100백만", 100_000_000, 6],
    ["250,000,000", 250_000_000, null],
    ["250,000,000원", 250_000_000, null],
    ["0", 0, null],
    // 억 바로 뒤 "천" = 천만(한국어 관례) — "2억5천" 은 2억 5천 원이 아니다.
    ["2억5천", 250_000_000, null],
    ["25' 2억 5천", 250_000_000, null],
    ["1억 2천", 120_000_000, null],
    ["1억 2천 5백만", 125_000_000, null],
    ["2025년 - 250백만", 250_000_000, null], // 띄어 쓴 "-" 는 구분 기호
    ["5,000", 5_000, null], // 쉼표 숫자는 원
  ])("%s", (raw, won, month) => {
    expect(parseSalesAmount(raw)).toEqual({ won, month });
  });

  it.each(["", "  ", "매출 없음", "1억 2500", "25' 250백만 / 24' 148백만"])("못 읽거나 금액이 둘이면 null: %s", (raw) => {
    expect(parseSalesAmount(raw)).toBeNull();
  });

  // 틀린 금액을 자신 있게 내면 읽기 전용 증가율 칸에 틀린 값이 저장된다 — 뜻이 갈리면 읽지 않는다.
  it.each([
    "-50백만", // 음수
    "25' -50백만",
    "△50백만",
    "3천", // 3천만? 3천 원?
    "25' 250", // 단위 빠뜨림
    "1500",
    "1.5",
  ])("뜻이 갈리는 글은 null: %s", (raw) => {
    expect(parseSalesAmount(raw)).toBeNull();
  });
});

describe("③ 매출증가율", () => {
  it("formatGrowthRate — 소수 한 자리, 부호", () => {
    expect(formatGrowthRate(240, 270)).toBe("+12.5%");
    expect(formatGrowthRate(100, 97)).toBe("-3.0%");
    expect(formatGrowthRate(100, 100)).toBe("0.0%");
    expect(formatGrowthRate(0, 100)).toBe(""); // 이전 해 0 → 계산 불가
  });

  it("연도 매출 칸 → 3칸 (백만·억·만 섞여도 원으로 맞춰 계산)", () => {
    const g = computeSalesGrowth({
      과년도매출Y3: "23' 100백만",
      과년도매출Y2: "24' 1.25억",
      과년도매출: "25' 12,500만",
      금년도매출: "26' 6월 100백만",
    });
    expect(g).toEqual({ 매출증가율Y3Y2: "+25.0%", 매출증가율Y2Y1: "0.0%", 매출증가율Y1Y: "-20.0%" });
  });

  it("억·천 줄임말(2억5천)과 단위 빠진 숫자 — 틀린 증가율 대신 바른 값 또는 빈값", () => {
    const g = computeSalesGrowth({
      과년도매출Y3: "23' 2억",
      과년도매출Y2: "24' 2억5천",
      과년도매출: "25' 250",
      금년도매출: "26' 3억",
    });
    expect(g).toEqual({ 매출증가율Y3Y2: "+25.0%", 매출증가율Y2Y1: "", 매출증가율Y1Y: "" });
  });

  it("한쪽이 비었거나 못 읽으면 그 칸만 빈값", () => {
    const g = computeSalesGrowth({ 과년도매출Y3: "", 과년도매출Y2: "24' 100백만", 과년도매출: "모름", 금년도매출: "1억" });
    expect(g).toEqual({ 매출증가율Y3Y2: "", 매출증가율Y2Y1: "", 매출증가율Y1Y: "" });
  });

  it("withSalesGrowth — 계산값을 채운 사본, 이미 같으면 같은 객체", () => {
    const base = { 과년도매출: "25' 200백만", 금년도매출: "26' 250백만", 매출증가율Y1Y: "" };
    const next = withSalesGrowth(base);
    expect(next).not.toBe(base);
    expect(next.매출증가율Y1Y).toBe("+25.0%");
    expect(withSalesGrowth(next)).toBe(next);
    // 연도 매출을 지우면 증가율도 비운다(낡은 값이 남지 않게).
    expect(withSalesGrowth({ ...next, 금년도매출: "" }).매출증가율Y1Y).toBe("");
  });
});

describe("④ 부분 연도 안내", () => {
  it("올해 매출이 몇 월까지면 안내, 12월·월 없음이면 없음", () => {
    expect(partialYearNote("26' 6월 100백만")).toBe("올해는 6월까지 매출이라 낮게 보일 수 있어요");
    expect(partialYearNote("26' 12월 300백만")).toBe("");
    expect(partialYearNote("26' 300백만")).toBe("");
    expect(partialYearNote("")).toBe("");
  });
});
