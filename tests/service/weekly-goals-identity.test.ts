import { beforeEach, describe, expect, it, vi } from "vitest";
import { User } from "@/types";
import { EMPTY_GOALS, type WeeklyGoalInput, type WeeklyGoalKey, type WeeklyGoalPrivateInput, type WeeklyGoalPrivateRecord, type WeeklyGoalRecord } from "@/types/weekly-goals";

const m = vi.hoisted(() => ({
  getSessionEmail: vi.fn(), getActiveUserEmail: vi.fn(), getEffectiveRole: vi.fn(),
  findUserByEmail: vi.fn(), findActiveArenaRowByEmail: vi.fn(), listDistinctUsers: vi.fn(),
  dbEnabled: vi.fn(), chooseDailySource: vi.fn(), readSalesRowsFromDb: vi.fn(), readMeetingsFromDb: vi.fn(), readContractsFromDb: vi.fn(),
  readWeeklyGoal: vi.fn(), saveWeeklyGoal: vi.fn(), readWeeklyGoalPrivate: vi.fn(), saveWeeklyGoalPrivate: vi.fn(),
}));
vi.mock("@/auth/identity", () => m);
vi.mock("@/repo/users", () => ({ ...m, parseAssignedTrainers: (value: string) => value.toLowerCase().split(",").map(s => s.trim()).filter(Boolean) }));
vi.mock("@/repo/users-arena", () => m);
vi.mock("@/repo/db/client", () => m);
vi.mock("@/repo/db/read-daily", () => m);
vi.mock("@/repo/db/weekly-goals", () => m);
vi.mock("@/service/daily-source", () => m);
import { loadWeeklyGoals, loadWeeklyGoalInternal, updateWeeklyGoals, updateWeeklyGoalInternal, resolveGoalStudent } from "@/service/weekly-goals";

const trainerEmail = "trainer@example.test";
const trainee = (email: string, overrides: Partial<User> = {}): User => User.parse({
  email, name: "Synthetic Student", role: "trainee", status: "active", cohort: "fixture-cohort", courseStartISO: "2026-09-04",
  spreadsheetId: "shared-fixture-sheet", assignedTrainer: trainerEmail, ...overrides,
});
const e1 = trainee("alias-one@example.test");
const e2 = trainee("alias-two@example.test");
const other = trainee("other@example.test", { spreadsheetId: "other-fixture-sheet" });
const instructor = trainee(trainerEmail, { role: "trainer", cohort: "T", spreadsheetId: "" });
const params = (u = e1, week = "1") => new URLSearchParams({ student: u.email, week, enrollment: JSON.stringify([u.cohort, u.courseStartISO]) });
const publicInput = (revision = 0, task = "Synthetic PT task"): WeeklyGoalInput => ({ goals: { ...EMPTY_GOALS, production: 0 }, task, revision });
const privateInput = (revision = 0): WeeklyGoalPrivateInput => ({ specialNotes: "PRIVATE-NOTE-SENTINEL", priorOutcome: "PRIVATE-OUTCOME-SENTINEL", revision });
const empty = (): WeeklyGoalRecord => ({ goals: { ...EMPTY_GOALS }, task: "", revision: 0, updatedAt: null });
const blankPrivate = (): WeeklyGoalPrivateRecord => ({ specialNotes: "", priorOutcome: "", revision: 0, updatedAt: null });
const keyString = (key: WeeklyGoalKey) => JSON.stringify([key.studentId, key.cohort, key.courseStart, key.weekStart]);
let users: Map<string, User>, arenas: Map<string, User>;
let publicRows: Map<string, WeeklyGoalRecord>, privateRows: Map<string, WeeklyGoalPrivateRecord>;
function login(email: string, role: "trainee" | "trainer" | "admin" = "trainee") {
  m.getSessionEmail.mockResolvedValue(email);
  m.getActiveUserEmail.mockResolvedValue(email);
  m.getEffectiveRole.mockResolvedValue({ role, status: "active" });
}
beforeEach(() => {
  vi.resetAllMocks();
  users = new Map([e1, e2, other, instructor].map(u => [u.email, { ...u }]));
  arenas = new Map(); publicRows = new Map(); privateRows = new Map();
  login(e2.email);
  m.findUserByEmail.mockImplementation(async (email: string) => users.get(email) ?? null);
  m.findActiveArenaRowByEmail.mockImplementation(async (email: string) => arenas.get(email) ?? null);
  // Real distinct roster selects one representative; it does not include login alias E2.
  m.listDistinctUsers.mockImplementation(async () => [users.get(e1.email), users.get(other.email), instructor]);
  m.dbEnabled.mockReturnValue(true); m.chooseDailySource.mockReturnValue("db");
  m.readSalesRowsFromDb.mockResolvedValue([]); m.readMeetingsFromDb.mockResolvedValue([]); m.readContractsFromDb.mockResolvedValue([]);
  m.readWeeklyGoal.mockImplementation(async (key: WeeklyGoalKey) => structuredClone(publicRows.get(keyString(key)) ?? empty()));
  m.readWeeklyGoalPrivate.mockImplementation(async (key: WeeklyGoalKey) => structuredClone(privateRows.get(keyString(key)) ?? blankPrivate()));
  m.saveWeeklyGoal.mockImplementation(async (key: WeeklyGoalKey, input: WeeklyGoalInput) => {
    const id = keyString(key), existing = publicRows.get(id);
    if ((existing?.revision ?? 0) !== input.revision) return false;
    publicRows.set(id, structuredClone({ ...input, revision: input.revision + 1, updatedAt: "2026-09-11T00:00:00.000Z" }));
    return true;
  });
  m.saveWeeklyGoalPrivate.mockImplementation(async (key: WeeklyGoalKey, input: WeeklyGoalPrivateInput) => {
    const id = keyString(key), existing = privateRows.get(id);
    if ((existing?.revision ?? 0) !== input.revision) return false;
    privateRows.set(id, { ...input, revision: input.revision + 1, updatedAt: "2026-09-11T00:00:00.000Z" });
    return true;
  });
});

