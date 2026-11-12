/** 수석 트레이너는 모든 수강생 웹앱(2026-11-12 belie) — 트레이너 화면 버튼 판단이 서버 분류 순서(보관 → 아레나 → 활성)를 따른다. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { trainerCanOpen } from "@/components/auth/trainer-open";
import { defaultTrainerGrants } from "@/util/trainer-access-policy";

const staff = new Set(["gm@example.test"]);
const archived = new Set(["9"]);
const active = { email: "a@example.test", cohort: "12" };
const arena = { email: "b@example.test", cohort: "A2-11" };
const old = { email: "c@example.test", cohort: "9" };
const test0 = { email: "d@example.test", cohort: "A2-0" };
const gm = { email: "GM@example.test", cohort: "0" };
const read = (grade: string) => {
  const g = defaultTrainerGrants(grade);
  return { active: g.active.read, arena: g.arena.read, archived: g.archived.read };
};

describe("트레이너 화면 [웹앱] 버튼 범위", () => {
  it("수석은 활성·아레나·보관 기수 모두", () => {
    const g = read("senior");
    for (const u of [active, arena, old]) expect(trainerCanOpen(u, g, staff, archived)).toBe(true);
  });
  it("일반·견습은 활성 기수만", () => {
    for (const grade of ["regular", "apprentice"]) {
      const g = read(grade);
      expect(trainerCanOpen(active, g, staff, archived)).toBe(true);
      expect(trainerCanOpen(arena, g, staff, archived)).toBe(false);
      expect(trainerCanOpen(old, g, staff, archived)).toBe(false);
    }
  });
  it("테스트 기수·관리자/트레이너 본인 페이지는 수석이어도 없음", () => {
    const g = read("senior");
    expect(trainerCanOpen(test0, g, staff, archived)).toBe(false);
    expect(trainerCanOpen(gm, g, staff, archived)).toBe(false);
  });
  it("트레이너 페이지가 아레나·보관 권한까지 넘긴다", () => {
    const page = readFileSync("app/trainer/page.tsx", "utf8");
    expect(page).toContain("trainerReadGrants(sessionEmail)");
    expect(page).toContain("openArena={grants.arena}");
    expect(page).toContain("openArchived={grants.archived}");
  });
});
