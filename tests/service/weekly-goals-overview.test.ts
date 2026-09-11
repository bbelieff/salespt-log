import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_GOALS, type GoalStudent, type WeeklyGoalRecord } from "@/types/weekly-goals";

const m = vi.hoisted(() => ({
  listGoalStudents: vi.fn(), assertGoalStudentAccess: vi.fn(), findUserByEmail: vi.fn(), readWeeklyGoal: vi.fn(),
  readWeeklyGoalPrivate: vi.fn(), readSalesRowsFromDb: vi.fn(), dbEnabled: vi.fn(), chooseDailySource: vi.fn(),
}));
vi.mock("@/service/weekly-goals", () => ({ listGoalStudents: m.listGoalStudents, assertGoalStudentAccess: m.assertGoalStudentAccess }));
vi.mock("@/repo/users", () => ({ findUserByEmail: m.findUserByEmail }));
vi.mock("@/repo/db/weekly-goals", () => ({ readWeeklyGoal: m.readWeeklyGoal, readWeeklyGoalPrivate: m.readWeeklyGoalPrivate }));
vi.mock("@/repo/db/client", () => ({ dbEnabled: m.dbEnabled, readSalesRowsFromDb: m.readSalesRowsFromDb }));
vi.mock("@/service/daily-source", () => ({ chooseDailySource: m.chooseDailySource }));
import { loadGoalOverview } from "@/service/weekly-goals-overview";

const student = (index = 1): GoalStudent => ({ email: `student${index}@example.test`, name: `Fixture ${index}`, cohort: "test-cohort" });
const record = (): WeeklyGoalRecord => ({ goals: { ...EMPTY_GOALS, production: 0 }, task: "Fixture task", revision: 1, updatedAt: "2026-09-11T00:00:00.000Z" });
const user = (email = student().email, over: Record<string, unknown> = {}) => ({ ...student(), email, role: "trainee", status: "active", assignedTrainer: "trainer@example.test", courseStartISO: "2026-09-07", refreshToken: "PRIVATE-FIXTURE-TOKEN", ...over });
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-11T00:00:00Z"));
  m.listGoalStudents.mockResolvedValue([student()]);
  m.assertGoalStudentAccess.mockResolvedValue(undefined);
  m.findUserByEmail.mockImplementation(async (email: string) => user(email));
  m.dbEnabled.mockReturnValue(true);
  m.chooseDailySource.mockReturnValue("db");
  m.readWeeklyGoal.mockImplementation(async () => record());
});
afterEach(() => vi.useRealTimers());

