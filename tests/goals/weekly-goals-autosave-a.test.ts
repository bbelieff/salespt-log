/**
 * Scope A domain regressions — weekly-goals autosave payloads.
 * Behavioral: builders gate invalid input, freeze CAS identity, never mix
 * public/internal revisions (master #1010).
 */
import { describe, expect, it } from "vitest";
import {
  buildInternalPayload,
  buildPublicPayload,
  discardUnsaved,
  goalParamsFromTarget,
  goalTargetOf,
} from "@/components/weekly-goals/weeklyGoalAutosave";
import type { WeeklyGoalView } from "@/types/weekly-goals";

const NULL_GOALS = {
  production: null,
  inflow: null,
  contacts: null,
  meetings: null,
  contracts: null,
};

function view(week = 3): WeeklyGoalView {
  return {
    student: {
      email: "s@example.com",
      name: "학습자",
      cohort: "26-1",
      courseStart: "2026-09-04",
      region: "서울",
      trainers: [],
    },
    current: {
      week,
      start: "2026-09-18",
      end: "2026-09-24",
      record: { goals: { ...NULL_GOALS }, task: "", revision: 7, updatedAt: null },
      actuals: { production: 0, inflow: 0, contacts: 0, meetings: 0, contracts: 0 },
    },
    previous: null,
    reporting: {
      start: "2026-09-18",
      end: "2026-09-24",
      actuals: { production: 0, inflow: 0, contacts: 0, meetings: 0, contracts: 0 },
    },
    cumulative: { production: 0, inflow: 0, contacts: 0, meetings: 0, contracts: 0 },
    canReadInternal: true,
  };
}

describe("weekly-goals public payload", () => {
  it("accepts coherent counts and freezes the SAVED revision (CAS)", () => {
    const r = buildPublicPayload(
      { ...NULL_GOALS, production: 5, contracts: 1 },
      "과제 한 줄",
      7,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.revision).toBe(7); // saved revision, never a draft guess
      expect(r.payload.goals.production).toBe(5);
    }
  });

  it("rejects negative counts without a payload (nothing to send)", () => {
    const r = buildPublicPayload({ ...NULL_GOALS, inflow: -1 }, "", 7);
    expect(r.ok).toBe(false);
  });

  it("rejects fractional counts", () => {
    const r = buildPublicPayload({ ...NULL_GOALS, meetings: 1.5 }, "", 7);
    expect(r.ok).toBe(false);
  });

  it("rejects an over-long task", () => {
    const r = buildPublicPayload({ ...NULL_GOALS }, "x".repeat(10001), 7);
    expect(r.ok).toBe(false);
  });

  it("freezes student/enrollment/week identity for the queue", () => {
    const t = goalTargetOf(view(4), "public");
    expect(t).toMatchObject({
      kind: "weekly-goal-public",
      student: "s@example.com",
      cohort: "26-1",
      courseStart: "2026-09-04",
      week: 4,
    });
  });

  it("separates public and internal queue identities", () => {
    expect(goalTargetOf(view(), "public").kind).not.toBe(
      goalTargetOf(view(), "internal").kind,
    );
  });
});

describe("bound request params (captured target, never the live view)", () => {
  it("rebuilds the exact goalParams triple from the frozen target", () => {
    const params = goalParamsFromTarget(goalTargetOf(view(4), "public"));
    expect(params.get("student")).toBe("s@example.com");
    expect(params.get("week")).toBe("4");
    expect(JSON.parse(params.get("enrollment")!)).toEqual(["26-1", "2026-09-04"]);
  });
});

describe("leave-without-save discard (final F-core: discard() only)", () => {
  it("invokes the core discard()", () => {
    let discarded = 0;
    discardUnsaved({ discard: () => { discarded++; } });
    expect(discarded).toBe(1);
  });
});

describe("weekly-goals internal payload", () => {
  it("carries its own revision, independent of the public record", () => {
    const r = buildInternalPayload("특이사항", "성과", 12);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload.revision).toBe(12);
  });

  it("rejects over-long notes without a payload", () => {
    expect(buildInternalPayload("x".repeat(10001), "", 1).ok).toBe(false);
    expect(buildInternalPayload("", "y".repeat(10001), 1).ok).toBe(false);
  });
});
