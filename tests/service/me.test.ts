/**
 * 단위 테스트 — `lib/service/me.ts`의 D-day 계산 정합성.
 *
 * SSOT: ADR-0005 (주차 카운팅 컨벤션).
 *   7기+ 현행 모델: graduationISO = courseStartISO(O1) + 50d (종강총회일 = 수료일).
 *   (6기 이하 legacy 는 O1+57 이지만 그 시트들은 O2 직접값이 진실이라 fixture
 *    검증 대상 아님 — 이 테스트는 7기+ 모델만 검증.)
 *
 * 7기 검증 fixture: O1 = 2026-05-15(금) → graduationISO = 2026-07-04(토)
 */
import { describe, expect, it } from "vitest";
import {
  GRADUATION_OFFSET_DAYS,
  computeGraduationISO,
} from "@/service/me";

describe("GRADUATION_OFFSET_DAYS", () => {
  it("종강총회 offset = 50일 (7기+ 현행 모델, ADR-0005)", () => {
    expect(GRADUATION_OFFSET_DAYS).toBe(50);
  });
});

describe("computeGraduationISO — 7기 모델 (O1+50)", () => {
  it("O1=2026-05-15(금) → graduation=2026-07-04(토)", () => {
    expect(computeGraduationISO("2026-05-15")).toBe("2026-07-04");
  });

  it("월말 경계: 4/30 → 6/19 (5월 31d + 6월 19d = 50)", () => {
    expect(computeGraduationISO("2026-04-30")).toBe("2026-06-19");
  });

  it("연말 경계: 12/31 → 다음해 2/19 (1월 31d + 2월 19d = 50)", () => {
    expect(computeGraduationISO("2026-12-31")).toBe("2027-02-19");
  });

  it("윤년(2028) 2/29 → 4/19 (3월 31d + 4월 19d = 50)", () => {
    expect(computeGraduationISO("2028-02-29")).toBe("2028-04-19");
  });
});
