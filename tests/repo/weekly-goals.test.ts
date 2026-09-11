import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_GOALS, type WeeklyGoalKey } from "@/types/weekly-goals";
const m = vi.hoisted(() => ({ query: vi.fn(), dbEnabled: vi.fn() }));
vi.mock("@/repo/db/client", () => ({ dbEnabled: m.dbEnabled, getDbPool: () => ({ query: m.query }) }));
import { readWeeklyGoal, readWeeklyGoalPrivate, saveWeeklyGoal, saveWeeklyGoalPrivate } from "@/repo/db/weekly-goals";

const key: WeeklyGoalKey = { email: "fixture@example.test", cohort: "test-cohort", courseStart: "2026-09-04", weekStart: "2026-09-11" };
const keyArgs = [key.email, key.cohort, key.courseStart, key.weekStart];
const input = (revision = 0) => ({ goals: { ...EMPTY_GOALS, production: 0 }, task: "Task\n<script>fixture</script>", revision });
beforeEach(() => { vi.resetAllMocks(); m.dbEnabled.mockReturnValue(true); m.query.mockResolvedValue({ rows: [], rowCount: 0 }); });

describe("weekly goal persistence contracts (mocked database only)", () => {
  it("returns unsaved null goals and isolates returned defaults", async () => {
    const first = await readWeeklyGoal(key); first.goals.production = 100;
    expect(await readWeeklyGoal(key)).toEqual({ goals: { ...EMPTY_GOALS }, task: "", revision: 0, updatedAt: null });
    expect(m.query.mock.calls[0]?.[1]).toEqual(keyArgs);
  });
  it("decodes persisted null and zero separately and retains task text", async () => {
    m.query.mockResolvedValue({ rows: [{ production: 0, inflow: null, contacts: 3, meetings: null, contracts: 1, task: "line1\nline2", revision: 7, updated_at: new Date("2026-09-11T01:00:00Z") }] });
    expect(await readWeeklyGoal(key)).toEqual({ goals: { production: 0, inflow: null, contacts: 3, meetings: null, contracts: 1 }, task: "line1\nline2", revision: 7, updatedAt: "2026-09-11T01:00:00.000Z" });
    expect(m.query.mock.calls[0]?.[0]).not.toContain("weekly_goal_private");
  });
  it("keeps the public read SQL free of private fields", async () => {
    await readWeeklyGoal(key);
    expect(m.query.mock.calls[0]?.[0]).not.toMatch(/special_notes|prior_outcome|select\s+\*/i);
  });
  it("uses separate private storage and enrollment/week keys", async () => {
    expect(await readWeeklyGoalPrivate(key)).toEqual({ specialNotes: "", priorOutcome: "", revision: 0, updatedAt: null });
    expect(m.query).toHaveBeenCalledWith(expect.stringContaining("from weekly_goal_private"), keyArgs);
  });
  it("uses conflict-safe insert for unsaved record and bound parameters for text", async () => {
    m.query.mockResolvedValue({ rowCount: 1, rows: [{ revision: 1 }] });
    expect(await saveWeeklyGoal(key, input())).toBe(true);
    const [sql, args] = m.query.mock.calls[0]!;
    expect(sql).toMatch(/on conflict do nothing returning revision/i);
    expect(sql).not.toContain("<script>");
    expect(args).toEqual([...keyArgs, 0, null, null, null, null, input().task]);
  });
  it("treats duplicate create as conflict instead of silently replacing stored data", async () => {
    m.query.mockResolvedValueOnce({ rowCount: 1 }).mockResolvedValueOnce({ rowCount: 0 });
    expect(await Promise.all([saveWeeklyGoal(key, input()), saveWeeklyGoal(key, input())])).toEqual([true, false]);
    expect(m.query.mock.calls.every(call => /on conflict do nothing/.test(call[0]))).toBe(true);
  });
  it("compares revision atomically with all key dimensions on update", async () => {
    m.query.mockResolvedValue({ rowCount: 0 });
    expect(await saveWeeklyGoal(key, input(7))).toBe(false);
    const [sql, args] = m.query.mock.calls[0]!;
    expect(sql).toMatch(/email=\$1 and cohort=\$2 and course_start=\$3::date and week_start=\$4::date and revision=\$11/);
    expect(sql).toContain("revision=revision+1");
    expect(args).toEqual([...keyArgs, 0, null, null, null, null, input().task, 7]);
  });
  it("uses a separate private CAS revision", async () => {
    m.query.mockResolvedValue({ rowCount: 1 });
    expect(await saveWeeklyGoalPrivate(key, { specialNotes: "internal", priorOutcome: "previous", revision: 2 })).toBe(true);
    expect(m.query).toHaveBeenCalledWith(expect.stringContaining("and revision=$7 returning revision"), [...keyArgs, "internal", "previous", 2]);
  });
  it("validates malformed input before any query", async () => {
    await expect(saveWeeklyGoal(key, { ...input(), goals: { ...EMPTY_GOALS, production: -1 } })).rejects.toThrow();
    expect(m.query).not.toHaveBeenCalled();
  });
  it("does not treat a database failure as an absent record or successful save", async () => {
    m.query.mockRejectedValue(new Error("fixture-db-failure"));
    await expect(readWeeklyGoal(key)).rejects.toThrow("fixture-db-failure");
    await expect(saveWeeklyGoal(key, input())).rejects.toThrow("fixture-db-failure");
  });
  it("fails closed when DB is disabled", async () => {
    m.dbEnabled.mockReturnValue(false);
    await expect(readWeeklyGoal(key)).rejects.toThrow("weekly_goals_unavailable");
    expect(m.query).not.toHaveBeenCalled();
  });
});
