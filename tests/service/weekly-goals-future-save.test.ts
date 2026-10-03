import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_GOALS } from "@/types/weekly-goals";

const m = vi.hoisted(() => ({
  grant: vi.fn(),
  getSessionEmail: vi.fn(), getActiveUserEmail: vi.fn(), getEffectiveRole: vi.fn(), findActiveArenaRowByEmail: vi.fn(),
  findUserByEmail: vi.fn(), listAllUsers: vi.fn(), listDistinctUsers: vi.fn(), dbEnabled: vi.fn(), chooseDailySource: vi.fn(),
  readSalesRowsFromDb: vi.fn(), readMeetingsFromDb: vi.fn(), readContractsFromDb: vi.fn(),
  readWeeklyGoal: vi.fn(), readWeeklyGoalPrivate: vi.fn(), saveWeeklyGoal: vi.fn(), saveWeeklyGoalPrivate: vi.fn(),
}));
vi.mock("@/auth/identity", () => m);
vi.mock("@/repo/users-arena", () => m);
vi.mock("@/repo/users", () => ({ ...m, parseAssignedTrainers: (s: string) => s.toLowerCase().split(",").map(v => v.trim()).filter(Boolean) }));
vi.mock("@/repo/db/client", () => m);
vi.mock("@/repo/db/read-daily", () => m);
vi.mock("@/repo/db/weekly-goals", () => m);
vi.mock("@/service/daily-source", () => m);
vi.mock("@/repo/db/trainer-student-access", () => ({
  readTrainerStudentAccessFacts: async (actor: string, target: string | { email: string; spreadsheetId: string; cohort: string; courseStart: string }) => {
    const found = (m.listAllUsers.getMockImplementation() ? await m.listAllUsers() : []) as { email: string; role: string; status: string; cohort?: string; spreadsheetId?: string; courseStartISO?: string }[];
    const email = (typeof target === "string" ? target : target.email).toLowerCase();
    const rows = found.filter(u => u.email.toLowerCase() === email && u.role === "trainee");
    const match = typeof target === "string" ? rows
      : rows.filter(u => u.spreadsheetId === target.spreadsheetId && u.cohort === target.cohort && u.courseStartISO === target.courseStart);
    return {
      qualifications: [{ email: actor.toLowerCase(), status: "active" }],
      settings: [{ grade: "senior", grants: { active: { read: m.grant(), write: m.grant() }, arena: { read: m.grant(), write: m.grant() }, archived: { read: m.grant(), write: m.grant() } }, version: 1 }],
      students: match.map(u => ({ email: u.email, role: u.role, status: u.status, cohort: u.cohort ?? "", cohort_label: u.cohort ?? "", spreadsheet_id: u.spreadsheetId, course_start_iso: u.courseStartISO })),
      cohorts: [],
    };
  },
}));

import { loadWeeklyGoals, updateWeeklyGoals, updateWeeklyGoalInternal } from "@/service/weekly-goals";

const student = { email: "student@example.test", name: "Test Student", role: "trainee", status: "active", cohort: "test-cohort", courseStartISO: "2026-09-04", spreadsheetId: "fixture-sheet", assignedTrainer: "trainer@example.test", team: "test-region", refreshToken: "PRIVATE-TOKEN" };
const emptyRecord = () => ({ goals: { ...EMPTY_GOALS }, task: "", revision: 0, updatedAt: null });
const input = () => ({ goals: { ...EMPTY_GOALS }, task: "PT task", revision: 0 });
const params = (week = "1") => new URLSearchParams({ student: student.email, week, enrollment: JSON.stringify([student.cohort, student.courseStartISO]) });

beforeEach(() => {
  vi.resetAllMocks();
  m.grant.mockReturnValue(true);
  m.getSessionEmail.mockResolvedValue(student.email);
  m.getActiveUserEmail.mockResolvedValue(student.email);
  m.getEffectiveRole.mockResolvedValue({ role: "trainee", status: "active" });
  m.findActiveArenaRowByEmail.mockResolvedValue(null);
  m.findUserByEmail.mockResolvedValue({ ...student });
  m.listAllUsers.mockResolvedValue([{ ...student }]);
  m.listDistinctUsers.mockResolvedValue([{ ...student }]);
  m.dbEnabled.mockReturnValue(true);
  m.chooseDailySource.mockReturnValue("db");
  m.readSalesRowsFromDb.mockResolvedValue([]);
  m.readMeetingsFromDb.mockResolvedValue([]);
  m.readContractsFromDb.mockResolvedValue([]);
  m.readWeeklyGoal.mockImplementation(async () => emptyRecord());
  m.readWeeklyGoalPrivate.mockResolvedValue({ specialNotes: "", priorOutcome: "", revision: 0, updatedAt: null });
  m.saveWeeklyGoal.mockResolvedValue(true);
  m.saveWeeklyGoalPrivate.mockResolvedValue(true);
});

describe("weekly saves are allowed for past, current and future weeks", () => {
  it.each(["1", "2", "3", "12", "100"])("public save succeeds for week %s with no date lock", async week => {
    await expect(updateWeeklyGoals(params(week), input())).resolves.toEqual({ revision: 1 });
    expect(m.saveWeeklyGoal).toHaveBeenCalledOnce();
  });
  it("derives isolated Friday keys per week under one enrollment", async () => {
    await updateWeeklyGoals(params("12"), input());
    expect(m.saveWeeklyGoal).toHaveBeenCalledWith(
      { studentId: student.spreadsheetId, cohort: student.cohort, courseStart: student.courseStartISO, weekStart: "2026-11-20" },
      input(),
    );
    const view = await loadWeeklyGoals(params("12"));
    expect(view.current).toMatchObject({ week: 12, start: "2026-11-20" });
  });
  it("internal save succeeds for a future week with empty or filled prior outcomes", async () => {
    m.getEffectiveRole.mockResolvedValue({ role: "admin", status: "active" });
    await expect(updateWeeklyGoalInternal(params("12"), { specialNotes: "", priorOutcome: "", revision: 0 })).resolves.toEqual({ revision: 1 });
    await expect(updateWeeklyGoalInternal(params("12"), { specialNotes: "future notes", priorOutcome: "previous outcome", revision: 0 })).resolves.toEqual({ revision: 1 });
    expect(m.saveWeeklyGoalPrivate).toHaveBeenCalledTimes(2);
  });
  it.each(["0", "5201"])("still rejects out-of-range week %s", async week => {
    await expect(updateWeeklyGoals(params(week), input())).rejects.toMatchObject({ status: 400 });
    expect(m.saveWeeklyGoal).not.toHaveBeenCalled();
  });
  it("preserves enrollment isolation, revision safety and permission on future weeks", async () => {
    const stale = params("12"); stale.set("enrollment", "stale-enrollment");
    await expect(updateWeeklyGoals(stale, input())).rejects.toMatchObject({ status: 409 });
    m.saveWeeklyGoal.mockResolvedValue(false);
    await expect(updateWeeklyGoals(params("12"), input())).rejects.toMatchObject({ status: 409 });
    m.saveWeeklyGoal.mockResolvedValue(true);
    await expect(updateWeeklyGoalInternal(params("12"), { specialNotes: "x", priorOutcome: "y", revision: 0 })).rejects.toMatchObject({ status: 403 });
    expect(m.saveWeeklyGoalPrivate).not.toHaveBeenCalled();
  });
});