describe("explicit save target never falls back to the active impersonation target", () => {
  it.each([null, "", "   "])("rejects absent or blank student %j on both writes even with matching enrollment", async student => {
    login(trainerEmail, "trainer");
    await loadWeeklyGoals(params(e1));
    m.getActiveUserEmail.mockResolvedValue(other.email); // B shares A's cohort/start, but not their sheet.
    const p = params(e1); if (student === null) p.delete("student"); else p.set("student", student);
    await expect(updateWeeklyGoals(p, publicInput())).rejects.toMatchObject({ status: 400 });
    await expect(updateWeeklyGoalInternal(p, privateInput())).rejects.toMatchObject({ status: 400 });
    expect(m.getActiveUserEmail).not.toHaveBeenCalled();
    expect(m.saveWeeklyGoal).not.toHaveBeenCalled(); expect(m.saveWeeklyGoalPrivate).not.toHaveBeenCalled();
    expect(publicRows.size + privateRows.size).toBe(0);
  });
  it("explicit A writes only server-resolved A after cookie changes to B", async () => {
    login(trainerEmail, "trainer"); m.getActiveUserEmail.mockResolvedValue(other.email);
    const p = params(e1); p.set("studentId", other.spreadsheetId); p.set("spreadsheetId", other.spreadsheetId);
    await updateWeeklyGoals(p, publicInput()); await updateWeeklyGoalInternal(p, privateInput());
    for (const fn of [m.saveWeeklyGoal, m.saveWeeklyGoalPrivate]) {
      expect(fn).toHaveBeenCalledWith(expect.objectContaining({ studentId: e1.spreadsheetId }), expect.anything());
    }
    expect((await loadWeeklyGoals(params(other))).current.record.revision).toBe(0);
    expect((await loadWeeklyGoalInternal(params(other))).revision).toBe(0);
  });
  it("retains empty enrollment rejection for both write endpoints", async () => {
    login(trainerEmail, "trainer"); const p = params(e1); p.set("enrollment", "");
    await expect(updateWeeklyGoals(p, publicInput())).rejects.toMatchObject({ status: 409 });
    await expect(updateWeeklyGoalInternal(p, privateInput())).rejects.toMatchObject({ status: 409 });
    expect(m.saveWeeklyGoal).not.toHaveBeenCalled(); expect(m.saveWeeklyGoalPrivate).not.toHaveBeenCalled();
  });
});