describe("trainer goal overview authorization and row failures", () => {
  it.each([401, 403])("propagates roster authorization status %i without querying any student", async status => {
    const error = Object.assign(new Error("denied"), { status });
    m.listGoalStudents.mockRejectedValue(error);
    await expect(loadGoalOverview()).rejects.toBe(error);
    expect(m.findUserByEmail).not.toHaveBeenCalled();
    expect(m.readWeeklyGoal).not.toHaveBeenCalled();
  });
  it("only queries authorized roster targets and projects no user secrets or private records", async () => {
    m.listGoalStudents.mockResolvedValue([student(2), student(5)]);
    const result = await loadGoalOverview();
    expect(m.findUserByEmail.mock.calls.map(call => call[0])).toEqual([student(2).email, student(5).email]);
    expect(m.readWeeklyGoal.mock.calls.map(call => call[0].email)).toEqual([student(2).email, student(5).email]);
    expect(result.map(row => row.email)).toEqual([student(2).email, student(5).email]);
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|refreshToken|specialNotes|priorOutcome/);
    expect(m.readWeeklyGoalPrivate).not.toHaveBeenCalled();
    expect(m.readSalesRowsFromDb).not.toHaveBeenCalled();
  });
  it("returns an empty roster without any per-student calls", async () => {
    m.listGoalStudents.mockResolvedValue([]);
    expect(await loadGoalOverview()).toEqual([]);
    expect(m.findUserByEmail).not.toHaveBeenCalled();
    expect(m.readWeeklyGoal).not.toHaveBeenCalled();
  });
  it("rechecks the freshly resolved row and blocks a revoked assignment before goal I/O", async () => {
    const fresh = user(student().email, { assignedTrainer: "new-trainer@example.test" });
    m.findUserByEmail.mockResolvedValue(fresh);
    m.assertGoalStudentAccess.mockRejectedValue(Object.assign(new Error("assignment revoked"), { status: 403 }));
    expect(await loadGoalOverview()).toEqual([{ ...student(), week: null, record: null, error: "목표를 불러오지 못했어요." }]);
    expect(m.assertGoalStudentAccess).toHaveBeenCalledWith(fresh);
    expect(m.readWeeklyGoal).not.toHaveBeenCalled();
  });
  it.each([
    ["missing user", undefined],
    ["changed cohort", user(student().email, { cohort: "different-cohort" })],
    ["invalid course date", user(student().email, { courseStartISO: "2026-02-31" })],
  ])("reports explicit row error for %s rather than empty-success", async (_label, value) => {
    m.findUserByEmail.mockResolvedValue(value);
    expect(await loadGoalOverview()).toEqual([{ ...student(), week: null, record: null, error: "목표를 불러오지 못했어요." }]);
    expect(m.readWeeklyGoal).not.toHaveBeenCalled();
  });
  it("reports unsupported data source as a row error", async () => {
    m.chooseDailySource.mockReturnValue("sheet");
    expect((await loadGoalOverview())[0]).toMatchObject({ week: null, record: null, error: "목표를 불러오지 못했어요." });
    expect(m.readWeeklyGoal).not.toHaveBeenCalled();
  });
  it("contains individual read failure without replacing neighboring saved rows", async () => {
    m.listGoalStudents.mockResolvedValue([student(1), student(2), student(3)]);
    m.readWeeklyGoal.mockImplementation(async (key: { email: string }) => {
      if (key.email === student(2).email) throw new Error("postgres://fixture:private@fixture-db");
      return record();
    });
    const result = await loadGoalOverview();
    expect(result[0]).toMatchObject({ record: record(), error: null });
    expect(result[1]).toMatchObject({ record: null, week: null, error: "목표를 불러오지 못했어요." });
    expect(result[2]).toMatchObject({ record: record(), error: null });
    expect(JSON.stringify(result)).not.toContain("postgres");
  });
  it("distinguishes unsaved revision zero from a failed read and explicit numeric zero", async () => {
    const empty: WeeklyGoalRecord = { goals: { ...EMPTY_GOALS }, task: "", revision: 0, updatedAt: null };
    m.listGoalStudents.mockResolvedValue([student(1), student(2)]);
    m.readWeeklyGoal.mockResolvedValueOnce(empty).mockResolvedValueOnce(record());
    const result = await loadGoalOverview();
    expect(result[0]).toMatchObject({ record: empty, error: null });
    expect(result[1]?.record?.goals.production).toBe(0);
    expect(result[1]?.record?.revision).toBe(1);
  });
});

describe("overview uses course Friday week and KST today", () => {
  it.each([
    ["2026-09-09T00:00:00Z", 1, "2026-09-04"],
    ["2026-09-10T14:59:59Z", 1, "2026-09-04"],
    ["2026-09-10T15:00:00Z", 2, "2026-09-11"],
    ["2026-09-18T00:00:00Z", 3, "2026-09-18"],
    ["2026-08-20T00:00:00Z", 1, "2026-09-04"],
  ])("at %s selects week %i and persisted date %s for a Monday enrollment", async (now, week, weekStart) => {
    vi.setSystemTime(new Date(now));
    const result = await loadGoalOverview();
    expect(result[0]?.week).toBe(week);
    expect(m.readWeeklyGoal).toHaveBeenCalledWith({ email: student().email, cohort: student().cohort, courseStart: "2026-09-07", weekStart });
  });
});

describe("overview bounded concurrency", () => {
  it("allows at most four simultaneous record reads and preserves roster order", async () => {
    const students = Array.from({ length: 9 }, (_, index) => student(index + 1));
    m.listGoalStudents.mockResolvedValue(students);
    let active = 0, peak = 0;
    const pending: (() => void)[] = [];
    m.readWeeklyGoal.mockImplementation(() => {
      active++; peak = Math.max(peak, active);
      return new Promise<WeeklyGoalRecord>(resolve => pending.push(() => { active--; resolve(record()); }));
    });
    const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
    const promise = loadGoalOverview();
    await flush();
    expect(active).toBe(4);
    expect(m.readWeeklyGoal).toHaveBeenCalledTimes(4);
    while (pending.length) {
      pending.pop()!();
      await flush();
      expect(active).toBeLessThanOrEqual(4);
    }
    const result = await promise;
    expect(peak).toBe(4);
    expect(active).toBe(0);
    expect(m.readWeeklyGoal).toHaveBeenCalledTimes(9);
    expect(result.map(row => row.email)).toEqual(students.map(s => s.email));
  });
});
