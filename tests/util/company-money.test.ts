/**
 * 업체정보 [재무] 금액 = 백만원 (company-finance-won-grid, belie 2026-09-28) — 순수 함수.
 *  ① 원 → 백만원(wonToMillion): 소수 둘째 자리 반올림(.05 올림), 0 은 "0"(-0 없음), 천원 문서는 ×1,000 먼저
 *  ② 저장값 읽기(readMoney): 숫자 = 백만원, 옛 자유 글은 단위로 읽고 단위 없는 숫자 = 백만원
 *  ③ 입력칸: 입력 중 소수 한 자리 · 손익 칸만 음수 · blur 에 쉼표 · "약 …" 도움말
 *  ④ 매출 글 읽기(parseSalesAmount — 원 단위, 옛 동작 유지 + 단위 없는 숫자 배수)
 *  ⑤ TXT 표기
 */
import { describe, expect, it } from "vitest";
import {
  formatMoneyOnBlur,
  formatMoneyTxt,
  formatTenths,
  moneyHint,
  moneyTenths,
  moneyWithUnit,
  parseSalesAmount,
  readMoney,
  sanitizeMoneyTyping,
  wonToMillion,
  wonToTenths,
} from "@/util/company-money";

describe("① 원 → 백만원", () => {
  it.each([
    [250_123_456, "250.1"],
    [12_345_678, "12.3"],
    [12_350_000, "12.4"], // .05 는 올림
    [12_349_999, "12.3"],
    [1_234_000_000, "1,234"],
    [100_000_000, "100"],
    [40_000, "0"], // 0.04 → 0, "-0" 아님
    [0, "0"],
    [-40_000, "0"],
    [-3_250_000, "-3.3"], // 음수는 0 에서 먼 쪽
    [-12_345_678, "-12.3"],
  ])("%d원 → %s", (won, out) => {
    expect(wonToMillion(won)).toBe(out);
  });

  it("천원 문서는 ×1,000 해서 원으로 바꾼 뒤", () => {
    expect(wonToMillion(250_123 * 1000)).toBe("250.1");
  });

  it("십만원 정수 ↔ 정본 글", () => {
    expect(wonToTenths(250_150_000)).toBe(2502);
    expect(Object.is(wonToTenths(-40_000), -0)).toBe(false);
    expect(formatTenths(12345)).toBe("1,234.5");
    expect(formatTenths(2500)).toBe("250");
    expect(formatTenths(-32)).toBe("-3.2");
    expect(formatTenths(0)).toBe("0");
  });
});

describe("② 저장값 읽기", () => {
  it("숫자 글 = 백만원", () => {
    expect(readMoney("250.1")).toEqual({ kind: "number", tenths: 2501 });
    expect(readMoney("1,234")).toEqual({ kind: "number", tenths: 12340 });
    expect(readMoney("1234")).toEqual({ kind: "number", tenths: 12340 });
    expect(readMoney("12.34")).toEqual({ kind: "number", tenths: 123 });
    expect(readMoney("12.35")).toEqual({ kind: "number", tenths: 124 });
    expect(readMoney("")).toEqual({ kind: "empty" });
    expect(readMoney("-3.2", true)).toEqual({ kind: "number", tenths: -32 });
  });

  it("매출 칸(부호 없음)의 음수는 계산할 수 없는 글", () => {
    expect(readMoney("-3.2")).toEqual({ kind: "legacy", tenths: null, month: null });
    expect(moneyTenths("-3.2")).toBeNull();
  });

  it("옛 자유 글 — 단위로 읽고, 단위 없는 숫자는 백만원", () => {
    expect(readMoney("25' 250백만")).toEqual({ kind: "legacy", tenths: 2500, month: null });
    expect(readMoney("3,200만")).toEqual({ kind: "legacy", tenths: 320, month: null });
    expect(readMoney("1.2억")).toEqual({ kind: "legacy", tenths: 1200, month: null });
    expect(readMoney("25' 250")).toEqual({ kind: "legacy", tenths: 2500, month: null });
    expect(readMoney("26' 6월 100백만")).toEqual({ kind: "legacy", tenths: 1000, month: 6 });
    expect(readMoney("5,000원")).toEqual({ kind: "legacy", tenths: 0, month: null });
    expect(readMoney("모름")).toEqual({ kind: "legacy", tenths: null, month: null });
    expect(readMoney("25' 250백만 / 24' 148백만")).toEqual({ kind: "legacy", tenths: null, month: null });
  });

  it("옛 손익 글의 음수(-3,200만)는 손익 칸에서만 읽는다", () => {
    expect(moneyTenths("-3,200만", true)).toBe(-320);
    expect(moneyTenths("△1.2억", true)).toBe(-1200);
    expect(moneyTenths("-3,200만")).toBeNull();
  });
});

