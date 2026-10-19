/** 구조 개선 ⑧ — 주차 창·오늘 날짜를 week.ts 하나로. 옛 계산과 같은 답인지 고정. */
import { describe, expect, it } from "vitest";
import { addDays, fmtISO, friOf, friWeekIndexOf, goalWeekOf, goalWeekWindow, parseISO, todayKST } from "@/util/week";
import { periodBounds } from "@/util/finance-period";
import { activityTodayISO } from "@/app/(app)/payment/_lib/payment-progress";

describe("오늘(KST) 한 곳", () => {
  it("UTC 15시 이후는 다음 날", () => {
    expect(todayKST(new Date("2026-10-07T15:30:00Z"))).toBe("2026-10-08");
    expect(todayKST(new Date("2026-10-07T14:59:00Z"))).toBe("2026-10-07");
  });
  it("옛 이름들은 같은 함수", () => {
    expect(activityTodayISO).toBe(todayKST);
  });
});

describe("달력 주(월~일)", () => {
  it.each([["2026-10-19", "2026-10-19", "2026-10-25"], ["2026-10-25", "2026-10-19", "2026-10-25"], ["2026-11-01", "2026-10-26", "2026-11-01"]])("%s", (d, mon, sun) => {
    expect(periodBounds("week", "", "", d)).toEqual([mon, sun]);
  });
});

describe("주간목표 주차 창(금~목) — 옛 두 계산과 같은 답", () => {
  const starts = ["2026-08-29", "2026-09-04", "2026-09-07"];
  it.each(starts)("수강 시작 %s", (cs) => {
    for (let i = -10; i < 120; i += 3) {
      const today = fmtISO(addDays(parseISO(cs), i));
      const week = goalWeekOf(today, cs);
      expect(week).toBe(Math.max(1, friWeekIndexOf(parseISO(today), parseISO(cs))));
      const oldServer = fmtISO(addDays(friOf(parseISO(cs)), (week - 1) * 7));
      const t = parseISO(today), s = parseISO(cs);
      const oldOverview = fmtISO(friOf(t < friOf(s) ? s : t));
      const w = goalWeekWindow(cs, week);
      expect(w.start).toBe(oldServer);
      expect(w.start).toBe(oldOverview);
      expect(w.end).toBe(fmtISO(addDays(parseISO(w.start), 6)));
      expect(w.prevEnd).toBe(fmtISO(addDays(parseISO(w.prevStart), 6)));
      expect(w.firstStart).toBe(fmtISO(friOf(s)));
    }
  });
});
