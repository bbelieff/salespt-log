/**
 * 기수 날짜 계산 (R3-5). ADR-0005: 종강 = 수강시작 + 50일(7기+).
 */
import { describe, it, expect } from "vitest";
import {
  computeGraduationISO,
  isValidISODate,
  GRADUATION_OFFSET_DAYS,
} from "@/service/cohort-dates";

describe("isValidISODate", () => {
  it("유효 ISO 날짜만 true", () => {
    expect(isValidISODate("2026-07-10")).toBe(true);
    expect(isValidISODate("2026-02-29")).toBe(false); // 2026 평년 — 2/29 없음
    expect(isValidISODate("2024-02-29")).toBe(true); // 윤년
    expect(isValidISODate("2026-13-01")).toBe(false); // 월 오류
    expect(isValidISODate("2026-07-32")).toBe(false); // 일 오류
    expect(isValidISODate("2026-7-10")).toBe(false); // zero-pad 필요
    expect(isValidISODate("")).toBe(false);
    expect(isValidISODate("2026/07/10")).toBe(false);
  });
});

describe("computeGraduationISO (+50일, ADR-0005)", () => {
  it("기본 offset=50 — 월 넘김 산술 정확", () => {
    // 07-10 + 50일 = 08-29 (finalize-cohort9 목표값과 일치)
    expect(computeGraduationISO("2026-07-10")).toBe("2026-08-29");
    expect(GRADUATION_OFFSET_DAYS).toBe(50);
  });
  it("연말 넘김", () => {
    expect(computeGraduationISO("2026-12-01")).toBe("2027-01-20"); // 12-01 +30=12-31 +20=01-20
  });
  it("윤년 2월 통과", () => {
    // 2024-01-20 + 50 = 03-10 (1월 남11 + 2월 29 + 3월 10 = 50)
    expect(computeGraduationISO("2024-01-20")).toBe("2024-03-10");
  });
  it("legacy offset=57 도 지원(6기 이하)", () => {
    expect(computeGraduationISO("2026-07-10", 57)).toBe("2026-09-05");
  });
  it("잘못된 입력 → 빈 문자열", () => {
    expect(computeGraduationISO("")).toBe("");
    expect(computeGraduationISO("2026-13-01")).toBe("");
    expect(computeGraduationISO("아무거나")).toBe("");
  });
});
