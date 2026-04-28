/**
 * 단위 테스트: 영업관리 좌표 계산 (순수 함수, 시트 호출 없음).
 *
 * 검증 대상:
 *   - diffDays / weekIndexOf / weekStartOf / salesRowFor
 *   - 사용자 측정값(2026-04-28): E10 = 1주차 토요일 매입DB
 *                                E44 = 2주차 토요일 매입DB
 *                                즉 BLOCK_START=10, STRIDE=34
 */
import { describe, it, expect } from "vitest";
import {
  diffDays,
  weekIndexOf,
  salesRowFor,
} from "../../lib/repo/sales";

// PRM 5기 가정: 수강시작일 4/18 (토)
const COURSE_START = new Date(2026, 3, 18); // 4월 18일 토요일

describe("diffDays", () => {
  it("같은 날짜는 0", () => {
    expect(diffDays(COURSE_START, COURSE_START)).toBe(0);
  });

  it("7일 후는 7", () => {
    const later = new Date(2026, 3, 25);
    expect(diffDays(later, COURSE_START)).toBe(7);
  });

  it("이전 날짜는 음수", () => {
    const earlier = new Date(2026, 3, 17);
    expect(diffDays(earlier, COURSE_START)).toBe(-1);
  });
});

describe("weekIndexOf", () => {
  it("시작일 당일은 1주차", () => {
    expect(weekIndexOf(COURSE_START, COURSE_START)).toBe(1);
  });

  it("시작일 + 6일은 1주차", () => {
    const d = new Date(2026, 3, 24); // 4/24 금
    expect(weekIndexOf(d, COURSE_START)).toBe(1);
  });

  it("시작일 + 7일은 2주차", () => {
    const d = new Date(2026, 3, 25); // 4/25 토
    expect(weekIndexOf(d, COURSE_START)).toBe(2);
  });

  it("시작일 + 49일은 8주차", () => {
    const d = new Date(2026, 5, 6); // 6/6 토
    expect(weekIndexOf(d, COURSE_START)).toBe(8);
  });

  it("시작일 이전은 0", () => {
    const d = new Date(2026, 3, 17);
    expect(weekIndexOf(d, COURSE_START)).toBe(0);
  });
});

describe("salesRowFor", () => {
  it("1주차 토요일 매입DB = 행 10 (사용자 측정)", () => {
    expect(salesRowFor(COURSE_START, "매입DB", COURSE_START)).toBe(10);
  });

  it("1주차 토요일 직접생산 = 행 11", () => {
    expect(salesRowFor(COURSE_START, "직접생산", COURSE_START)).toBe(11);
  });

  it("1주차 토요일 콜·지·기·소 = 행 13", () => {
    expect(salesRowFor(COURSE_START, "콜·지·기·소", COURSE_START)).toBe(13);
  });

  it("1주차 일요일 매입DB = 행 14", () => {
    const d = new Date(2026, 3, 19); // 4/19 일
    expect(salesRowFor(d, "매입DB", COURSE_START)).toBe(14);
  });

  it("1주차 금요일 매입DB = 행 34 (10 + 6×4)", () => {
    const d = new Date(2026, 3, 24); // 4/24 금 (요일 idx 6)
    expect(salesRowFor(d, "매입DB", COURSE_START)).toBe(34);
  });

  it("2주차 토요일 매입DB = 행 44 (사용자 측정)", () => {
    const d = new Date(2026, 3, 25); // 4/25 토
    expect(salesRowFor(d, "매입DB", COURSE_START)).toBe(44);
  });

  it("8주차 토요일 매입DB = 행 248", () => {
    const d = new Date(2026, 5, 6); // 6/6 토
    expect(salesRowFor(d, "매입DB", COURSE_START)).toBe(248);
  });

  it("범위 밖(11주차)은 throw", () => {
    const d = new Date(2026, 5, 27); // 6/27, 11주차 시작 (4/18 + 70일)
    expect(() => salesRowFor(d, "매입DB", COURSE_START)).toThrow(
      /편집 가능 기간/,
    );
  });

  it("시작일 이전은 throw", () => {
    const d = new Date(2026, 3, 17);
    expect(() => salesRowFor(d, "매입DB", COURSE_START)).toThrow(
      /편집 가능 기간/,
    );
  });
});
