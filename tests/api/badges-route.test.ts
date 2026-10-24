import { beforeEach, describe, expect, it, vi } from "vitest";

const { ContextError, requireStudentViewContext, loadBadges } = vi.hoisted(() => ({
  ContextError: class extends Error {
    constructor(public code: string, public status: 401 | 403) { super(code); }
  },
  requireStudentViewContext: vi.fn(),
  loadBadges: vi.fn(),
}));

vi.mock("@/auth/identity", () => ({ requireStudentViewContext, StudentViewContextError: ContextError }));
vi.mock("@/service/badges", () => ({ loadBadges }));
vi.mock("@/lib/analytics/api-timing", () => ({ withApiTiming: (_l: string, h: unknown) => h }));

import { GET } from "@/app/api/badges/route";

describe("GET /api/badges", () => {
  beforeEach(() => { requireStudentViewContext.mockReset(); loadBadges.mockReset(); });

  it("reads the viewed student's badges (impersonation and arena sheet passed through)", async () => {
    requireStudentViewContext.mockResolvedValue({ ok: true, mode: "arena", email: "student@example.com", sheetOverride: "sheet-x" });
    loadBadges.mockResolvedValue({ badges: [], partial: false });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(loadBadges).toHaveBeenCalledWith("student@example.com", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), "sheet-x");
  });

  it("auth failure returns its code without loading", async () => {
    requireStudentViewContext.mockRejectedValue(new ContextError("unauthenticated", 401));
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthenticated" });
    expect(loadBadges).not.toHaveBeenCalled();
  });

  it("missing sheet → 404, anything else → 503 with a plain message", async () => {
    requireStudentViewContext.mockResolvedValue({ ok: true, mode: "own", email: "s@example.com" });
    loadBadges.mockRejectedValueOnce(new Error("[no-sheet] Invalid student sheet"));
    expect((await GET()).status).toBe(404);
    loadBadges.mockRejectedValueOnce(new Error("db down"));
    const res = await GET();
    expect(res.status).toBe(503);
    expect((await res.json()).error).not.toContain("db down");
  });
});
