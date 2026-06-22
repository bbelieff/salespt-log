/**
 * periodsOverlap — 직접생산 기간 겹침 판정 (ADR-0024 겹침금지 → 활성 레코드 유일).
 */
import { describe, it, expect } from "vitest";
import { periodsOverlap } from "@/service/db";

describe("periodsOverlap (직접생산 기간 겹침)", () => {
  it("완전 분리된 기간 → 비겹침", () => {
    expect(periodsOverlap("2026-06-01", "2026-06-05", "2026-06-06", "2026-06-10")).toBe(false);
    expect(periodsOverlap("2026-06-06", "2026-06-10", "2026-06-01", "2026-06-05")).toBe(false);
  });
  it("경계 맞닿음(종료=시작) → 겹침으로 차단(같은 날 두 레코드 활성 방지)", () => {
    expect(periodsOverlap("2026-06-01", "2026-06-05", "2026-06-05", "2026-06-10")).toBe(true);
  });
  it("부분 겹침 → 겹침", () => {
    expect(periodsOverlap("2026-06-01", "2026-06-07", "2026-06-05", "2026-06-10")).toBe(true);
  });
  it("포함(한 기간이 다른 기간 안) → 겹침", () => {
    expect(periodsOverlap("2026-06-01", "2026-06-30", "2026-06-10", "2026-06-12")).toBe(true);
  });
  it("빈 날짜 → 비겹침(검증은 별도)", () => {
    expect(periodsOverlap("", "2026-06-05", "2026-06-01", "2026-06-10")).toBe(false);
    expect(periodsOverlap("2026-06-01", "2026-06-05", "", "")).toBe(false);
  });
});