describe("stable enrollment identity across distinct-roster aliases (synthetic stateful store)", () => {
  it("E2 self save -> trainer representative E1 read/edit -> E2 reads same record and revision", async () => {
    await updateWeeklyGoals(params(e2), publicInput());
    login(trainerEmail, "trainer");
    expect((await loadWeeklyGoals(params(e1))).current.record).toMatchObject({ task: "Synthetic PT task", revision: 1 });
    await updateWeeklyGoals(params(e1), publicInput(1, "Trainer revision"));
    login(e2.email);
    expect((await loadWeeklyGoals(params(e2))).current.record).toMatchObject({ task: "Trainer revision", revision: 2 });
    expect(publicRows.size).toBe(1);
    await expect(updateWeeklyGoals(params(e2), publicInput(1, "Stale edit"))).rejects.toMatchObject({ status: 409 });
    expect((await loadWeeklyGoals(params(e2))).current.record.task).toBe("Trainer revision");
  });
  it.each(["sheet", "cohort", "course", "week"])("isolates a different %s while preserving the original enrollment", async dimension => {
    await updateWeeklyGoals(params(e2), publicInput());
    const changed = { ...e2 };
    if (dimension === "sheet") changed.spreadsheetId = "next-fixture-sheet";
    if (dimension === "cohort") changed.cohort = "next-cohort";
    if (dimension === "course") changed.courseStartISO = "2026-09-11";
    users.set(e2.email, changed);
    const p = params(changed, dimension === "week" ? "2" : "1");
    expect((await loadWeeklyGoals(p)).current.record.revision).toBe(0);
    await updateWeeklyGoals(p, publicInput(0, "Isolated task"));
    users.set(e2.email, { ...e2 });
    expect((await loadWeeklyGoals(params(e2))).current.record.task).toBe("Synthetic PT task");
    expect(publicRows.size).toBe(2);
  });
  it("private alias storage is shared only for authorized trainers and never in public projection", async () => {
    login(trainerEmail, "trainer");
    await updateWeeklyGoalInternal(params(e1), privateInput());
    expect(await loadWeeklyGoalInternal(params(e2))).toMatchObject({ revision: 1, specialNotes: "PRIVATE-NOTE-SENTINEL" });
    await updateWeeklyGoalInternal(params(e2), { ...privateInput(1), priorOutcome: "Revised private outcome" });
    expect((await loadWeeklyGoalInternal(params(e1))).revision).toBe(2);
    expect(privateRows.size).toBe(1);
    login(e2.email); m.readWeeklyGoalPrivate.mockClear();
    expect(JSON.stringify(await loadWeeklyGoals(params(e2)))).not.toMatch(/PRIVATE|specialNotes|priorOutcome/);
    await expect(loadWeeklyGoalInternal(params(e2))).rejects.toMatchObject({ status: 403 });
    expect(m.readWeeklyGoalPrivate).not.toHaveBeenCalled();
  });
  it("same sheet does not grant a student authority to address another login alias", async () => {
    await expect(updateWeeklyGoals(params(e1), publicInput())).rejects.toMatchObject({ status: 403 });
    expect(m.saveWeeklyGoal).not.toHaveBeenCalled();
  });
  it.each(["sheet", "cohort", "course", "week"])("also isolates private records by %s", async dimension => {
    login(trainerEmail, "trainer");
    await updateWeeklyGoalInternal(params(e1), privateInput());
    const changed = { ...e2 };
    if (dimension === "sheet") changed.spreadsheetId = "next-private-fixture-sheet";
    if (dimension === "cohort") changed.cohort = "next-cohort";
    if (dimension === "course") changed.courseStartISO = "2026-09-11";
    users.set(e2.email, changed);
    const p = params(changed, dimension === "week" ? "2" : "1");
    expect(await loadWeeklyGoalInternal(p)).toMatchObject({ revision: 0, specialNotes: "" });
    await updateWeeklyGoalInternal(p, { ...privateInput(), specialNotes: "Isolated note" });
    expect((await loadWeeklyGoalInternal(params(e1))).specialNotes).toBe("PRIVATE-NOTE-SENTINEL");
    expect(privateRows.size).toBe(2);
  });
});

