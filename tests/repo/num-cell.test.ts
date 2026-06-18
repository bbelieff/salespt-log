/**
 * numCell — 시트 셀 tolerant 변환 (sheet-value-error 2026-06-18).
 * 한 셀의 #VALUE! 가 행(생산 포함) 전체 read 를 무너뜨리지 않게 0 으로 격리.
 */
import { describe, it, expect } from "vitest";
import { numCell } from "@/repo/cell";

describe("numCell (오류셀 → 0, 행 격리)", () => {
  it("정상 숫자는 그대로(정수화)", () => {
    expect(numCell(80)).toBe(80);
    expect(numCell(0)).toBe(0);
    expect(numCell(80.7)).toBe(80); // 카운트는 정수
    expect(numCell("80")).toBe(80); // 문자 숫자도 허용
  });
  it("오류셀 문자열 → 0", () => {
    expect(numCell("#VALUE!")).toBe(0);
    expect(numCell("#REF!")).toBe(0);
    expect(numCell("#DIV/0!")).toBe(0);
    expect(numCell("#N/A")).toBe(0);
  });
  it("빈값·undefined·null·NaN → 0", () => {
    expect(numCell("")).toBe(0);
    expect(numCell(undefined)).toBe(0);
    expect(numCell(null)).toBe(0);
    expect(numCell(NaN)).toBe(0);
  });
  it("음수 → 0 (nonnegative 정합)", () => {
    expect(numCell(-5)).toBe(0);
  });
});
