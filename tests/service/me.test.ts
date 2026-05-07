/**
 * 단위 테스트 — `lib/service/me.ts`의 D-day 계산 정합성.
 *
 * SSOT: docs/domains/data-model.md §D-day 계산 규칙
 *   graduationISO = courseStartISO + 57d (종강총회일 = 수료일).
 *
 * 6기 검증 fixture: N1 = 2026-04-10(금) → graduationISO = 2026-06-06(토)
 */
import { describe, expect, it } from "vitest";
import {
  GRADUATION_OFFSET_DAYS,
  computeGraduationISO,
} from "@/service/me";

describe("GRADUATION_OFFSET_DAYS", () => {
  it("종강총회 offset = 57일 (data-model.md SSOT 일치)", () => {
    expect(GRADUATION_OFFSET_DAYS).toBe(57);
  });
});

describe("computeGraduationISO — 6기 fixture", () => {
  it("N1=2026-04-10(금) → graduation=2026-06-06(토)", () => {
    expect(computeGraduationISO("2026-04-10")).toBe("2026-06-06");
  });

  it("월말 경계: 4/30 → 6/26 (4월 1d + 5월 31d + 6월 25d = 57)", () => {
    expect(computeGraduationISO("2026-04-30")).toBe("2026-06-26");
  });

  it("연말 경계: 12/31 → 다음해 2/26", () => {
    // 12/31 + 57d = 1월 31d + 2월 26d = 57
    expect(computeGraduationISO("2026-12-31")).toBe("2027-02-26");
  });

  it("윤년(2028) 2/29 → 4/26 (3월 31d + 4월 26d = 57)", () => {
    expect(computeGraduationISO("2028-02-29")).toBe("2028-04-26");
  });
});
