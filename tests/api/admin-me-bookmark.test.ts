import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  session: "admin@example.com" as string | null,
  admin: true,
  setImpersonation: vi.fn(async (_v: string | null) => {}),
}));
vi.mock("@/auth/identity", () => ({
  getSessionEmail: async () => m.session,
  isAdminEmail: () => m.admin,
  setImpersonation: (v: string | null) => m.setImpersonation(v),
}));
vi.mock("@/auth/revalidate-admin", () => ({ revalidateAdminPages: () => {} }));

import { GET } from "@/app/admin/me/route";

const req = () => new Request("https://salesptlog.online/admin/me");

describe("관리자 본인 화면 바로가기", () => {
  beforeEach(() => { m.session = "admin@example.com"; m.admin = true; m.setImpersonation.mockClear(); });

  it("관리자는 대리 보기를 끄고 본인 대시보드로 간다", async () => {
    const res = await GET(req());
    expect(m.setImpersonation).toHaveBeenCalledWith(null);
    expect(res.headers.get("location")).toBe("https://salesptlog.online/dashboard");
  });

  it("관리자가 아니면 아무것도 바꾸지 않는다", async () => {
    m.admin = false;
    await GET(req());
    expect(m.setImpersonation).not.toHaveBeenCalled();
  });

  it("로그인 안 했으면 첫 화면으로 보낸다", async () => {
    m.session = null;
    const res = await GET(req());
    expect(res.headers.get("location")).toBe("https://salesptlog.online/");
  });
});
