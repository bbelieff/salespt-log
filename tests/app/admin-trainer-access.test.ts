import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { defaultTrainerGrants } from "@/util/trainer-access-policy";
vi.stubGlobal("React", React);
const m = vi.hoisted(() => ({ session: vi.fn(), view: vi.fn(), admin: vi.fn(), list: vi.fn() }));
vi.mock("@/auth/identity", () => ({ getSessionEmail: m.session, canViewAdminPages: m.view, isAdminEmail: m.admin }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("redirect"); } }));
vi.mock("@/config", () => ({ adminEmails: () => [], adminNames: () => ({}) }));
vi.mock("@/repo/users", () => ({ listPendingTrainers: async () => [], listDistinctUsers: async () => [], isReservedTrainee: () => false }));
vi.mock("@/service/trainer-access-settings", () => ({ listTrainerAccessSettings: m.list }));
vi.mock("@/components/auth/TrainerInvites", () => ({ default: () => React.createElement("div", null, "invites") }));
vi.mock("@/components/auth/TrainerMgmtPanel", () => ({ default: () => React.createElement("div", null, "existing panel") }));
import Page from "@/app/admin/trainers/page";
beforeEach(() => {
  vi.resetAllMocks(); m.session.mockResolvedValue("admin@example.test"); m.view.mockResolvedValue(true); m.admin.mockReturnValue(true);
  m.list.mockResolvedValue([{ email: "coach@example.test", name: "합성 코치", status: "active", grade: "regular", grants: defaultTrainerGrants("regular"), version: 1 }]);
});
it("actual admin renders server loaded access data in the real editor", async () => {
  const html = renderToStaticMarkup(await Page());
  expect(m.list).toHaveBeenCalledOnce(); expect(html).toContain("합성 코치"); expect(html).toContain("등급·권한 편집");
});
it("management viewOnly never loads or renders access settings", async () => {
  m.admin.mockReturnValue(false);
  const html = renderToStaticMarkup(await Page());
  expect(m.list).not.toHaveBeenCalled(); expect(html).not.toContain("coach@example.test"); expect(html).not.toContain("등급·권한 편집"); expect(html).toContain("existing panel");
});
it.each(["database password coach@example.test", "permission denied"])("isolates unavailable editor without error detail: %s", async detail => {
  m.list.mockRejectedValue(new Error(detail));
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain("권한 설정을 불러올 수 없습니다"); expect(html).toContain("existing panel"); expect(html).not.toContain(detail);
});
it("unauthenticated request redirects before settings read", async () => {
  m.session.mockResolvedValue(null); await expect(Page()).rejects.toThrow("redirect"); expect(m.list).not.toHaveBeenCalled();
});
