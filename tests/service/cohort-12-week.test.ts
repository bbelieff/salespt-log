import { describe, expect, it } from "vitest";
import { ceremonyISO, courseEndISO, courseWeeksForCohort, MAX_SHEET_WEEK, parseNumericCohort } from "@/config/cohort-dates";
import { computeDbAggregates } from "@/service/dashboard-aggregates";
import { traineeFunnelStatsFromDbRows } from "@/service/profile-stats-db";
import { chooseDailySource, chooseWriteSource } from "@/service/daily-source";
import type { DbSalesRow } from "@/repo/db/client";
import { weeklyGoalActuals } from "@/service/weekly-goals-actuals";
import { terminatedByWeek } from "@/service/termination-count";
import { ContractPayment } from "@/types";

describe("ADR-0032 per-cohort periods", () => {
  it.each(["10", "10기", "11", "12", "99"])("%s has twelve weeks", c => expect(courseWeeksForCohort(c)).toBe(12));
  it.each(["9", "8기", "A2-10", "연습", "", undefined])("legacy %s unchanged", c => expect(courseWeeksForCohort(c)).toBe(8));
  it("does not interpret arena or unsafe numeric labels as numeric cohorts", () => {
    expect(parseNumericCohort("A2-10")).toBeNull();
    expect(parseNumericCohort("999999999999999999999")).toBeNull();
  });
  it("separates cohort 10 ceremony from course end", () => {
    expect(courseEndISO("2026-08-07", "10")).toBe("2026-10-29");
    expect(ceremonyISO("2026-08-07", "10")).toBe("2026-10-25");
    expect(courseEndISO("2026-09-04", "11")).toBe("2026-11-26");
    expect(ceremonyISO("2026-09-04", "11")).toBe("2026-11-21");
    expect(ceremonyISO("2026-09-04", "9")).toBe("");
  });
  it("uses the Saturday inside the last week for every start weekday", () => {
    for (let day = 1; day <= 7; day++) {
      const start = `2026-09-0${day}`;
      const ceremony = new Date(ceremonyISO(start, "12") + "T00:00:00Z");
      const offset = (ceremony.getTime() - new Date(start + "T00:00:00Z").getTime()) / 86400000;
      expect(ceremony.getUTCDay()).toBe(6);
      expect(offset).toBeGreaterThanOrEqual(77);
      expect(offset).toBeLessThanOrEqual(83);
    }
  });
  it.each(["", "2026-02-30", "not-date"])("invalid date %s has no schedule", start => {
    expect(courseEndISO(start, "11")).toBe("");
    expect(ceremonyISO(start, "10")).toBe("");
  });
  it("includes week 12 and excludes week 13 without changing legacy", () => {
    const start = new Date(2026, 8, 4);
    const rows = ["2026-11-26", "2026-11-27"].map(date => ({date, channel:"매입DB", production: 3, inflow: 2, contactProgress: 1, meetingReservation: 4})) as DbSalesRow[];
    const ext = computeDbAggregates(rows, [], [], start, "2026-09-04", {cohort:"11"});
    expect(ext.weeklyActivity).toHaveLength(12);
    expect(ext.weeklyActivity[11]).toBe(4.5);
    expect(ext.channelMatrix[0]!.생산).toBe(3);
    const old = computeDbAggregates(rows, [], [], start, "2026-09-04");
    expect(old.weeklyActivity).toHaveLength(8);
    expect(old.channelMatrix[0]!.생산).toBe(0);
    expect(traineeFunnelStatsFromDbRows(rows, [], start, 12).미팅예정).toBe(4);
    expect(traineeFunnelStatsFromDbRows(rows, [], start).미팅예정).toBe(0);
    expect(weeklyGoalActuals(rows, [], [], "2026-11-20", "2026-11-26").production).toBe(3);
    const payments = ["2026-11-26", "2026-11-27"].map(계약일 => ContractPayment.parse({ 계약일, 업체명: "예시", 수임비: 1000, 해지일: "2026-12-01" }));
    expect(terminatedByWeek(payments, start, 12)[11]).toBe(1);
    expect(terminatedByWeek(payments, start).reduce((a,b) => a+b, 0)).toBe(0);
  });
  it("uses DB for future cohort overflow without expanding physical sheets", () => {
    for (const c of ["10", "11", "12", "13", "99"]) {
      expect(chooseDailySource(c, true)).toBe("db");
      expect(chooseWriteSource(c, true)).toBe("db");
    }
    expect(MAX_SHEET_WEEK).toBe(10);
  });
});
