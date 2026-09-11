import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_GOALS } from "@/types/weekly-goals";

const m = vi.hoisted(() => ({
  getSessionEmail: vi.fn(), getActiveUserEmail: vi.fn(), getEffectiveRole: vi.fn(), findActiveArenaRowByEmail: vi.fn(),
  findUserByEmail: vi.fn(), listDistinctUsers: vi.fn(), dbEnabled: vi.fn(), chooseDailySource: vi.fn(),
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
import { listGoalStudents, loadWeeklyGoals, loadWeeklyGoalInternal, updateWeeklyGoals, updateWeeklyGoalInternal } from "@/service/weekly-goals";

const student = { email: "student@example.test", name: "Test Student", role: "trainee", status: "active", cohort: "test-cohort", courseStartISO: "2026-09-04", spreadsheetId: "fixture-sheet", assignedTrainer: "trainer@example.test", team: "test-region", refreshToken: "PRIVATE-TOKEN" };
const emptyRecord = () => ({ goals: { ...EMPTY_GOALS }, task: "", revision: 0, updatedAt: null });
const input = () => ({ goals: { ...EMPTY_GOALS }, task: "PT task\nsecond line", revision: 0 });
const params = (week = "1") => new URLSearchParams({ student: student.email, week, enrollment: JSON.stringify([student.cohort, student.courseStartISO]) });

beforeEach(() => {
  vi.resetAllMocks();
  m.getSessionEmail.mockResolvedValue(student.email);
  m.getActiveUserEmail.mockResolvedValue(student.email);
  m.getEffectiveRole.mockResolvedValue({ role: "trainee", status: "active" });
  m.findActiveArenaRowByEmail.mockResolvedValue(null);
  m.findUserByEmail.mockResolvedValue({ ...student });
  m.listDistinctUsers.mockResolvedValue([{ ...student }, { email: "trainer@example.test", name: "Test Trainer", role: "trainer" }]);
  m.dbEnabled.mockReturnValue(true);
  m.chooseDailySource.mockReturnValue("db");
  m.readSalesRowsFromDb.mockResolvedValue([]);
  m.readMeetingsFromDb.mockResolvedValue([]);
  m.readContractsFromDb.mockResolvedValue([]);
  m.readWeeklyGoal.mockImplementation(async () => emptyRecord());
  m.readWeeklyGoalPrivate.mockResolvedValue({ specialNotes: "PRIVATE-NOTE", priorOutcome: "PRIVATE-OUTCOME", revision: 1 });
  m.saveWeeklyGoal.mockResolvedValue(true);
  m.saveWeeklyGoalPrivate.mockResolvedValue(true);
});

describe("weekly goals server access and public projection", () => {
  it("rejects unauthenticated reads before any repository access", async () => {
    m.getSessionEmail.mockResolvedValue("");
    await expect(loadWeeklyGoals(params())).rejects.toMatchObject({ status: 401 });
    expect(m.findUserByEmail).not.toHaveBeenCalled();
    expect(m.readWeeklyGoal).not.toHaveBeenCalled();
  });
  it.each([{ role: "trainee", status: "pending" }, { role: "trainer", status: "inactive" }])("rejects blocked actor %j", async role => {
    m.getEffectiveRole.mockResolvedValue(role);
    await expect(loadWeeklyGoals(params())).rejects.toMatchObject({ status: 403 });
    expect(m.readWeeklyGoal).not.toHaveBeenCalled();
  });
  it("checks assignment against the real actor, not submitted role or active target", async () => {
    m.getSessionEmail.mockResolvedValue("trainer@example.test");
    m.getEffectiveRole.mockResolvedValue({ role: "trainer", status: "active" });
    m.findUserByEmail.mockResolvedValue({ ...student, assignedTrainer: "other-trainer@example.test" });
    const p = params(); p.set("role", "admin");
    await expect(loadWeeklyGoals(p)).rejects.toMatchObject({ status: 403 });
    expect(m.findUserByEmail).toHaveBeenCalledWith(student.email);
    expect(m.readWeeklyGoal).not.toHaveBeenCalled();
  });
  it("projects only public fields without reading internal records", async () => {
    const view = await loadWeeklyGoals(params());
    expect(view.student).toEqual({ email: student.email, name: student.name, cohort: student.cohort, courseStart: student.courseStartISO, region: student.team, trainers: ["Test Trainer"] });
    expect(view.canReadInternal).toBe(false);
    expect(JSON.stringify(view)).not.toMatch(/PRIVATE|refreshToken|specialNotes|priorOutcome|spreadsheetId/);
    expect(m.readWeeklyGoalPrivate).not.toHaveBeenCalled();
  });
  it("denies direct private reads and writes for students", async () => {
    await expect(loadWeeklyGoalInternal(params())).rejects.toMatchObject({ status: 403 });
    await expect(updateWeeklyGoalInternal(params(), { specialNotes: "injection", priorOutcome: "x", revision: 0 })).rejects.toMatchObject({ status: 403 });
    expect(m.readWeeklyGoalPrivate).not.toHaveBeenCalled();
    expect(m.saveWeeklyGoalPrivate).not.toHaveBeenCalled();
  });
  it("allows assigned trainer private reads but still excludes private data from common view", async () => {
    m.getSessionEmail.mockResolvedValue("trainer@example.test");
    m.getEffectiveRole.mockResolvedValue({ role: "trainer", status: "active" });
    expect(await loadWeeklyGoalInternal(params())).toMatchObject({ specialNotes: "PRIVATE-NOTE" });
    const view = await loadWeeklyGoals(params());
    expect(view.canReadInternal).toBe(true);
    expect(JSON.stringify(view)).not.toContain("PRIVATE");
  });
  it("denies assignment revoked in fresh user data even when prior impersonation check allowed it", async () => {
    m.getSessionEmail.mockResolvedValue("trainer@example.test");
    m.getEffectiveRole.mockResolvedValue({ role: "trainer", status: "active" });
    m.findUserByEmail.mockResolvedValue({ ...student, assignedTrainer: "new-trainer@example.test" });
    await expect(loadWeeklyGoals(params())).rejects.toMatchObject({ status: 403 });
    await expect(loadWeeklyGoalInternal(params())).rejects.toMatchObject({ status: 403 });
    expect(m.readWeeklyGoal).not.toHaveBeenCalled();
    expect(m.readWeeklyGoalPrivate).not.toHaveBeenCalled();
  });
  it("denies a student targeting another account despite an obsolete impersonation approval", async () => {
    m.getSessionEmail.mockResolvedValue("other-student@example.test");
    await expect(updateWeeklyGoals(params(), input())).rejects.toMatchObject({ status: 403 });
    expect(m.saveWeeklyGoal).not.toHaveBeenCalled();
  });
  it.each([{ role: "trainer", status: "active" }, { role: "trainee", status: "pending" }])("denies changed target role or status %j", async change => {
    m.findUserByEmail.mockResolvedValue({ ...student, ...change });
    await expect(loadWeeklyGoals(params())).rejects.toMatchObject({ status: 403 });
    expect(m.readWeeklyGoal).not.toHaveBeenCalled();
  });
  it("preserves administrator access to an unassigned trainee", async () => {
    m.getSessionEmail.mockResolvedValue("admin@example.test");
    m.getEffectiveRole.mockResolvedValue({ role: "admin", status: "active" });
    m.findUserByEmail.mockResolvedValue({ ...student, assignedTrainer: "" });
    await expect(loadWeeklyGoals(params())).resolves.toMatchObject({ canReadInternal: true });
  });
  it("rechecks actor status before reading records", async () => {
    m.getEffectiveRole.mockResolvedValueOnce({ role: "trainer", status: "active" }).mockResolvedValue({ role: "trainer", status: "pending" });
    await expect(loadWeeklyGoals(params())).rejects.toMatchObject({ status: 403 });
    expect(m.readWeeklyGoal).not.toHaveBeenCalled();
  });
  it("does not retain private access if the actor is downgraded to student during fresh-row authorization", async () => {
    m.getEffectiveRole.mockResolvedValueOnce({ role: "admin", status: "active" }).mockResolvedValue({ role: "trainee", status: "active" });
    await expect(loadWeeklyGoalInternal(params())).rejects.toMatchObject({ status: 403 });
    expect(m.readWeeklyGoalPrivate).not.toHaveBeenCalled();
  });
  it("restricts trainer roster to assigned non-pending trainees", async () => {
    m.getSessionEmail.mockResolvedValue("trainer@example.test");
    m.getEffectiveRole.mockResolvedValue({ role: "trainer", status: "active" });
    m.listDistinctUsers.mockResolvedValue([student, { ...student, email: "other@example.test", assignedTrainer: "other-trainer@example.test" }, { ...student, email: "pending@example.test", status: "pending" }]);
    expect(await listGoalStudents()).toEqual([{ email: student.email, name: student.name, cohort: student.cohort }]);
  });
  it("denies student roster enumeration", async () => {
    await expect(listGoalStudents()).rejects.toMatchObject({ status: 403 });
    expect(m.listDistinctUsers).not.toHaveBeenCalled();
  });
  it.each([
    { role: "trainee", status: "active" },
    { role: "trainer", status: "archived" },
    { role: "trainer", status: "pending" },
  ])("does not return a roster after actor downgrade during the roster await: %j", async changedRole => {
    m.getSessionEmail.mockResolvedValue("trainer@example.test");
    m.getEffectiveRole.mockResolvedValue({ role: "trainer", status: "active" });
    m.listDistinctUsers.mockImplementation(async () => {
      m.getEffectiveRole.mockResolvedValue(changedRole);
      return [student];
    });
    await expect(listGoalStudents()).rejects.toMatchObject({ status: 403 });
    expect(m.listDistinctUsers).toHaveBeenCalledTimes(1);
    expect(m.getEffectiveRole).toHaveBeenCalledTimes(2);
    expect(m.readWeeklyGoal).not.toHaveBeenCalled();
    expect(m.readWeeklyGoalPrivate).not.toHaveBeenCalled();
  });
  it("does not return the prior actor's roster when the session identity changes during lookup", async () => {
    m.getSessionEmail.mockResolvedValue("trainer@example.test");
    m.getEffectiveRole.mockResolvedValue({ role: "trainer", status: "active" });
    m.listDistinctUsers.mockImplementation(async () => {
      m.getSessionEmail.mockResolvedValue("other-trainer@example.test");
      return [student];
    });
    await expect(listGoalStudents()).rejects.toMatchObject({ status: 403 });
    expect(m.getEffectiveRole).toHaveBeenLastCalledWith("other-trainer@example.test");
  });
  it("uses the fresh trainer assignment filter after an administrator is downgraded during roster lookup", async () => {
    m.getSessionEmail.mockResolvedValue("trainer@example.test");
    m.getEffectiveRole.mockResolvedValue({ role: "admin", status: "active" });
    m.listDistinctUsers.mockImplementation(async () => {
      m.getEffectiveRole.mockResolvedValue({ role: "trainer", status: "active" });
      return [student, { ...student, email: "unassigned@example.test", assignedTrainer: "other-trainer@example.test" }];
    });
    expect(await listGoalStudents()).toEqual([{ email: student.email, name: student.name, cohort: student.cohort }]);
    expect(m.getEffectiveRole).toHaveBeenCalledTimes(2);
  });
});

describe("weekly goals validation, key isolation, and failure semantics", () => {
  it("allows week-one PT task with null goals and preserves zero as an explicit goal", async () => {
    const body = input(); body.goals.production = 0;
    expect(await updateWeeklyGoals(params(), body)).toEqual({ revision: 1 });
    expect(m.saveWeeklyGoal.mock.calls[0]?.[1]).toEqual(body);
  });
  it.each([-1, 0.5, 2147483648, "0", undefined])("rejects invalid count %s", async count => {
    const body = { ...input(), goals: { ...EMPTY_GOALS, production: count } };
    await expect(updateWeeklyGoals(params(), body)).rejects.toMatchObject({ status: 400 });
    expect(m.saveWeeklyGoal).not.toHaveBeenCalled();
  });
  it.each(["specialNotes", "priorOutcome", "role", "email", "cohort"])("rejects public write injection field %s", async field => {
    await expect(updateWeeklyGoals(params(), { ...input(), [field]: "injected" })).rejects.toMatchObject({ status: 400 });
    expect(m.saveWeeklyGoal).not.toHaveBeenCalled();
  });
  it.each(["0", "-1", "1.1", "NaN", "5201", ""])("rejects invalid week %s", async week => {
    await expect(loadWeeklyGoals(params(week))).rejects.toMatchObject({ status: 400 });
    expect(m.readWeeklyGoal).not.toHaveBeenCalled();
  });
  it("derives Friday week bounds and previous-week key from the course SSOT", async () => {
    const view = await loadWeeklyGoals(params("2"));
    expect(view.current).toMatchObject({ week: 2, start: "2026-09-11", end: "2026-09-17" });
    expect(view.previous).toMatchObject({ week: 1, start: "2026-09-04", end: "2026-09-10" });
    expect(m.readWeeklyGoal.mock.calls.map(call => call[0])).toEqual([
      { studentId: student.spreadsheetId, cohort: student.cohort, courseStart: student.courseStartISO, weekStart: "2026-09-11" },
      { studentId: student.spreadsheetId, cohort: student.cohort, courseStart: student.courseStartISO, weekStart: "2026-09-04" },
    ]);
  });
  it("uses server target identity and sheet, ignoring submitted cohort and sheet", async () => {
    const p = params(); p.set("cohort", "forged"); p.set("spreadsheetId", "forged-sheet");
    await loadWeeklyGoals(p);
    expect(m.readWeeklyGoal).toHaveBeenCalledWith(expect.objectContaining({ cohort: student.cohort }));
    expect(m.readSalesRowsFromDb).toHaveBeenCalledWith(student.spreadsheetId);
  });
  it.each(["stale-enrollment", ""])("rejects stale or empty enrollment %s without writing", async enrollment => {
    const p = params(); p.set("enrollment", enrollment);
    await expect(updateWeeklyGoals(p, input())).rejects.toMatchObject({ status: 409 });
    expect(m.saveWeeklyGoal).not.toHaveBeenCalled();
  });
  it.each(["week", "enrollment"])("requires explicit %s on writes", async field => {
    const p = params(); p.delete(field);
    await expect(updateWeeklyGoals(p, input())).rejects.toMatchObject({ status: 400 });
    expect(m.saveWeeklyGoal).not.toHaveBeenCalled();
  });
  it("reports concurrent save conflict instead of success", async () => {
    m.saveWeeklyGoal.mockResolvedValue(false);
    await expect(updateWeeklyGoals(params(), input())).rejects.toMatchObject({ status: 409 });
  });
  it("reports internal concurrent save conflict independently", async () => {
    m.getEffectiveRole.mockResolvedValue({ role: "admin", status: "active" });
    m.saveWeeklyGoalPrivate.mockResolvedValue(false);
    await expect(updateWeeklyGoalInternal(params(), { specialNotes: "test", priorOutcome: "", revision: 1 })).rejects.toMatchObject({ status: 409 });
    expect(m.saveWeeklyGoal).not.toHaveBeenCalled();
  });
  it("propagates actual read failures instead of inventing empty counts or saving defaults", async () => {
    m.readSalesRowsFromDb.mockRejectedValue(new Error("fixture-read-failure"));
    await expect(loadWeeklyGoals(params())).rejects.toThrow("fixture-read-failure");
    expect(m.saveWeeklyGoal).not.toHaveBeenCalled();
  });
  it("fails closed when database source is unavailable", async () => {
    m.chooseDailySource.mockReturnValue("sheet");
    await expect(loadWeeklyGoals(params())).rejects.toMatchObject({ status: 503 });
    expect(m.readWeeklyGoal).not.toHaveBeenCalled();
  });
});
