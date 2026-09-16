import { describe, expect, it } from "vitest";
import { proposeFromCumulative } from "@/util/weekly-goal-proposal";

describe("proposeFromCumulative", () => {
  it("distinguishes two students using only their own cumulative ratios", () => {
    const a = proposeFromCumulative(
      { production: 200, inflow: 200, contacts: 100, meetings: 50, contracts: 10 },
      5
    );
    const b = proposeFromCumulative(
      { production: 200, inflow: 200, contacts: 20, meetings: 50, contracts: 10 },
      5
    );
    expect(a.goals.contacts).toBe(50);
    expect(b.goals.contacts).toBe(10);
    expect(a.goals.meetings).toBe(25);
    expect(b.goals.meetings).toBe(25);
    // Same target but different own contacts history => different proposal.
    expect(a.goals.contacts).not.toBe(b.goals.contacts);
  });

  it("rounds up fractional ratios with a direct rational ceil and no intermediate rounding", () => {
    // ceil(2 * 10 / 3) = ceil(20/3) = 7. Rounding the ratio first would give 8.
    const r = proposeFromCumulative(
      { production: 10, inflow: 10, contacts: 10, meetings: 10, contracts: 3 },
      2
    );
    expect(r.goals.production).toBe(7);
    // ceil(1 * 2 / 3) = 1; truncating the ratio first would give 0.
    const small = proposeFromCumulative(
      { production: 2, inflow: 2, contacts: 2, meetings: 2, contracts: 3 },
      1
    );
    expect(small.goals.contacts).toBe(1);
    // Exact division stays exact.
    const exact = proposeFromCumulative(
      { production: 10, inflow: 10, contacts: 10, meetings: 10, contracts: 5 },
      3
    );
    expect(exact.goals.contacts).toBe(6);
  });

  it("returns null upstream with no-contract-history when own contracts are zero", () => {
    const r = proposeFromCumulative(
      { production: 100, inflow: 100, contacts: 100, meetings: 100, contracts: 0 },
      4
    );
    expect(r.goals).toEqual({
      production: null,
      inflow: null,
      contacts: null,
      meetings: null,
      contracts: 4,
    });
    for (const entry of r.basis) {
      if (entry.key === "contracts") {
        expect(entry.reason).toBeNull();
        expect(entry.value).toBe(4);
      } else {
        expect(entry.reason).toBe("no-contract-history");
        expect(entry.value).toBeNull();
        expect(entry.perContract).toBeNull();
      }
    }
  });

  it("handles partial stage history without substitution between stages", () => {
    const r = proposeFromCumulative(
      { production: 0, inflow: 30, contacts: 0, meetings: 12, contracts: 6 },
      3
    );
    // ceil(3 * 30 / 6) = 15, ceil(3 * 12 / 6) = 6; empty stages stay null.
    expect(r.goals.inflow).toBe(15);
    expect(r.goals.meetings).toBe(6);
    expect(r.goals.production).toBeNull();
    expect(r.goals.contacts).toBeNull();
    expect(r.goals.contracts).toBe(3);
    const byKey = Object.fromEntries(r.basis.map((e) => [e.key, e]));
    expect(byKey.production?.reason).toBe("no-stage-history");
    expect(byKey.contacts?.reason).toBe("no-stage-history");
    expect(byKey.inflow?.reason).toBeNull();
  });

  it("returns zero upstream goals for a zero target when history is usable", () => {
    const r = proposeFromCumulative(
      { production: 100, inflow: 80, contacts: 60, meetings: 40, contracts: 10 },
      0
    );
    expect(r.goals).toEqual({
      production: 0,
      inflow: 0,
      contacts: 0,
      meetings: 0,
      contracts: 0,
    });
    for (const entry of r.basis) {
      expect(entry.reason).toBeNull();
      expect(entry.value).toBe(0);
    }
  });

  it("retains a zero contracts target even with no history", () => {
    const r = proposeFromCumulative(
      { production: 0, inflow: 0, contacts: 0, meetings: 0, contracts: 0 },
      0
    );
    expect(r.goals.contracts).toBe(0);
    expect(r.goals.production).toBeNull();
  });

  it("rejects invalid contracts targets", () => {
    const good = { production: 10, inflow: 10, contacts: 10, meetings: 10, contracts: 5 };
    for (const bad of [-1, 1.5, NaN, Infinity, -Infinity, 2147483648, 9007199254740991 + 1]) {
      expect(() => proposeFromCumulative(good, bad)).toThrow();
    }
    expect(() => proposeFromCumulative(good, "5" as unknown as number)).toThrow();
    expect(() => proposeFromCumulative(good, undefined as unknown as number)).toThrow();
  });

  it("rejects result overflow", () => {
    expect(() =>
      proposeFromCumulative(
        { production: 2147483647, inflow: 1, contacts: 1, meetings: 1, contracts: 1 },
        2
      )
    ).toThrow();
  });

  it("accepts the max target when the ratio is exactly 1", () => {
    const r = proposeFromCumulative(
      { production: 7, inflow: 7, contacts: 7, meetings: 7, contracts: 7 },
      2147483647
    );
    expect(r.goals).toEqual({
      production: 2147483647,
      inflow: 2147483647,
      contacts: 2147483647,
      meetings: 2147483647,
      contracts: 2147483647,
    });
  });

  it("normalizes NaN, negative, and non-finite cumulative values and truncates fractions", () => {
    const r = proposeFromCumulative(
      {
        production: NaN,
        inflow: -10,
        contacts: Infinity,
        meetings: 3.9,
        contracts: 5,
      },
      2
    );
    expect(r.goals.production).toBeNull();
    expect(r.goals.inflow).toBeNull();
    expect(r.goals.contacts).toBeNull();
    // 3.9 truncates to 3: ceil(2 * 3 / 5) = 2.
    expect(r.goals.meetings).toBe(2);
    const byKey = Object.fromEntries(r.basis.map((e) => [e.key, e]));
    expect(byKey.production?.cumulative).toBe(0);
    expect(byKey.meetings?.cumulative).toBe(3);
  });

  it("treats non-positive own contracts history as no-contract-history", () => {
    const r = proposeFromCumulative(
      { production: 50, inflow: 50, contacts: 50, meetings: 50, contracts: -4 },
      3
    );
    expect(r.goals.production).toBeNull();
    expect(r.basis.find((e) => e.key === "production")?.reason).toBe("no-contract-history");
    expect(r.goals.contracts).toBe(3);
  });

  it("does not mutate the input cumulative object", () => {
    const input = { production: 10.9, inflow: 20, contacts: 30, meetings: 40, contracts: 5 };
    const snapshot = { ...input };
    const r = proposeFromCumulative(input, 2);
    expect(input).toEqual(snapshot);
    // Mutating the result must not affect a fresh call.
    (r.goals as Record<string, number | null>).contacts = 9999;
    const again = proposeFromCumulative(input, 2);
    expect(again.goals.contacts).toBe(12);
  });
});
