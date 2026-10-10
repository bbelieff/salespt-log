import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  ContextError,
  requireStudentViewContext,
  loadDashboard,
} = vi.hoisted(() => ({
  ContextError: class extends Error {
    constructor(public code: string, public status: 401 | 403) {
      super(code);
    }
  },
  requireStudentViewContext: vi.fn(),
  loadDashboard: vi.fn(),
}));

vi.mock("@/auth/identity", () => ({
  requireStudentViewContext,
  StudentViewContextError: ContextError,
}));
vi.mock("@/service", () => ({ loadDashboard }));
vi.mock("@/lib/analytics/api-timing", () => ({
  withApiTiming: (_label: string, handler: unknown) => handler,
}));

import { GET } from "@/app/api/dashboard/route";

describe("dashboard API authentication response", () => {
  beforeEach(() => {
    requireStudentViewContext.mockReset();
    loadDashboard.mockReset();
  });

  it("returns a safe 401 without exposing the shared authentication error", async () => {
    requireStudentViewContext.mockRejectedValue(
      new ContextError("unauthenticated", 401),
    );

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "unauthenticated",
      code: "unauthenticated",
    });
    expect(loadDashboard).not.toHaveBeenCalled();
  });

  it("does not expose internal failures", async () => {
    requireStudentViewContext.mockRejectedValue(new Error("private lookup detail"));

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "student_view_unavailable",
      code: "student_view_unavailable",
    });
    expect(loadDashboard).not.toHaveBeenCalled();
  });

  it("preserves the arena override and dashboard success path", async () => {
    const view = { kpi: { totalCost: 12_345 } };
    requireStudentViewContext.mockResolvedValue({
      ok: true,
      mode: "arena",
      email: "owner@example.com",
      sheetOverride: "arena-sheet-id",
    });
    loadDashboard.mockResolvedValue(view);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(view);
    expect(loadDashboard).toHaveBeenCalledWith("owner@example.com", "arena-sheet-id");
  });
});
