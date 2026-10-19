import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContractPayment, Meeting } from "@/types";
import { parseISO } from "@/util/week";
import { buildRecentTrend, readRecentSheetTrend, readRecentTrendForSource, recentTrendPeriod, unavailableRecentTrend } from "@/service/dashboard-recent-trend";

const mocks = vi.hoisted(() => ({ readWeek: vi.fn(), readSalesRowsFromDb: vi.fn(), readMeetingsFromDb: vi.fn(), readContractsFromDb: vi.fn(), dbEnabled: vi.fn(), findByDateRange: vi.fn() }));
vi.mock("@/repo/db/read-daily", async original => ({ ...await original<typeof import("@/repo/db/read-daily")>(), readMeetingsFromDb: mocks.readMeetingsFromDb, readContractsFromDb: mocks.readContractsFromDb }));
vi.mock("@/repo/sales", async original => ({ ...await original<typeof import("@/repo/sales")>(), readWeek: mocks.readWeek }));
vi.mock("@/repo/db/client", async original => ({ ...await original<typeof import("@/repo/db/client")>(), readSalesRowsFromDb: mocks.readSalesRowsFromDb, dbEnabled: mocks.dbEnabled }));
vi.mock("@/repo/meetings", async original => ({ ...await original<typeof import("@/repo/meetings")>(), findByDateRange: mocks.findByDateRange }));

const row = (date: string, production = 2, contactProgress = 2) => ({ date, channel: "매입DB" as const, production, contactProgress, inflow: 0, meetingReservation: 0 });
const meeting = (date: string, 상태: "계약" | "완료" | "예약" = "계약", 구분?: "이월") => Meeting.parse({ id: `${date}-${상태}`, 미팅날짜: date, 예약일: date, 예약시각: "09:00", 미팅시간: "10:00", 장소: "합성 장소", channel: "매입DB", 업체명: "합성 업체", 상태, 계약여부: 상태 === "계약", ...(구분 ? { 구분 } : {}) });
const period = () => recentTrendPeriod("2025-10-03", "2025-11-22", "9", "2026-01-05")!;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.dbEnabled.mockReturnValue(true);
  mocks.readWeek.mockResolvedValue({ rows: [] });
  mocks.readSalesRowsFromDb.mockResolvedValue([]);
  mocks.readMeetingsFromDb.mockResolvedValue([]);
  mocks.readContractsFromDb.mockResolvedValue([]);
  mocks.findByDateRange.mockResolvedValue(new Map());
});

