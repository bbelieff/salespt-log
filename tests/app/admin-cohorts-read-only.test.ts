import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal("React", React);

const deps = vi.hoisted(() => ({
  getSessionEmail: vi.fn(),
  canViewAdminPages: vi.fn(),
  isAdminEmail: vi.fn(),
  listDistinctUsers: vi.fn(),
  listCohorts: vi.fn(),
  ensureCohortsTab: vi.fn(),
  setCohortStatus: vi.fn(),
  setSeasonStart: vi.fn(),
  countPendingCohortCreates: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

vi.mock("@/auth/identity", () => ({
  getSessionEmail: deps.getSessionEmail,
  canViewAdminPages: deps.canViewAdminPages,
  isAdminEmail: deps.isAdminEmail,
}));

vi.mock("@/repo/users", () => ({
  listDistinctUsers: deps.listDistinctUsers,
}));

vi.mock("@/repo/cohorts", () => ({
  listCohorts: deps.listCohorts,
  ensureCohortsTab: deps.ensureCohortsTab,
  setCohortStatus: deps.setCohortStatus,
  setSeasonStart: deps.setSeasonStart,
}));

vi.mock("@/repo/db/cohort-pending", () => ({
  countPendingCohortCreates: deps.countPendingCohortCreates,
}));

vi.mock("@/components/auth/CohortMgmtPanel", () => ({
  default: vi.fn(() => null),
}));

import AdminCohortsPage from "@/app/admin/cohorts/page";

function expectNoMutation() {
  expect(deps.ensureCohortsTab).not.toHaveBeenCalled();
  expect(deps.setCohortStatus).not.toHaveBeenCalled();
  expect(deps.setSeasonStart).not.toHaveBeenCalled();
}

describe("GET /admin/cohorts read-only boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deps.getSessionEmail.mockResolvedValue("admin@example.com");
    deps.canViewAdminPages.mockResolvedValue(true);
    deps.isAdminEmail.mockReturnValue(true);
    deps.listDistinctUsers.mockResolvedValue([
      { role: "trainee", cohort: "7기" },
    ]);
    deps.listCohorts.mockResolvedValue([]);
    deps.countPendingCohortCreates.mockResolvedValue(0);
  });

  it("renders without ensuring the tab or invoking any cohort write", async () => {
    await expect(AdminCohortsPage()).resolves.toBeTruthy();

    expect(deps.listDistinctUsers).toHaveBeenCalledOnce();
    expect(deps.listCohorts).toHaveBeenCalledOnce();
    expectNoMutation();
  });

  it("fails closed on a roster read 429 without ensuring or writing", async () => {
    const quotaError = Object.assign(new Error("Sheets read quota exceeded"), {
      code: 429,
    });
    deps.listDistinctUsers.mockRejectedValue(quotaError);

    await expect(AdminCohortsPage()).rejects.toBe(quotaError);
    expect(deps.listCohorts).not.toHaveBeenCalled();
    expectNoMutation();
  });
});
