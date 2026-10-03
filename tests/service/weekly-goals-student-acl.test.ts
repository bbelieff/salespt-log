import { beforeEach, expect, it, vi } from "vitest";
import { EMPTY_GOALS } from "@/types/weekly-goals";
import { User } from "@/types";

/** #958 endpoint-level authorization regression.
 * Assignment alone must not authorize a trainer: the saved grade/grants decide.
 * Admin and self keep their pre-existing identity boundary. */
const m = vi.hoisted(() => ({
  getSessionEmail: vi.fn(), getActiveUserEmail: vi.fn(), getEffectiveRole: vi.fn(),
  findUserByEmail: vi.fn(), findActiveArenaRowByEmail: vi.fn(), listAllUsers: vi.fn(), listDistinctUsers: vi.fn(),
  dbEnabled: vi.fn(), chooseDailySource: vi.fn(), readSalesRowsFromDb: vi.fn(), readMeetingsFromDb: vi.fn(), readContractsFromDb: vi.fn(),
  readWeeklyGoal: vi.fn(), saveWeeklyGoal: vi.fn(), readWeeklyGoalPrivate: vi.fn(), saveWeeklyGoalPrivate: vi.fn(),
  canAccess: vi.fn(),
}));
vi.mock("@/auth/identity", () => m);
vi.mock("@/repo/users", () => ({ ...m, parseAssignedTrainers: (v: string) => (v ?? "").toLowerCase().split(",").map(s => s.trim()).filter(Boolean) }));
vi.mock("@/repo/users-arena", () => m);
vi.mock("@/repo/db/client", () => m);
vi.mock("@/repo/db/read-daily", () => m);
vi.mock("@/repo/db/weekly-goals", () => m);
vi.mock("@/service/daily-source", () => m);
vi.mock("@/service/trainer-student-access", () => ({ canAccessManagedStudent: m.canAccess }));
import { listGoalStudents, loadWeeklyGoals, loadWeeklyGoalInternal, updateWeeklyGoals, updateWeeklyGoalInternal } from "@/service/weekly-goals";

const TRAINER = "trainer@example.test";
const student = (email: string, o: Partial<User> = {}): User => User.parse({
  email, name: "Synthetic Student", role: "trainee", status: "active", cohort: "fixture-cohort",
  courseStartISO: "2026-09-04", spreadsheetId: "fixture-sheet", assignedTrainer: TRAINER, ...o,
});
const TARGET = student("managed@example.test");
const params = () => new URLSearchParams({ student: TARGET.email, week: "1", enrollment: JSON.stringify(["fixture-cohort", "2026-09-04"]) });

function actAs(role: "trainer" | "admin", email = TRAINER) {
  m.getSessionEmail.mockResolvedValue(email);
  m.getActiveUserEmail.mockResolvedValue(email);
  m.getEffectiveRole.mockResolvedValue({ role, status: "active" });
}
beforeEach(() => {
  vi.clearAllMocks();
  m.findUserByEmail.mockResolvedValue(TARGET);
  m.listAllUsers.mockResolvedValue([TARGET]);
  m.listDistinctUsers.mockResolvedValue([TARGET]);
  m.dbEnabled.mockReturnValue(true);
  m.chooseDailySource.mockReturnValue("db");
  m.readSalesRowsFromDb.mockResolvedValue([]); m.readMeetingsFromDb.mockResolvedValue([]); m.readContractsFromDb.mockResolvedValue([]);
  m.readWeeklyGoal.mockResolvedValue(null); m.readWeeklyGoalPrivate.mockResolvedValue(null);
  m.saveWeeklyGoal.mockResolvedValue(true); m.saveWeeklyGoalPrivate.mockResolvedValue(true);
  actAs("trainer");
});

it("assigned trainer without saved grants is denied the student read endpoint", async () => {
  m.canAccess.mockResolvedValue(false);
  await expect(loadWeeklyGoals(params())).rejects.toMatchObject({ status: 403 });
  expect(m.readWeeklyGoal).not.toHaveBeenCalled();
});

it("read grant allows read but a write-denied trainer cannot save", async () => {
  m.canAccess.mockImplementation(async (_a: string, _t: unknown, op: string) => op === "read");
  await expect(loadWeeklyGoals(params())).resolves.toBeTruthy();
  await expect(updateWeeklyGoals(params(), { goals: {}, revision: 0 })).rejects.toMatchObject({ status: 403 });
  expect(m.saveWeeklyGoal).not.toHaveBeenCalled();
});

it("write grant is checked with the write operation, not read", async () => {
  m.canAccess.mockResolvedValue(true);
  await expect(updateWeeklyGoals(params(), publicInput())).resolves.toEqual({ revision: 1 });
  expect(m.canAccess).toHaveBeenCalledWith(TRAINER, expect.objectContaining({ email: TARGET.email }), "write");
});

it("internal private write is also grant-gated", async () => {
  m.canAccess.mockResolvedValue(false);
  await expect(updateWeeklyGoalInternal(params(), { note: "x", revision: 0 })).rejects.toMatchObject({ status: 403 });
  expect(m.saveWeeklyGoalPrivate).not.toHaveBeenCalled();
});

it("roster hides enrollments the trainer has no grant for", async () => {
  m.canAccess.mockResolvedValue(false);
  expect(await listGoalStudents()).toEqual([]);
});

it("admin keeps the existing boundary and is not grant-gated", async () => {
  actAs("admin", "admin@example.test");
  m.canAccess.mockResolvedValue(false);
  expect(await listGoalStudents()).toHaveLength(1);
  expect(m.canAccess).not.toHaveBeenCalled();
});

