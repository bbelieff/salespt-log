import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSessionEmail: vi.fn(), getEffectiveRole: vi.fn(), isArenaSelfView: vi.fn(),
  findUserByEmail: vi.fn(), signIn: vi.fn(), restoreRolePath: vi.fn(),
}));
vi.stubGlobal("React", React);
vi.mock("@/auth", () => ({ auth: (handler: unknown) => handler }));
vi.mock("@/auth/dev-stub", () => ({ isDevStubAuthed: () => false }));
vi.mock("@/auth/identity", () => mocks);
vi.mock("@/repo/users", () => mocks);
vi.mock("@/service/role-view", () => mocks);
vi.mock("next-auth/react", () => ({ signIn: mocks.signIn }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/components/auth/WebviewWarning", () => ({ default: () => null }));

import HomePage from "@/app/page";
import LoginScene from "@/components/auth/LoginScene";
import middleware from "@/middleware";

describe("recruitment login entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.restoreRolePath.mockResolvedValue(null);
    mocks.getSessionEmail.mockResolvedValue("student@example.test");
    mocks.getEffectiveRole.mockResolvedValue({ role: "trainee", status: "active" });
    mocks.findUserByEmail.mockResolvedValue({ role: "trainee", status: "active" });
    mocks.isArenaSelfView.mockResolvedValue(false);
  });

  it("preserves invitation path and query when an unauthenticated user hits middleware", async () => {
    const request = new NextRequest("https://app.example.test/trainer/invite/fixture?source=invite");
    const handler = middleware as unknown as (r: NextRequest & { auth: unknown }) => Response;
    const response = handler(Object.assign(request, { auth: null }));
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/");
    expect(location.searchParams.get("returnTo")).toBe("/trainer/invite");
  });

  it("passes authenticated entry through to destination authorization", () => {
    const request = new NextRequest("https://app.example.test/trainer/apply");
    const handler = middleware as unknown as (r: NextRequest & { auth: unknown }) => Response;
    const response = handler(Object.assign(request, { auth: { user: {} } }));
    expect(response.headers.get("location")).toBeNull();
  });

  it("keeps an existing student on their requested application destination", async () => {
    await expect(HomePage({ searchParams: Promise.resolve({ returnTo: "/trainer/apply" }) }))
      .rejects.toThrow("redirect:/trainer/apply");
    expect(mocks.findUserByEmail).not.toHaveBeenCalled();
  });

  it("retains the invitation destination on the signed-out login button", async () => {
    mocks.getSessionEmail.mockResolvedValue(null);
    const element = await HomePage({ searchParams: Promise.resolve({ returnTo: "/trainer/invite/fixture" }) });
    expect(element.type).toBe(LoginScene);
    expect(element.props.returnTo).toBe("/trainer/invite");
  });

  it("passes the validated destination to Google sign-in", () => {
    const tree = LoginScene({ returnTo: "/trainer/invite/fixture" });
    type Node = React.ReactElement<{ children?: React.ReactNode; onClick?: () => void }>;
    const buttons: Node[] = [];
    const visit = (children: React.ReactNode) => React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return;
      const node = child as Node;
      if (node.type === "button") buttons.push(node);
      visit(node.props.children);
    });
    visit(tree);
    expect(buttons).toHaveLength(1);
    buttons[0]!.props.onClick!();
    expect(mocks.signIn).toHaveBeenCalledWith("google", { callbackUrl: "/trainer/invite" });
  });

  it.each([
    ["trainee", false, "/dashboard"], ["admin", false, "/admin"],
    ["trainer", false, "/trainer"], ["trainer", true, "/dashboard"],
  ])("preserves ordinary %s landing (own-view=%s)", async (role, ownView, destination) => {
    mocks.getEffectiveRole.mockResolvedValue({ role, status: "active" });
    mocks.isArenaSelfView.mockResolvedValue(ownView);
    await expect(HomePage({})).rejects.toThrow(`redirect:${destination}`);
  });

  it("ignores an external destination instead of redirecting a student off-site", async () => {
    await expect(HomePage({ searchParams: Promise.resolve({ returnTo: "https://example.org" }) }))
      .rejects.toThrow("redirect:/dashboard");
  });

  it("does not change an unregistered user's ordinary claim route", async () => {
    mocks.findUserByEmail.mockResolvedValue(null);
    await expect(HomePage({})).rejects.toThrow("redirect:/claim");
  });
});
