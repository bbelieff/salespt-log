import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  session: "trainer@example.test" as string | null,
  jar: new Map<string, string>(),
  trainer: { email: "trainer@example.test", role: "trainer", status: "active", name: "T" } as Record<string, unknown> | null,
  own: { email: "trainer@example.test", role: "trainer", status: "active", name: "T", spreadsheetId: "trainer-sheet" } as Record<string, unknown> | null,
  target: { email: "student@example.test", role: "trainee", status: "active", assignedTrainer: "trainer@example.test", spreadsheetId: "student-sheet" } as Record<string, unknown> | null,
  allUsers: [] as Array<Record<string, unknown>>,
  registryRows: [] as Array<Record<string, unknown>>,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (key: string) => m.jar.has(key) ? { value: m.jar.get(key) } : undefined,
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));
vi.mock("@/auth", () => ({ auth: async () => m.session ? { user: { email: m.session } } : null }));
vi.mock("@/auth/dev-stub", () => ({ isDevStubAuthed: () => false }));
vi.mock("@/config", () => ({ adminEmails: () => [] }));
vi.mock("@/repo/users", () => ({
  findTrainerByEmail: async () => m.trainer,
  findUserByEmail: async (email: string) =>
    email.toLowerCase() === "student@example.test" ? m.target : m.own,
  parseAssignedTrainers: (raw: string) =>
    String(raw ?? "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean),
  listAllUsers: async () => m.allUsers,
  cachedRegistryRows: async () => m.registryRows,
  parseRow: (row: Record<string, unknown>) => row,
}));

import { resolveStudentViewContext } from "@/auth/identity";
import { resolveOwnArenaSheetId } from "@/repo/users-arena";

describe("resolved student-view context", () => {
  beforeEach(() => {
    m.session = "trainer@example.test";
    m.jar.clear();
    m.trainer = { email: m.session, role: "trainer", status: "active", name: "T" };
    m.own = { email: m.session, role: "trainer", status: "active", name: "T", spreadsheetId: "trainer-sheet" };
    m.target = { email: "student@example.test", role: "trainee", status: "active", assignedTrainer: m.session, spreadsheetId: "student-sheet" };
    m.allUsers = [];
    m.registryRows = [];
  });

  it("does not treat a raw self flag as authorization", async () => {
    m.jar.set("salespt_arena_self", "1");

    await expect(resolveStudentViewContext()).resolves.toEqual({
      ok: false,
      status: 403,
      code: "student_view_forbidden",
    });
  });

  it("distinguishes a malformed or revoked target from no target", async () => {
    m.jar.set("salespt_as", "not-an-email");
    await expect(resolveStudentViewContext()).resolves.toMatchObject({
      ok: false,
      code: "invalid_student_target",
    });

    m.jar.set("salespt_as", "student@example.test");
    m.target = { ...m.target!, assignedTrainer: "somebody-else@example.test" };
    await expect(resolveStudentViewContext()).resolves.toMatchObject({
      ok: false,
      code: "invalid_student_target",
    });
  });

  it("passes an active trainer's currently assigned mapped target", async () => {
    m.jar.set("salespt_as", "student@example.test");
    m.jar.set("salespt_arena_self", "1");
    m.registryRows = [{
      email: m.session,
      role: "trainer",
      status: "active",
      name: "T",
    }];
    m.allUsers = [{
      email: "legacy-student@example.test",
      role: "trainee",
      status: "archived",
      cohort: "7",
      name: "T",
      spreadsheetId: "legacy-arena-sheet",
    }];

    await expect(resolveStudentViewContext()).resolves.toEqual({
      ok: true,
      mode: "assigned",
      email: "student@example.test",
    });
  });

  it("denies an inactive trainer even when the target still names them", async () => {
    m.jar.set("salespt_as", "student@example.test");
    m.trainer = { ...m.trainer!, status: "revoked" };

    await expect(resolveStudentViewContext()).resolves.toMatchObject({
      ok: false,
      code: "invalid_student_target",
    });
  });

  it("preserves an own-student capability after current reread", async () => {
    m.jar.set("salespt_arena_self", "1");
    m.own = { email: m.session, role: "trainee", status: "active", spreadsheetId: "own-sheet" };

    await expect(resolveStudentViewContext()).resolves.toEqual({
      ok: true,
      mode: "own",
      email: "trainer@example.test",
    });
  });

  it("preserves exactly one current own-arena candidate and denies duplicates", async () => {
    m.jar.set("salespt_arena_self", "1");
    m.allUsers = [{
      email: m.session,
      role: "trainee",
      status: "active",
      cohort: "A2-1",
      spreadsheetId: "arena-sheet",
    }];
    await expect(resolveStudentViewContext()).resolves.toMatchObject({
      ok: true,
      mode: "arena",
      sheetOverride: "arena-sheet",
    });

    m.allUsers.push({
      email: m.session,
      role: "trainee",
      status: "active",
      cohort: "A2-2",
      spreadsheetId: "second-arena-sheet",
    });
    await expect(resolveStudentViewContext()).resolves.toMatchObject({
      ok: false,
      code: "student_view_forbidden",
    });
  });

  it("preserves a unique same-email archived numeric trainee identity", async () => {
    m.jar.set("salespt_arena_self", "1");
    m.allUsers = [{
      email: m.session,
      role: "trainee",
      status: "archived",
      cohort: "7",
      name: "T",
      spreadsheetId: "same-email-alumni-sheet",
    }];

    await expect(resolveStudentViewContext()).resolves.toEqual({
      ok: true,
      mode: "arena",
      email: "trainer@example.test",
      sheetOverride: "same-email-alumni-sheet",
    });
  });

  it("binds a trusted legacy archived arena row to its actual trainee identity", async () => {
    m.jar.set("salespt_arena_self", "1");
    m.registryRows = [{
      email: m.session,
      role: "trainer",
      status: "active",
      name: "T",
    }];
    m.allUsers = [{
      email: "legacy-student@example.test",
      role: "trainee",
      status: "archived",
      cohort: "A2-1",
      name: "T",
      spreadsheetId: "legacy-arena-sheet",
    }];

    await expect(resolveStudentViewContext()).resolves.toEqual({
      ok: true,
      mode: "arena",
      email: "legacy-student@example.test",
      sheetOverride: "legacy-arena-sheet",
    });
  });

  it("denies a legacy match when that email resolves to a different effective CRM row", async () => {
    m.jar.set("salespt_arena_self", "1");
    m.registryRows = [{
      email: m.session,
      role: "trainer",
      status: "active",
      name: "T",
    }];
    m.allUsers = [
      {
        email: "legacy-student@example.test",
        role: "trainee",
        status: "archived",
        cohort: "A2-1",
        name: "T",
        spreadsheetId: "legacy-arena-sheet",
      },
      {
        email: "legacy-student@example.test",
        role: "trainee",
        status: "active",
        cohort: "10",
        name: "Different person",
        spreadsheetId: "effective-crm-sheet",
      },
    ];

    await expect(resolveStudentViewContext()).resolves.toMatchObject({
      ok: false,
      code: "student_view_forbidden",
    });
  });

  it("does not expose a numeric-only name match to sheet-only self-view consumers", async () => {
    m.registryRows = [{
      email: m.session,
      role: "trainer",
      status: "active",
      name: "T",
    }];
    m.allUsers = [{
      email: "foreign-student@example.test",
      role: "trainee",
      status: "active",
      cohort: "10",
      name: "T",
      spreadsheetId: "foreign-numeric-sheet",
    }];

    await expect(resolveOwnArenaSheetId(m.session!, "T")).resolves.toBeNull();
  });

  it("denies duplicate, pending, or unmapped legacy name matches", async () => {
    m.jar.set("salespt_arena_self", "1");
    m.registryRows = [{
      email: m.session,
      role: "trainer",
      status: "active",
      name: "T",
    }];
    m.allUsers = [
      {
        email: "legacy-one@example.test",
        role: "trainee",
        status: "active",
        cohort: "A2-1",
        name: "T",
        spreadsheetId: "legacy-one-sheet",
      },
      {
        email: "legacy-two@example.test",
        role: "trainee",
        status: "archived",
        cohort: "A2-2",
        name: "T",
        spreadsheetId: "legacy-two-sheet",
      },
    ];

    await expect(resolveStudentViewContext()).resolves.toMatchObject({
      ok: false,
      code: "student_view_forbidden",
    });

    m.allUsers = [{
      email: "legacy-student@example.test",
      role: "trainee",
      status: "pending",
      cohort: "A2-1",
      name: "T",
      spreadsheetId: "legacy-arena-sheet",
    }];
    await expect(resolveStudentViewContext()).resolves.toMatchObject({
      ok: false,
      code: "student_view_forbidden",
    });

    m.allUsers = [{
      email: "legacy-student@example.test",
      role: "trainee",
      status: "archived",
      cohort: "A2-1",
      name: "T",
      spreadsheetId: "",
    }];
    await expect(resolveStudentViewContext()).resolves.toMatchObject({
      ok: false,
      code: "student_view_forbidden",
    });
  });

  it("denies the legacy fallback for an inactive or untrusted registry trainer", async () => {
    m.jar.set("salespt_arena_self", "1");
    m.allUsers = [{
      email: "legacy-student@example.test",
      role: "trainee",
      status: "active",
      cohort: "A2-1",
      name: "T",
      spreadsheetId: "legacy-arena-sheet",
    }];
    m.registryRows = [{
      email: m.session,
      role: "trainer",
      status: "archived",
      name: "T",
    }];

    await expect(resolveStudentViewContext()).resolves.toMatchObject({
      ok: false,
      code: "student_view_forbidden",
    });

    m.registryRows = [];
    await expect(resolveStudentViewContext()).resolves.toMatchObject({
      ok: false,
      code: "student_view_forbidden",
    });
  });

  it("returns a stable unauthenticated result without reading cookies as authority", async () => {
    m.session = null;
    m.jar.set("salespt_arena_self", "1");

    await expect(resolveStudentViewContext()).resolves.toEqual({
      ok: false,
      status: 401,
      code: "unauthenticated",
    });
  });
});