describe("③ 입력칸", () => {
  it("입력 중 — 소수 한 자리까지(넘치면 자르고 알림)", () => {
    expect(sanitizeMoneyTyping("250.12", false)).toEqual({ value: "250.1", cut: true });
    expect(sanitizeMoneyTyping("250.1", false)).toEqual({ value: "250.1", cut: false });
    expect(sanitizeMoneyTyping("1,234", false)).toEqual({ value: "1,234", cut: false });
    expect(sanitizeMoneyTyping("12.3.4", false).value).toBe("12.3");
  });

  it("음수는 손익 칸만", () => {
    expect(sanitizeMoneyTyping("-3.2", true).value).toBe("-3.2");
    expect(sanitizeMoneyTyping("-3.2", false).value).toBe("3.2");
    expect(sanitizeMoneyTyping("3-2", true).value).toBe("32");
  });

  it("글자가 섞이면(옛 자유 글 고치는 중) 그대로", () => {
    expect(sanitizeMoneyTyping("25' 250백만", false)).toEqual({ value: "25' 250백만", cut: false });
  });

  it("blur — 쉼표·끝 .0 정리, 부호만 남으면 비움, 옛 글은 그대로", () => {
    expect(formatMoneyOnBlur("1234", false)).toBe("1,234");
    expect(formatMoneyOnBlur("1234.0", false)).toBe("1,234");
    expect(formatMoneyOnBlur("0012.5", false)).toBe("12.5");
    expect(formatMoneyOnBlur("-0", true)).toBe("0");
    expect(formatMoneyOnBlur("-", true)).toBe("");
    expect(formatMoneyOnBlur("3,200만", false)).toBe("3,200만");
  });

  it("'약 …' 도움말 — 1억 이상 억(소수 한 자리), 그 아래 만", () => {
    expect(moneyHint(2501)).toBe("약 2.5억");
    expect(moneyHint(320)).toBe("약 3,200만");
    expect(moneyHint(12340)).toBe("약 12.3억");
    expect(moneyHint(1000)).toBe("약 1억");
    expect(moneyHint(5)).toBe("약 50만");
    expect(moneyHint(-32)).toBe("약 -320만");
    expect(moneyHint(0)).toBe("");
    expect(moneyHint(null)).toBe("");
  });
});

describe("④ parseSalesAmount (원)", () => {
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
    ["2억5천", 250_000_000, null],
    ["25' 2억 5천", 250_000_000, null],
    ["1억 2천", 120_000_000, null],
    ["1억 2천 5백만", 125_000_000, null],
    ["2025년 - 250백만", 250_000_000, null],
    ["5,000", 5_000, null],
  ])("%s", (raw, won, month) => {
    expect(parseSalesAmount(raw)).toEqual({ won, month });
  });

  it.each(["", "  ", "매출 없음", "1억 2500", "25' 250백만 / 24' 148백만", "-50백만", "△50백만", "3천", "25' 250", "1500"])(
    "못 읽거나 뜻이 갈리면 null: %s",
    (raw) => {
      expect(parseSalesAmount(raw)).toBeNull();
    },
  );

  it("bareUnit — 단위 없는 숫자 하나를 그 단위로(백만원 칸)", () => {
    expect(parseSalesAmount("25' 250", { bareUnit: 1e6 })).toEqual({ won: 250_000_000, month: null });
    expect(parseSalesAmount("250,000,000", { bareUnit: 1e6 })?.won).toBe(250_000_000 * 1e6);
    expect(parseSalesAmount("3,200만", { bareUnit: 1e6 })?.won).toBe(32_000_000);
  });
});

describe("⑤ 표기", () => {
  it("TXT — 숫자면 백만원 + 약, 옛 글은 그대로", () => {
    expect(formatMoneyTxt("250.1")).toBe("250.1백만원 (약 2.5억)");
    expect(formatMoneyTxt("1234")).toBe("1,234백만원 (약 12.3억)");
    expect(formatMoneyTxt("0")).toBe("0백만원");
    expect(formatMoneyTxt("-3.2", true)).toBe("-3.2백만원 (약 -320만)");
    expect(formatMoneyTxt("25' 250백만")).toBe("25' 250백만");
  });
  it("비교표 — 숫자면 백만원", () => {
    expect(moneyWithUnit("250.1")).toBe("250.1백만원");
    expect(moneyWithUnit("1.2억")).toBe("1.2억");
    expect(moneyWithUnit("")).toBe("");
  });
});
