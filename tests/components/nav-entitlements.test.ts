/** 구조 개선 ⑨ — 상단바·사이드 메뉴·역할 전환의 판정 한 곳. */
import { describe, expect, it } from "vitest";
import { headerEntitlements, isAdminSession, viewModeFor } from "@/components/auth/nav-entitlements";

describe("관리자 판정 — 사이드 메뉴 = 상단 팝업", () => {
  it.each([
    [{ isAdmin: true, sessionRole: "trainee" as const }, true],
    [{ isAdmin: false, sessionRole: "admin" as const }, true],
    [{ isAdmin: false, sessionRole: "trainer" as const }, false],
    [undefined, false],
  ])("%j → %s", (me, want) => {
    expect(isAdminSession(me)).toBe(want);
    expect(headerEntitlements({ me, trainer: undefined, pathname: "/dashboard" }).isAdmin).toBe(want);
  });
});

describe("화면 모드·복귀 링크·트레이너 신청", () => {
  it("주소로 모드를 정하고 명시값이 우선", () => {
    expect(viewModeFor("/trainer/students")).toBe("trainer");
    expect(viewModeFor("/dashboard")).toBe("student");
    expect(viewModeFor("/trainer", "student")).toBe("student");
  });
  it("머리의 「← 대시보드」 판정은 어느 화면·어느 자격에도 없다(2026-11-16 belie — 모든 화면에서 제거)", () => {
    for (const pathname of ["/dashboard", "/payment", "/db-sheet", "/trainer", "/updates"]) {
      for (const trainer of [undefined, { canStudent: true, canTrainer: true }, { canStudent: true, canTrainer: false }, { canStudent: false, canTrainer: true }]) {
        expect(headerEntitlements({ me: undefined, trainer, pathname })).not.toHaveProperty("showStudentDashboardLink");
      }
    }
    // 토글 조건은 그대로 — 두 역할 계정은 수강생·트레이너 화면 모두에서 토글이 뜬다.
    const dual = { canStudent: true, canTrainer: true };
    expect(headerEntitlements({ me: undefined, trainer: dual, pathname: "/trainer" })).toMatchObject({ roleView: "trainer", roleToggleShown: true });
    expect(headerEntitlements({ me: undefined, trainer: dual, pathname: "/dashboard" })).toMatchObject({ roleView: "student", roleToggleShown: true });
  });
  it("역할 토글은 수강생이면서 트레이너인 계정에만", () => {
    const shown = (trainer: { canStudent?: boolean; canTrainer?: boolean } | undefined) => headerEntitlements({ me: undefined, trainer, pathname: "/payment" }).roleToggleShown;
    expect(shown({ canStudent: true, canTrainer: true })).toBe(true);
    expect(shown({ canStudent: true, canTrainer: false })).toBe(false); // 수강생만
    expect(shown({ canStudent: false, canTrainer: true })).toBe(false); // 트레이너만
    expect(shown(undefined)).toBe(false); // 자격 확인 전
  });
  it("트레이너 신청은 트레이너·관리자가 아닐 때만", () => {
    expect(headerEntitlements({ me: undefined, trainer: { canTrainer: false, status: "pending" }, pathname: "/dashboard" })).toMatchObject({ showTrainerApply: true, trainerApplyPending: true });
    expect(headerEntitlements({ me: { isAdmin: true }, trainer: { canTrainer: false }, pathname: "/dashboard" }).showTrainerApply).toBe(false);
    expect(headerEntitlements({ me: undefined, trainer: undefined, pathname: "/dashboard" }).showTrainerApply).toBe(false);
  });
});
