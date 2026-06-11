/**
 * rejoin-routing 가드 (arena-carryover §1·§2, 2026-06-11) — cohorts 탭 archived
 * 기수의 trainee 행만 라우팅 비활성. 트레이너(T)·연습·아레나 행 절대 비적용
 * (적용 시 전 트레이너 차단 사고 — 박제 테스트).
 */
import { describe, it, expect } from "vitest";
import { isNumericCohortArchived } from "@/repo/users";

const archived = new Set(["6", "T", "연습", "A1"]); // cohorts 탭에 섞여 있을 수 있는 라벨들

describe("isNumericCohortArchived (rejoin 라우팅 가드)", () => {
  it("trainee + 숫자형('6'/'6기') + archived → true", () => {
    expect(isNumericCohortArchived("trainee", "6", archived)).toBe(true);
    expect(isNumericCohortArchived("trainee", "6기", archived)).toBe(true);
    expect(isNumericCohortArchived("trainee", " 6 ", archived)).toBe(true);
  });

  it("트레이너(T)는 cohorts 에 T archived 가 있어도 절대 비적용", () => {
    expect(isNumericCohortArchived("trainer", "T", archived)).toBe(false);
    expect(isNumericCohortArchived("trainer", "6", archived)).toBe(false); // role 가드
  });

  it("숫자형 아닌 cohort(연습·T·아레나 A1-6)는 비적용", () => {
    expect(isNumericCohortArchived("trainee", "연습", archived)).toBe(false);
    expect(isNumericCohortArchived("trainee", "T", archived)).toBe(false);
    expect(isNumericCohortArchived("trainee", "A1-6", archived)).toBe(false);
    expect(isNumericCohortArchived("trainee", "A1-6기", archived)).toBe(false);
  });

  it("archived 아닌 기수(7)는 false", () => {
    expect(isNumericCohortArchived("trainee", "7", archived)).toBe(false);
  });

  it("admin 비적용", () => {
    expect(isNumericCohortArchived("admin", "6", archived)).toBe(false);
  });
});
