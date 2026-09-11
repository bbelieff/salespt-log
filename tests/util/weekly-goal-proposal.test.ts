import { describe, expect, it } from "vitest";
import { proposeWeeklyGoals } from "@/util/weekly-goal-proposal";

describe("approved reverse goal proposal, direct cumulative rounding", () => {
  it("uses approved rates, not demo multipliers or iterative rounded stages", () => {
    expect(proposeWeeklyGoals(1)).toEqual({ production: 15, inflow: 13, contacts: 6, meetings: 3, contracts: 1 });
    expect(proposeWeeklyGoals(2)).toEqual({ production: 30, inflow: 25, contacts: 12, meetings: 5, contracts: 2 });
    expect(proposeWeeklyGoals(5)).toEqual({ production: 75, inflow: 63, contacts: 30, meetings: 13, contracts: 5 });
  });
  it("preserves zero", () => expect(Object.values(proposeWeeklyGoals(0))).toEqual([0, 0, 0, 0, 0]));
  it.each([-1, 1.1, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, 2147483648])("rejects invalid target %s", n => {
    expect(() => proposeWeeklyGoals(n)).toThrow();
  });
  it("rejects upstream overflow even when contract target fits", () => {
    expect(() => proposeWeeklyGoals(2147483647)).toThrow(/범위/);
  });
  it("does not mutate or reuse previous proposal objects", () => {
    const a = proposeWeeklyGoals(2); a.production = 0;
    expect(proposeWeeklyGoals(2).production).toBe(30);
  });
});
