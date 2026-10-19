/** Read-only recent trend; course KPIs and source selection remain unchanged. */
import type { ContractPayment, DashboardView, Meeting } from "@/types";
import { ceremonyISO, MAX_SHEET_WEEK, STATS_WEEKS } from "@/config/cohort-dates";
import { addDays, fmtISO, friOf, isValidISODate, parseISO, weekIndexOf } from "@/util/week";
import { readWeek } from "@/repo/sales";
import { dbEnabled, readSalesRowsFromDb, type DbSalesRow } from "@/repo/db/client";
import { findByDateRange } from "@/repo/meetings";
import { readContractsFromDb, readMeetingsFromDb } from "@/repo/db/read-daily";
import { chooseDailySource } from "./daily-source";
import { weeklyActivityFromDb, weeklyContractsFromDb } from "./dashboard-aggregates";
import { terminatedByWeek } from "./termination-count";

export type RecentTrend = Pick<DashboardView, "weeklyTrend" | "weeklyTrendPeriod">;
export type RecentPeriod = NonNullable<DashboardView["weeklyTrendPeriod"]>;

/** Ceremony itself is still in-course, matching CourseBanner's day-after rule. */
export function recentTrendPeriod(
  startISO: string, graduationISO: string, cohort: string | undefined, today: string,
): RecentPeriod | undefined {
  const end = ceremonyISO(startISO, cohort) || graduationISO;
  if (!isValidISODate(today) || !isValidISODate(end) || today <= end) return undefined;
  const start = addDays(friOf(parseISO(today)), -(STATS_WEEKS - 1) * 7);
  return { kind: "recent", startISO: fmtISO(start), endISO: today, status: "available" };
}

export function unavailableRecentTrend(period: RecentPeriod): RecentTrend {
  return { weeklyTrend: [], weeklyTrendPeriod: { ...period, status: "unavailable" } };
}

export function buildRecentTrend(
  period: RecentPeriod, sales: DbSalesRow[], meetings: Meeting[], payments: ContractPayment[],
): RecentTrend {
  const within = (date: string | undefined) => !!date && isValidISODate(date)
    && date >= period.startISO && date <= period.endISO;
  const selectedSales = sales.filter((row) => within(row.date));
  const selectedMeetings = meetings.filter((row) => within(row.미팅날짜));
  const selectedPayments = payments.filter((row) => within(row.계약일));
  const anchor = parseISO(period.startISO);
  const contracts = weeklyContractsFromDb(selectedMeetings, anchor, STATS_WEEKS);
  const activity = weeklyActivityFromDb(selectedSales, selectedMeetings, anchor, STATS_WEEKS);
  const terminated = terminatedByWeek(selectedPayments, anchor, STATS_WEEKS);
  return {
    weeklyTrendPeriod: period,
    weeklyTrend: Array.from({ length: STATS_WEEKS }, (_, index) => {
      const startISO = fmtISO(addDays(anchor, index * 7));
      const through = fmtISO(addDays(anchor, index * 7 + 6));
      return {
        주차: index + 1, startISO, endISO: through < period.endISO ? through : period.endISO,
        계약수: Math.max(0, (contracts[index] ?? 0) - (terminated[index] ?? 0)),
        활동량: activity[index] ?? 0,
      };
    }),
  };
}

/** A fallback must never substitute a stale DB mirror for canonical sheet days. */
export async function readRecentSheetTrend(
  sheetId: string, courseStart: Date, period: RecentPeriod, payments: ContractPayment[],
): Promise<RecentTrend> {
  const dates: string[] = [];
  const physicalWeeks = new Set<number>();
  let needsDb = false;
  for (let day = parseISO(period.startISO); fmtISO(day) <= period.endISO; day = addDays(day, 1)) {
    dates.push(fmtISO(day));
    const week = weekIndexOf(day, courseStart);
    if (week >= 1 && week <= MAX_SHEET_WEEK) physicalWeeks.add(week);
    if (week > MAX_SHEET_WEEK) needsDb = true;
  }
  if (needsDb && !dbEnabled()) throw new Error("recent_trend_db_unavailable");
  const [weeks, dbRows, meetingMap] = await Promise.all([
    Promise.all([...physicalWeeks].map((week) => readWeek(sheetId, week))),
    needsDb ? readSalesRowsFromDb(sheetId) : Promise.resolve([]),
    findByDateRange(sheetId, dates, "meeting"),
  ]);
  const rows = [
    ...weeks.flatMap((week) => week.rows),
    ...dbRows.filter((row) => weekIndexOf(parseISO(row.date), courseStart) > MAX_SHEET_WEEK),
  ];
  return buildRecentTrend(period, rows, Array.from(meetingMap.values()).flat(), payments);
}

/** The viewed sheet's source matters, including a trainer's own-arena override. */
export async function readRecentTrendForSource(
  sheetId: string, courseStart: Date, cohort: string, period: RecentPeriod, payments: ContractPayment[],
): Promise<RecentTrend> {
  if (chooseDailySource(cohort, dbEnabled()) !== "db") return readRecentSheetTrend(sheetId, courseStart, period, payments);
  const [sales, meetings, contracts] = await Promise.all([
    readSalesRowsFromDb(sheetId), readMeetingsFromDb(sheetId), readContractsFromDb(sheetId),
  ]);
  return buildRecentTrend(period, sales, meetings, contracts);
}
