/**
 * rejoin-routing 가드 (arena-carryover §1·§2, 2026-06-11) — cohorts 탭 archived
 * 기수의 trainee 행만 라우팅 비활성. 트레이너(T)·연습·아레나 행 절대 비적용
 * (적용 시 전 트레이너 차단 사고 — 박제 테스트).
 */
import { describe, it, expect } from "vitest";
import { isNumericCohortArchived } from "@/repo/users";
import { isArenaCohortLabel, pickPreferredUser } from "@/repo/user-priority";
import type { User } from "@/types";

const archived = new Set(["6", "T", "연습", "A1"]); // cohorts 탭에 섞여 있을 수 있는 라벨들

function mkUser(p: Partial<User>): User {
  return {
    email: "u@x.com",
    cohort: "6",
    name: "홍길동",
    spreadsheetId: "sid",
    role: "trainee",
    status: "active",
    ...p,
  } as User;
}

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

describe("isArenaCohortLabel (아레나 라벨 판정)", () => {
  it("A{시즌}-{기수} 형태만 true", () => {
    expect(isArenaCohortLabel("A1-6")).toBe(true);
    expect(isArenaCohortLabel("A1-6기")).toBe(true);
    expect(isArenaCohortLabel("A12-3")).toBe(true);
    expect(isArenaCohortLabel(" A1-6 ")).toBe(true);
  });
  it("숫자/T/연습/잘못된 A 형태는 false", () => {
    expect(isArenaCohortLabel("6")).toBe(false);
    expect(isArenaCohortLabel("6기")).toBe(false);
    expect(isArenaCohortLabel("T")).toBe(false);
    expect(isArenaCohortLabel("A1")).toBe(false); // 시즌-기수 구분 없음
    expect(isArenaCohortLabel("Apple")).toBe(false);
  });
});

describe("pickPreferredUser (다중 행 라우팅 우선순위)", () => {
  it("아레나 재참가자: 옛 6기 active + A1-6 active → A1-6 우선", () => {
    // 행 순서상 옛 기수가 먼저 와도 아레나 행을 골라야 /claim 강등 회피.
    const old6 = mkUser({ cohort: "6", spreadsheetId: "old" });
    const arena = mkUser({ cohort: "A1-6", spreadsheetId: "arena" });
    expect(pickPreferredUser([old6, arena])?.spreadsheetId).toBe("arena");
    expect(pickPreferredUser([arena, old6])?.spreadsheetId).toBe("arena");
  });
  it("아레나 없으면 숫자 active 반환", () => {
    const u = mkUser({ cohort: "8", spreadsheetId: "s8" });
    expect(pickPreferredUser([u])?.spreadsheetId).toBe("s8");
  });
  it("active 없고 archived 만 있으면 archived fallback", () => {
    const arch = mkUser({ cohort: "6", status: "archived", spreadsheetId: "arch" });
    expect(pickPreferredUser([arch])?.spreadsheetId).toBe("arch");
  });
  it("아레나 active 가 archived 보다 우선", () => {
    const arch = mkUser({ cohort: "6", status: "archived", spreadsheetId: "arch" });
    const arena = mkUser({ cohort: "A1-6", spreadsheetId: "arena" });
    expect(pickPreferredUser([arch, arena])?.spreadsheetId).toBe("arena");
  });
  it("빈 배열 → null", () => {
    expect(pickPreferredUser([])).toBeNull();
  });
});
