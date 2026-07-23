import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCurrentUserEmail,
  isArenaSelfView,
  loadDashboard,
  resolveArenaOverride,
} = vi.hoisted(() => ({
  getCurrentUserEmail: vi.fn(),
  isArenaSelfView: vi.fn(),
  loadDashboard: vi.fn(),
  resolveArenaOverride: vi.fn(),
}));

vi.mock("@/auth/stub", () => ({ getCurrentUserEmail }));
vi.mock("@/auth/identity", () => ({ isArenaSelfView }));
vi.mock("@/service", () => ({ loadDashboard, resolveArenaOverride }));
vi.mock("@/lib/analytics/api-timing", () => ({
  withApiTiming: (_label: string, handler: unknown) => handler,
}));

import { GET } from "@/app/api/dashboard/route";

describe("dashboard API authentication response", () => {
  beforeEach(() => {
    getCurrentUserEmail.mockReset();
    isArenaSelfView.mockReset();
    loadDashboard.mockReset();
    resolveArenaOverride.mockReset();
  });

  it("returns a safe 401 without exposing the shared authentication error", async () => {
    getCurrentUserEmail.mockRejectedValue(new Error("[auth] 로그인 상세 정보"));

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthenticated" });
    expect(isArenaSelfView).not.toHaveBeenCalled();
    expect(loadDashboard).not.toHaveBeenCalled();
  });

  it("preserves non-authentication failures as the existing 500 response", async () => {
    getCurrentUserEmail.mockResolvedValue("owner@example.com");
    isArenaSelfView.mockRejectedValue(new Error("dashboard lookup failed"));

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "dashboard lookup failed" });
    expect(loadDashboard).not.toHaveBeenCalled();
  });

  it("preserves the arena override and dashboard success path", async () => {
    const view = { kpi: { totalCost: 12_345 } };
    getCurrentUserEmail.mockResolvedValue("owner@example.com");
    isArenaSelfView.mockResolvedValue(true);
    resolveArenaOverride.mockResolvedValue("arena-sheet-id");
    loadDashboard.mockResolvedValue(view);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(view);
    expect(resolveArenaOverride).toHaveBeenCalledWith("owner@example.com");
    expect(loadDashboard).toHaveBeenCalledWith("owner@example.com", "arena-sheet-id");
  });
});
