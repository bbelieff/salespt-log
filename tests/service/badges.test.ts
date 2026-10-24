import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  findUserByEmail: vi.fn(),
  readContractsFromDb: vi.fn(), readMeetingsFromDb: vi.fn(), readTodosFromDb: vi.fn(),
  readDbTabFromDb: vi.fn(),
  readDbSheetContactRows: vi.fn(), readDbSheetLeadBasics: vi.fn(), readFirstPushDate: vi.fn(), readFirstWeeklyGoalDate: vi.fn(),
  usesDbStorage: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/repo/users", () => ({ findUserByEmail: m.findUserByEmail }));
vi.mock("@/repo/db/read-daily", () => ({ readContractsFromDb: m.readContractsFromDb, readMeetingsFromDb: m.readMeetingsFromDb, readTodosFromDb: m.readTodosFromDb }));
vi.mock("@/repo/db/read-db-tab", () => ({ readDbTabFromDb: m.readDbTabFromDb }));
vi.mock("@/repo/db/badge-reads", () => ({
  readDbSheetContactRows: m.readDbSheetContactRows, readDbSheetLeadBasics: m.readDbSheetLeadBasics,
  readFirstPushDate: m.readFirstPushDate, readFirstWeeklyGoalDate: m.readFirstWeeklyGoalDate,
}));
vi.mock("@/service/daily-source", () => ({ usesDbStorage: m.usesDbStorage }));

import { loadBadges } from "@/lib/service/badges";

const TODAY = "2026-10-12";
const state = (r: Awaited<ReturnType<typeof loadBadges>>, id: string) => r.badges.find(b => b.id === id)!;

describe("loadBadges", () => {
  beforeEach(() => {
    Object.values(m).forEach(f => f.mockReset());
    m.findUserByEmail.mockResolvedValue({ spreadsheetId: "own-sheet", cohort: "8", courseStartISO: "2026-08-01", graduationISO: "" });
    m.usesDbStorage.mockReturnValue(true);
    m.readDbSheetContactRows.mockResolvedValue([{ leadId: "a", date: "2026-09-01", result: "부재" }]);
    m.readDbSheetLeadBasics.mockResolvedValue([]);
    m.readMeetingsFromDb.mockResolvedValue([]);
    m.readContractsFromDb.mockResolvedValue([]);
    m.readTodosFromDb.mockResolvedValue([]);
    m.readDbTabFromDb.mockResolvedValue({ purchases: [{ 구매일: "2026-08-20" }], productions: [], banners: [], leads: [] });
    m.readFirstWeeklyGoalDate.mockResolvedValue("2026-08-03");
    m.readFirstPushDate.mockResolvedValue(null);
  });

  it("reads the arena sheet when one is given, push by login email, and judges", async () => {
    const r = await loadBadges("s@example.com", TODAY, "arena-sheet");
    expect(m.readMeetingsFromDb).toHaveBeenCalledWith("arena-sheet");
    expect(m.readDbSheetContactRows).toHaveBeenCalledWith("arena-sheet");
    expect(m.readFirstPushDate).toHaveBeenCalledWith("s@example.com");
    expect(state(r, "first-contact").earnedOn).toBe("2026-09-01");
    expect(state(r, "first-db").earnedOn).toBe("2026-08-20");
    expect(state(r, "first-goal").earnedOn).toBe("2026-08-03");
    expect(r.partial).toBe(false);
  });

  it("one failing source does not sink the rest; it is reported as partial", async () => {
    m.readMeetingsFromDb.mockRejectedValue(new Error("boom"));
    const r = await loadBadges("s@example.com", TODAY);
    expect(r.partial).toBe(true);
    expect(state(r, "first-contact").earned).toBe(true);
  });

  it("sheet-storage cohorts read no records (no synchronous sheet calls) and are partial", async () => {
    m.usesDbStorage.mockReturnValue(false);
    const r = await loadBadges("s@example.com", TODAY);
    expect(m.readMeetingsFromDb).not.toHaveBeenCalled();
    expect(m.readDbSheetContactRows).not.toHaveBeenCalled();
    expect(r.partial).toBe(true);
    expect(r.badges.every(b => !b.earned)).toBe(true);
  });

  it("unknown student → no-sheet error", async () => {
    m.findUserByEmail.mockResolvedValue(null);
    await expect(loadBadges("x@example.com", TODAY)).rejects.toThrow("[no-sheet]");
  });
});
