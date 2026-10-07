import { describe, it, expect, vi, beforeEach } from "vitest";

const setImpersonation = vi.fn(async (_v: string | null) => {});
vi.mock("@/auth/identity", () => ({
  getSessionEmail: async () => "admin@example.com",
  canImpersonate: async () => true,
  setImpersonation: (v: string | null) => setImpersonation(v),
  getActiveUserEmail: async () => "admin@example.com",
}));
vi.mock("@/auth/revalidate-admin", () => ({ revalidateAdminPages: () => {} }));
const findUserByEmail = vi.fn();
vi.mock("@/repo/users", () => ({ findUserByEmail: (e: string) => findUserByEmail(e) }));
vi.mock("@/repo/users-arena", () => ({ resolveOwnArenaSheetId: async () => null }));
vi.mock("@/service", () => ({ warmBundle: () => {} }));
vi.mock("@/lib/analytics/api-timing", () => ({ withApiTiming: (_n: string, h: unknown) => h }));

import { POST } from "@/app/api/admin/switch/route";

const req = (email: string) =>
  new Request("http://x/api/admin/switch", { method: "POST", body: JSON.stringify({ email }) });

describe("관리자 본인 선택", () => {
  beforeEach(() => { setImpersonation.mockClear(); findUserByEmail.mockReset(); });

  it("본인 이메일을 고르면 대리 보기를 끄고 본인 화면으로 연다", async () => {
    const res = await POST(req("Admin@Example.com"));
    expect(res.status).toBe(200);
    expect(setImpersonation).toHaveBeenCalledWith(null);
    expect(findUserByEmail).not.toHaveBeenCalled();
  });
});
