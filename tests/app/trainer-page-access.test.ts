import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal("React", React);

const m = vi.hoisted(() => ({
  session: vi.fn(),
  effectiveRole: vi.fn(),
  canViewAdmin: vi.fn(),
  isAdmin: vi.fn(),
  findUser: vi.fn(),
  listUsers: vi.fn(),
  archivedCohorts: vi.fn(),
  enrichDates: vi.fn(),
  enrichStats: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
vi.mock("@/auth/identity", () => ({
  getSessionEmail: m.session,
  getEffectiveRole: m.effectiveRole,
  canViewAdminPages: m.canViewAdmin,
  isAdminEmail: m.isAdmin,
}));
vi.mock("@/config", () => ({
  adminEmails: () => [],
  adminNames: () => ({}),
}));
vi.mock("@/repo/users", () => ({
  findUserByEmail: m.findUser,
  listDistinctUsers: m.listUsers,
  isReservedTrainee: () => false,
}));
vi.mock("@/repo/cohorts", () => ({
  getArchivedCohortSet: m.archivedCohorts,
}));
vi.mock("@/service", () => ({
  enrichUsersWithDates: m.enrichDates,
  enrichUsersWithStats: m.enrichStats,
}));
vi.mock("@/components/auth/TrainerCohortView", () => ({
  default: (props: unknown) => React.createElement("div", { "data-props": props }, "trainer roster"),
}));

import TrainerPage from "@/app/trainer/page";

function expectNoRosterRead() {
  expect(m.findUser).not.toHaveBeenCalled();
  expect(m.listUsers).not.toHaveBeenCalled();
  expect(m.archivedCohorts).not.toHaveBeenCalled();
  expect(m.enrichDates).not.toHaveBeenCalled();
  expect(m.enrichStats).not.toHaveBeenCalled();
}

describe("/trainer access boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.session.mockResolvedValue("trainer@example.test");
    m.effectiveRole.mockResolvedValue({ role: "trainer", status: "active" });
    m.canViewAdmin.mockResolvedValue(false);
    m.isAdmin.mockReturnValue(false);
    m.findUser.mockResolvedValue({
      email: "trainer@example.test",
      name: "Active Trainer",
      role: "trainer",
      status: "active",
    });
    m.listUsers.mockResolvedValue([]);
    m.archivedCohorts.mockResolvedValue(new Set<string>());
    m.enrichDates.mockImplementation(async (users: unknown[]) => users);
    m.enrichStats.mockImplementation(async (users: unknown[]) => users);
  });

  it("keeps the current active-trainer roster route", async () => {
    const page = await TrainerPage();

    expect(page).toBeTruthy();
    expect(m.listUsers).toHaveBeenCalledOnce();
    expect(m.enrichDates).toHaveBeenCalledOnce();
    expect(m.enrichStats).toHaveBeenCalledOnce();
  });

  it("keeps pending trainers on the existing application route without roster reads", async () => {
    m.effectiveRole.mockResolvedValue({ role: "trainer", status: "pending" });

    await expect(TrainerPage()).rejects.toThrow("redirect:/trainer/apply");
    expectNoRosterRead();
  });

  it("denies an archived trainer-only account before any roster or stats read", async () => {
    m.effectiveRole.mockResolvedValue({ role: "trainer", status: "archived" });

    await expect(TrainerPage()).rejects.toThrow("redirect:/");
    expectNoRosterRead();
  });

  it.each(["active", "archived"])(
    "returns an own %s trainee or alumni identity to its existing CRM entry path",
    async (status) => {
      m.effectiveRole.mockResolvedValue({ role: "trainee", status });

      await expect(TrainerPage()).rejects.toThrow("redirect:/");
      expectNoRosterRead();
    },
  );

  it("uses the same safe redirect for trainer-only denial and ordinary non-trainer access", async () => {
    m.effectiveRole.mockResolvedValue({ role: "trainer", status: "archived" });
    await expect(TrainerPage()).rejects.toThrow("redirect:/");

    vi.clearAllMocks();
    m.session.mockResolvedValue("student@example.test");
    m.effectiveRole.mockResolvedValue({ role: "trainee", status: "active" });
    await expect(TrainerPage()).rejects.toThrow("redirect:/");
    expectNoRosterRead();
  });
});
