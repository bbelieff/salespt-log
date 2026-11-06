/**
 * 2026-11-06 0기 코스텝 사고: 트레이너가 [웹앱]으로 수강생 화면을 연 뒤(salespt_as 쿠키) /claim 하면
 * 그 수강생 계정으로 클레임돼 사전등록 행이 비어 남았다. 클레임은 항상 로그인한 본인 이메일. 가상 이메일만.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  session: vi.fn(async (): Promise<string | null> => "coach@example.test"),
  claim: vi.fn(async (email: string) => ({ email, cohort: "0", name: "코스텝", spreadsheetId: "s", role: "trainee", status: "active" })),
}));
vi.mock("@/auth/identity", () => ({
  getSessionEmail: m.session,
  isAdminEmail: () => false,
  // 대리 보기 대상 — 클레임 라우트가 이걸 쓰면 안 된다.
  getActiveUserEmail: async () => "student@example.test",
}));
vi.mock("@/auth/stub", () => ({ getCurrentUserEmail: async () => "student@example.test" }));
vi.mock("@/service/auth", () => ({ claimAccount: m.claim, ClaimError: class extends Error { reason = "not_found"; } }));
vi.mock("@/auth/revalidate-admin", () => ({ revalidateAdminPages: () => {} }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/analytics/api-timing", () => ({ withApiTiming: (_n: string, h: unknown) => h }));
import { POST } from "@/app/api/claim/route";

const req = () => new Request("http://x/api/claim", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cohort: "0", name: "코스텝" }) });
beforeEach(() => { m.claim.mockClear(); m.session.mockResolvedValue("coach@example.test"); });

describe("/api/claim 은 로그인한 본인 이메일로", () => {
  it("대리 보기 중이어도 세션 이메일로 클레임", async () => {
    const res = await (POST as (r: Request) => Promise<Response>)(req());
    expect(res.status).toBe(200);
    expect(m.claim).toHaveBeenCalledWith("coach@example.test", "0", "코스텝", { isAdmin: false });
  });
  it("로그인 안 했으면 401", async () => {
    m.session.mockResolvedValue(null);
    const res = await (POST as (r: Request) => Promise<Response>)(req());
    expect(res.status).toBe(401);
    expect(m.claim).not.toHaveBeenCalled();
  });
});
