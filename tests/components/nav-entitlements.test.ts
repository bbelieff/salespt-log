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
  it("두 역할 트레이너 화면은 토글만, 수강생 화면은 항상 복귀 링크", () => {
    const trainer = { canStudent: true, canTrainer: true };
    expect(headerEntitlements({ me: undefined, trainer, pathname: "/trainer" })).toMatchObject({ roleToggleShown: true, showStudentDashboardLink: false });
    expect(headerEntitlements({ me: undefined, trainer, pathname: "/dashboard" }).showStudentDashboardLink).toBe(true);
  });
  it("트레이너 신청은 트레이너·관리자가 아닐 때만", () => {
    expect(headerEntitlements({ me: undefined, trainer: { canTrainer: false, status: "pending" }, pathname: "/dashboard" })).toMatchObject({ showTrainerApply: true, trainerApplyPending: true });
    expect(headerEntitlements({ me: { isAdmin: true }, trainer: { canTrainer: false }, pathname: "/dashboard" }).showTrainerApply).toBe(false);
    expect(headerEntitlements({ me: undefined, trainer: undefined, pathname: "/dashboard" }).showTrainerApply).toBe(false);
  });
});