describe("graduated recent trend", () => {
  it("uses the viewed arena's DB source even when reached through a trainer sheet path", async () => {
    mocks.readSalesRowsFromDb.mockResolvedValue([row("2026-01-05", 12, 0)]);
    const out = await readRecentTrendForSource("synthetic-arena", parseISO("2025-10-03"), "A1-0", period(), []);
    expect(out.weeklyTrend[7]!.활동량).toBe(12);
    expect(mocks.readWeek).not.toHaveBeenCalled();
    expect(mocks.findByDateRange).not.toHaveBeenCalled();
    expect(mocks.readSalesRowsFromDb).toHaveBeenCalledWith("synthetic-arena");
  });
  it("keeps course chart on ceremony day and changes the next day", () => {
    expect(recentTrendPeriod("2026-09-04", "2026-10-24", "11", "2026-11-21")).toBeUndefined();
    expect(recentTrendPeriod("2026-09-04", "2026-10-24", "11", "2026-11-22")).toMatchObject({ kind: "recent", endISO: "2026-11-22" });
    expect(recentTrendPeriod("2026-08-07", "2026-09-26", "10", "2026-10-25")).toBeUndefined();
  });
  it("uses legacy direct graduation date; missing/invalid date cannot falsely graduate", () => {
    expect(recentTrendPeriod("2025-10-03", "2025-11-22", "9", "2025-11-23")).toBeDefined();
    expect(recentTrendPeriod("2025-10-03", "", "9", "2026-01-05")).toBeUndefined();
    expect(recentTrendPeriod("2025-10-03", "2026-02-30", "9", "2026-03-01")).toBeUndefined();
  });
  it("spans eight Friday weeks across years and fills empty weeks", () => {
    const out = buildRecentTrend(period(), [], [], []);
    expect(out.weeklyTrendPeriod).toMatchObject({ startISO: "2025-11-14", endISO: "2026-01-05", status: "available" });
    expect(out.weeklyTrend).toHaveLength(8);
    expect(out.weeklyTrend[0]).toEqual({ 주차: 1, startISO: "2025-11-14", endISO: "2025-11-20", 계약수: 0, 활동량: 0 });
    expect(out.weeklyTrend[7]).toMatchObject({ startISO: "2026-01-02", endISO: "2026-01-05" });
  });
  it("counts the selected dates including today, excludes old/future records and preserves activity weights", () => {
    const out = buildRecentTrend(period(), [row("2025-11-13", 900), row("2025-11-14"), row("2026-01-05"), row("2026-01-06", 900)], [meeting("2025-11-14"), meeting("2026-01-05", "완료"), meeting("2026-01-06")], []);
    expect(out.weeklyTrend[0]).toMatchObject({ 계약수: 1, 활동량: 7 });
    expect(out.weeklyTrend[7]).toMatchObject({ 계약수: 0, 활동량: 7 });
    expect(out.weeklyTrend.reduce((sum, point) => sum + point.활동량, 0)).toBe(14);
  });
  it("preserves termination/manual and carryover activity semantics without double subtracting", () => {
    const payments = [
      ContractPayment.parse({ 계약일: "2026-01-02", 해지일: "2026-01-05", linkedMeetingId: "m" }),
      ContractPayment.parse({ 계약일: "2026-01-02", 해지일: "2026-01-05", linkedMeetingId: "manual:x" }),
    ];
    const out = buildRecentTrend(period(), [], [meeting("2026-01-02"), meeting("2026-01-03", "계약", "이월")], payments);
    expect(out.weeklyTrend[7]).toMatchObject({ 계약수: 1, 활동량: 2 });
  });
  it("reads canonical physical sheet weeks and uses DB only beyond the physical window", async () => {
    mocks.readWeek.mockImplementation(async (_id, week) => ({ rows: week === 9 ? [row("2025-11-28", 3, 0)] : [] }));
    mocks.readSalesRowsFromDb.mockResolvedValue([row("2025-11-28", 999, 0), row("2026-01-05", 7, 0)]);
    const out = await readRecentSheetTrend("synthetic", parseISO("2025-10-03"), period(), []);
    expect(mocks.readWeek.mock.calls.map(call => call[1])).toEqual([7, 8, 9, 10]);
    expect(out.weeklyTrend.reduce((sum, point) => sum + point.활동량, 0)).toBe(10);
    const dates = mocks.findByDateRange.mock.calls[0]![1];
    expect(dates[0]).toBe("2025-11-14");
    expect(dates.at(-1)).toBe("2026-01-05");
  });
  it("does not query DB when all requested dates are physically in the sheet", async () => {
    const p = recentTrendPeriod("2025-10-03", "2025-11-22", "9", "2025-11-23")!;
    await readRecentSheetTrend("synthetic", parseISO("2025-10-03"), p, []);
    expect(mocks.readSalesRowsFromDb).not.toHaveBeenCalled();
  });
  it("does not turn failures or disabled beyond-sheet DB into zero activity", async () => {
    mocks.dbEnabled.mockReturnValue(false);
    await expect(readRecentSheetTrend("synthetic", parseISO("2025-10-03"), period(), [])).rejects.toThrow("recent_trend_db_unavailable");
    expect(unavailableRecentTrend(period())).toMatchObject({ weeklyTrend: [], weeklyTrendPeriod: { status: "unavailable" } });
  });
});
