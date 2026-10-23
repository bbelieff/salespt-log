import { describe, expect, it } from "vitest";
import { activityDays, classifyActivity, cumulativeSalesDays, summarizeWeek, type ActivityEvent } from "@/lib/analytics/activity-days";

const TODAY = "2026-10-22"; // 목요일

describe("activity day classification", () => {
  it("counts real customer actions as sales days; reading or non-contact results do not count", () => {
    for (const result of ["부재", "단순거절", "재통화", "컨택진행", "상담 후 거절"]) expect(classifyActivity({ kind: "contact", date: TODAY, result })).toBe("sales");
    expect(classifyActivity({ kind: "contact", date: TODAY, result: "미컨택" })).toBeNull();
    expect(classifyActivity({ kind: "contact", date: TODAY, result: "AS예정" })).toBeNull();
    expect(classifyActivity({ kind: "meetingResult", date: TODAY, state: "완료" })).toBe("sales");
    expect(classifyActivity({ kind: "meetingResult", date: TODAY, state: "계약" })).toBe("sales");
    for (const state of ["예약", "변경", "취소"] as const) expect(classifyActivity({ kind: "meetingResult", date: TODAY, state })).toBeNull();
  });
  it("daily metric input and the 'nothing special' line are record days, not sales days", () => {
    expect(classifyActivity({ kind: "dailyMetrics", date: TODAY })).toBe("record");
    expect(classifyActivity({ kind: "noteOnly", date: TODAY })).toBe("record");
  });
});

describe("activityDays", () => {
  it("one day per date, sales outranks record regardless of order", () => {
    const events: ActivityEvent[] = [
      { kind: "noteOnly", date: "2026-10-20" }, { kind: "contact", date: "2026-10-20", result: "부재" },
      { kind: "contact", date: "2026-10-21", result: "컨택진행" }, { kind: "dailyMetrics", date: "2026-10-21" }, { kind: "contract", date: "2026-10-21" },
    ];
    const days = activityDays(events, TODAY);
    expect([...days.entries()]).toEqual([["2026-10-20", "sales"], ["2026-10-21", "sales"]]);
  });
  it("ignores future dates (pre-filled rows) and invalid dates", () => {
    const days = activityDays([
      { kind: "dailyMetrics", date: "2026-10-23" }, { kind: "contact", date: "2026-12-01", result: "부재" },
      { kind: "contact", date: "", result: "부재" }, { kind: "contact", date: "2026-02-30", result: "부재" },
      { kind: "todoDone", date: TODAY },
    ], TODAY);
    expect([...days.keys()]).toEqual([TODAY]);
  });
});

describe("summarizeWeek (goal week Fri~Thu)", () => {
  const window = { start: "2026-10-16", end: "2026-10-22" }; // 금~목
  it("weekend without activity is a day off, weekday without activity is empty, today stays 'today' until something is saved", () => {
    const days = activityDays([
      { kind: "contact", date: "2026-10-16", result: "재통화" },
      { kind: "noteOnly", date: "2026-10-20" },
      { kind: "meetingBooked", date: "2026-10-21" },
    ], TODAY);
    const week = summarizeWeek(days, window, TODAY);
    expect(week.cells.map(c => c.state)).toEqual(["sales", "off", "off", "empty", "record", "sales", "today"]);
    expect(week).toMatchObject({ salesDays: 2, recordDays: 1, weekdays: 5 });
  });
  it("weekend activity shows but the denominator stays weekdays; future days are off", () => {
    const days = activityDays([{ kind: "contact", date: "2026-10-18", result: "컨택진행" }], "2026-10-19");
    const week = summarizeWeek(days, window, "2026-10-19");
    expect(week.cells.map(c => c.state)).toEqual(["empty", "off", "sales", "today", "off", "off", "off"]);
    expect(week.weekdays).toBe(5);
  });
  it("custom workdays (notification 'receive days') change off days and the denominator", () => {
    const days = activityDays([], TODAY);
    const week = summarizeWeek(days, window, TODAY, [1, 2, 3, 4, 5, 6]); // 토요일도 영업
    expect(week.cells.map(c => c.state)).toEqual(["empty", "empty", "off", "empty", "empty", "empty", "today"]);
    expect(week.weekdays).toBe(6);
  });
  it("a sales action today replaces the 'today' marker", () => {
    const days = activityDays([{ kind: "todoDone", date: TODAY }], TODAY);
    expect(summarizeWeek(days, window, TODAY).cells.at(-1)?.state).toBe("sales");
  });
});

describe("cumulativeSalesDays", () => {
  it("counts only sales days and never decreases when record days are added", () => {
    const base: ActivityEvent[] = [{ kind: "contact", date: "2026-10-01", result: "부재" }, { kind: "contract", date: "2026-10-02" }];
    const before = cumulativeSalesDays(activityDays(base, TODAY));
    const after = cumulativeSalesDays(activityDays([...base, { kind: "noteOnly", date: "2026-10-03" }], TODAY));
    expect(before).toBe(2);
    expect(after).toBe(2);
  });
});
