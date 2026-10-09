import { describe, expect, it, vi } from "vitest";
import { activityTodayISO, compareWorkActivity, type ActivitySortValue } from "@/app/(app)/payment/_lib/payment-progress";
const value = (activityKind: ActivitySortValue["activityKind"], activityDate: string): ActivitySortValue => ({ activityKind, activityDate });
describe("PAYMENT-DDAY priority", () => {
  it("D? → overdue oldest → today → history oldest → future nearest, stable ties", () => {
    const input = [value("todo", "2026-10-12"), value("history", "2026-10-08"), value("todo", "2026-10-09"), value("none", ""), value("todo", "2026-10-10"), value("history", "2026-10-02"), value("todo", "2026-10-01"), value("todo", "2026-10-11"), value("todo", "2026-10-01")];
    expect(input.map((v, index) => ({ ...v, index })).sort((a, b) => compareWorkActivity(a, b, "2026-10-10")).map(v => v.index)).toEqual([3,6,8,2,4,5,1,7,0]);
  });
  it("unknown is not classified as missing; empty dates do not become overdue", () => {
    expect(compareWorkActivity(undefined, value("todo", "2026-10-01"), "2026-10-10")).toBe(0);
    expect(compareWorkActivity(value("todo", ""), value("none", ""), "2026-10-10")).toBe(0);
  });
  it("today uses Korean midnight rather than host timezone", () => {
    vi.useFakeTimers();
    try { vi.setSystemTime(new Date("2026-10-09T15:01:00Z")); expect(activityTodayISO()).toBe("2026-10-10"); }
    finally { vi.useRealTimers(); }
  });
});
