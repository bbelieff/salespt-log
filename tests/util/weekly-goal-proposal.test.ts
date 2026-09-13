import { describe, expect, it } from "vitest";
import { proposeFromCumulative, proposeWeeklyGoals } from "@/util/weekly-goal-proposal";
import type { GoalActuals } from "@/types/weekly-goals";

const cumulative = (over: Partial<GoalActuals> = {}): GoalActuals =>
  ({ production: 0, inflow: 0, contacts: 0, meetings: 0, contracts: 0, ...over });

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

describe("back-calculation from the student's own week 1 cumulative record", () => {
  const record = cumulative({ production: 1000, inflow: 200, contacts: 40, meetings: 8, contracts: 2 });
  it("scales each metric by its cumulative ratio to contracts, not by the previous week alone", () => {
    // 4 contracts = twice the cumulative 2, so every upstream target doubles.
    expect(proposeFromCumulative(record, 4).goals).toEqual({ production: 2000, inflow: 400, contacts: 80, meetings: 16, contracts: 4 });
  });
  it("divides once against the cumulative ratio instead of compounding rounded stages", () => {
    const { goals } = proposeFromCumulative(record, 3);
    expect(goals).toEqual({ production: 1500, inflow: 300, contacts: 60, meetings: 12, contracts: 3 });
  });
  it("rounds each target up so a fractional requirement is never under-set", () => {
    const { goals } = proposeFromCumulative(cumulative({ production: 7, inflow: 5, contacts: 3, meetings: 2, contracts: 2 }), 1);
    expect(goals).toEqual({ production: 4, inflow: 3, contacts: 2, meetings: 1, contracts: 1 });
  });
  it("exposes the cumulative numbers behind every row so the basis is auditable", () => {
    const { basis } = proposeFromCumulative(record, 4);
    expect(basis.map(b => b.key)).toEqual(["production", "inflow", "contacts", "meetings", "contracts"]);
    expect(basis[0]).toMatchObject({ cumulative: 1000, perContract: 500, value: 2000, fallback: false });
    expect(basis[3]).toMatchObject({ cumulative: 8, perContract: 4, value: 16, fallback: false });
  });
  it("falls back to the approved fixed rates when there is no contract history to divide by", () => {
    const first = proposeFromCumulative(cumulative({ production: 500, inflow: 90 }), 2);
    expect(first.goals).toEqual(proposeWeeklyGoals(2));
    expect(first.allFallback).toBe(true);
    expect(first.basis.every(b => b.perContract === null)).toBe(true);
  });
  it("falls back only for the stages the student has no record for", () => {
    const partial = proposeFromCumulative(cumulative({ inflow: 100, contacts: 20, meetings: 4, contracts: 2 }), 4);
    expect(partial.goals.inflow).toBe(200);
    expect(partial.goals.production).toBe(proposeWeeklyGoals(4).production);
    expect(partial.allFallback).toBe(false);
    expect(partial.basis.find(b => b.key === "production")?.fallback).toBe(true);
    expect(partial.basis.find(b => b.key === "inflow")?.fallback).toBe(false);
  });
  it("keeps the contract target exactly as entered", () => {
    expect(proposeFromCumulative(record, 0).goals.contracts).toBe(0);
    expect(proposeFromCumulative(record, 37).goals.contracts).toBe(37);
  });
  it.each([-1, 1.1, NaN, Infinity, 2147483648])("rejects invalid target %s", n => {
    expect(() => proposeFromCumulative(record, n)).toThrow();
  });
  it("rejects a proposal that would overflow the stored integer column", () => {
    expect(() => proposeFromCumulative(cumulative({ production: 1000000, contracts: 1 }), 2147483)).toThrow(/범위/);
  });
  it("ignores negative or fractional cumulative input rather than trusting it", () => {
    const odd = proposeFromCumulative(cumulative({ production: -5, inflow: 10.7, contracts: 1 }), 1);
    expect(odd.basis.find(b => b.key === "production")?.fallback).toBe(true);
    expect(odd.goals.inflow).toBe(10);
  });
});