it("direct call with a forged student parameter still resolves the target server-side", async () => {
  m.canAccess.mockResolvedValue(false);
  const forged = new URLSearchParams({ student: "victim@example.test", week: "1" });
  await expect(loadWeeklyGoals(forged)).rejects.toMatchObject({ status: 403 });
  expect(m.readWeeklyGoal).not.toHaveBeenCalled();
});

const publicInput = () => ({ goals: { ...EMPTY_GOALS }, task: "Synthetic task", revision: 0 });
const privateInput = () => ({ specialNotes: "Synthetic note", priorOutcome: "", revision: 0 });
it.each(["", "other@example.test"])("saved grants allow unassigned target (%s) roster/detail/public and private writes", async assignedTrainer => {
  const target = student(TARGET.email, { assignedTrainer });
  m.findUserByEmail.mockResolvedValue(target); m.listAllUsers.mockResolvedValue([target]);
  m.canAccess.mockResolvedValue(true);
  expect(await listGoalStudents()).toEqual([{ email: target.email, name: target.name, cohort: target.cohort }]);
  await expect(loadWeeklyGoals(params())).resolves.toMatchObject({ canReadInternal: true, student: { trainers: assignedTrainer ? [assignedTrainer] : [] } });
  await expect(loadWeeklyGoalInternal(params())).resolves.toBeNull();
  await expect(updateWeeklyGoals(params(), publicInput())).resolves.toEqual({ revision: 1 });
  await expect(updateWeeklyGoalInternal(params(), privateInput())).resolves.toEqual({ revision: 1 });
  const exact = { email: target.email, spreadsheetId: target.spreadsheetId, cohort: target.cohort, courseStart: target.courseStartISO };
  expect(m.canAccess).toHaveBeenCalledWith(TRAINER, exact, "read");
  expect(m.canAccess).toHaveBeenCalledWith(TRAINER, exact, "write");
  expect(m.saveWeeklyGoal).toHaveBeenCalledWith(expect.objectContaining({ studentId: target.spreadsheetId, cohort: target.cohort, courseStart: target.courseStartISO }), publicInput());
  expect(target.assignedTrainer).toBe(assignedTrainer);
});
it.each([false, undefined])("missing/denied grants (%s) fail closed for unassigned roster/read/write", async grant => {
  const target = student(TARGET.email, { assignedTrainer: "" });
  m.findUserByEmail.mockResolvedValue(target); m.listAllUsers.mockResolvedValue([target]);
  m.canAccess.mockResolvedValue(grant);
  expect(await listGoalStudents()).toEqual([]);
  await expect(loadWeeklyGoals(params())).rejects.toMatchObject({ status: 403 });
  await expect(loadWeeklyGoalInternal(params())).rejects.toMatchObject({ status: 403 });
  await expect(updateWeeklyGoals(params(), publicInput())).rejects.toMatchObject({ status: 403 });
  await expect(updateWeeklyGoalInternal(params(), privateInput())).rejects.toMatchObject({ status: 403 });
  for (const fn of [m.readWeeklyGoal,m.readWeeklyGoalPrivate,m.readSalesRowsFromDb,m.readMeetingsFromDb,m.readContractsFromDb,m.saveWeeklyGoal,m.saveWeeklyGoalPrivate]) expect(fn).not.toHaveBeenCalled();
});
it("grant revocation denies a previously allowed unassigned enrollment", async () => {
  const target = student(TARGET.email, { assignedTrainer: "" });
  m.findUserByEmail.mockResolvedValue(target); m.listAllUsers.mockResolvedValue([target]);
  m.canAccess.mockResolvedValue(true);
  await loadWeeklyGoals(params());
  m.canAccess.mockResolvedValue(false); m.readWeeklyGoal.mockClear();
  await expect(loadWeeklyGoals(params())).rejects.toMatchObject({ status: 403 });
  await expect(updateWeeklyGoals(params(), publicInput())).rejects.toMatchObject({ status: 403 });
  expect(m.readWeeklyGoal).not.toHaveBeenCalled(); expect(m.saveWeeklyGoal).not.toHaveBeenCalled();
});

it("unassigned read-only grant permits roster/detail but rejects both writes", async () => {
  const target = student(TARGET.email, { assignedTrainer: "" });
  m.findUserByEmail.mockResolvedValue(target); m.listAllUsers.mockResolvedValue([target]);
  m.canAccess.mockImplementation(async (_actor: string, _target: unknown, operation: string) => operation === "read");
  expect(await listGoalStudents()).toHaveLength(1);
  await expect(loadWeeklyGoals(params())).resolves.toMatchObject({ canReadInternal: true });
  await expect(updateWeeklyGoals(params(), publicInput())).rejects.toMatchObject({ status: 403 });
  await expect(updateWeeklyGoalInternal(params(), privateInput())).rejects.toMatchObject({ status: 403 });
  expect(m.saveWeeklyGoal).not.toHaveBeenCalled(); expect(m.saveWeeklyGoalPrivate).not.toHaveBeenCalled();
});
it("policy lookup failure cannot fall back to assignment or reach student data", async () => {
  m.canAccess.mockRejectedValue(new Error("synthetic policy unavailable"));
  await expect(loadWeeklyGoals(params())).rejects.toThrow("synthetic policy unavailable");
  await expect(updateWeeklyGoals(params(), publicInput())).rejects.toThrow("synthetic policy unavailable");
  expect(m.readWeeklyGoal).not.toHaveBeenCalled(); expect(m.saveWeeklyGoal).not.toHaveBeenCalled();
});