describe("trainer login with same-email active arena enrollment", () => {
  const ownArena = trainee(trainerEmail, { cohort: "A1-1", spreadsheetId: "own-arena-sheet", assignedTrainer: "other-trainer@example.test" });
  beforeEach(() => { login(trainerEmail, "trainer"); arenas.set(trainerEmail, { ...ownArena }); });
  it("resolves own public student enrollment and permits self save without internal rights", async () => {
    await updateWeeklyGoals(params(ownArena), publicInput());
    expect(await loadWeeklyGoals(params(ownArena))).toMatchObject({ student: { cohort: "A1-1" }, canReadInternal: false, current: { record: { revision: 1 } } });
    await expect(loadWeeklyGoalInternal(params(ownArena))).rejects.toMatchObject({ status: 403 });
    await expect(updateWeeklyGoalInternal(params(ownArena), privateInput())).rejects.toMatchObject({ status: 403 });
    expect(m.readWeeklyGoalPrivate).not.toHaveBeenCalled(); expect(m.saveWeeklyGoalPrivate).not.toHaveBeenCalled();
  });
  it("another active assigned trainer can edit the arena's shared public and private records", async () => {
    login("other-trainer@example.test", "trainer");
    await updateWeeklyGoals(params(ownArena), publicInput());
    await updateWeeklyGoalInternal(params(ownArena), privateInput());
    expect((await loadWeeklyGoals(params(ownArena))).canReadInternal).toBe(true);
    expect((await loadWeeklyGoalInternal(params(ownArena))).revision).toBe(1);
  });
  it("own enrollment alias cannot bypass private denial even if the trainer is assigned to that alias", async () => {
    const ownAlias = { ...ownArena, email: "arena-alias@example.test", assignedTrainer: trainerEmail };
    users.set(ownAlias.email, ownAlias);
    expect((await loadWeeklyGoals(params(ownAlias))).canReadInternal).toBe(false);
    await expect(loadWeeklyGoalInternal(params(ownAlias))).rejects.toMatchObject({ status: 403 });
    await expect(updateWeeklyGoalInternal(params(ownAlias), privateInput())).rejects.toMatchObject({ status: 403 });
    expect(m.readWeeklyGoalPrivate).not.toHaveBeenCalled(); expect(m.saveWeeklyGoalPrivate).not.toHaveBeenCalled();
  });
  it.each([null, { ...ownArena, status: "archived" }, { ...ownArena, role: "trainer" }, { ...ownArena, email: "same-name-other@example.test" }])("fails safely when active same-email trainee resolution is invalid %j", async invalid => {
    m.findActiveArenaRowByEmail.mockResolvedValue(invalid);
    expect(await resolveGoalStudent(trainerEmail)).toBeNull();
    await expect(updateWeeklyGoals(params(ownArena), publicInput())).rejects.toMatchObject({ status: 403 });
    expect(m.saveWeeklyGoal).not.toHaveBeenCalled();
  });
  it("does not substitute a same-name student when the trainer has no active arena", async () => {
    arenas.clear();
    users.set("same-name@example.test", trainee("same-name@example.test", { name: instructor.name }));
    expect(await resolveGoalStudent(trainerEmail)).toBeNull();
    expect(m.listDistinctUsers).not.toHaveBeenCalled();
  });
  it("revokes internal read/write access after assignment changes despite prior successful reads", async () => {
    await loadWeeklyGoalInternal(params(e1));
    users.set(e1.email, { ...e1, assignedTrainer: "new-trainer@example.test" });
    m.readWeeklyGoalPrivate.mockClear();
    await expect(loadWeeklyGoalInternal(params(e1))).rejects.toMatchObject({ status: 403 });
    await expect(updateWeeklyGoalInternal(params(e1), privateInput())).rejects.toMatchObject({ status: 403 });
    expect(m.readWeeklyGoalPrivate).not.toHaveBeenCalled(); expect(m.saveWeeklyGoalPrivate).not.toHaveBeenCalled();
  });
  it("revokes internal read/write access when the real trainer becomes inactive", async () => {
    await loadWeeklyGoalInternal(params(e1));
    m.getEffectiveRole.mockResolvedValue({ role: "trainer", status: "archived" });
    m.readWeeklyGoalPrivate.mockClear();
    await expect(loadWeeklyGoalInternal(params(e1))).rejects.toMatchObject({ status: 403 });
    await expect(updateWeeklyGoalInternal(params(e1), privateInput())).rejects.toMatchObject({ status: 403 });
    expect(m.readWeeklyGoalPrivate).not.toHaveBeenCalled(); expect(m.saveWeeklyGoalPrivate).not.toHaveBeenCalled();
  });
});
