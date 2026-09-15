import { describe, expect, it } from "vitest";
import { defaultTrainerGrants, retainTrainerGrantsForGrade } from "@/util/trainer-access-policy";

describe("explicit trainer grants on grade change", () => {
  it.each(["regular", "senior", "apprentice"])("does not grant new %s access", grade => {
    expect(retainTrainerGrantsForGrade(defaultTrainerGrants(null), grade)).toEqual(defaultTrainerGrants(null));
  });
  it("preserves checked grants on promotion without adding new categories", () => {
    const saved = defaultTrainerGrants("regular");
    saved.active.write = false;
    expect(retainTrainerGrantsForGrade(saved, "senior")).toEqual(saved);
  });
  it("removes disallowed grants on demotion without mutating saved data", () => {
    const saved = defaultTrainerGrants("senior");
    expect(retainTrainerGrantsForGrade(saved, "regular")).toEqual(defaultTrainerGrants("regular"));
    expect(saved.arena.read).toBe(true);
  });
  it("does not recover invalid grants into access", () => {
    expect(retainTrainerGrantsForGrade(null, "senior")).toEqual(defaultTrainerGrants(null));
  });
});
