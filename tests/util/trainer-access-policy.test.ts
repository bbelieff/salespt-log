import { describe, expect, expectTypeOf, it } from "vitest";
import { canTrainerAccessStudent, classifyTrainerStudent, defaultTrainerGrants, isTrainerGrants } from "@/util/trainer-access-policy";

import { arenaCohortLabelParts, parseCohortToken } from "@/service/cohort-token";
import type { NormalizedTrainerStudent, TrainerGrants, TrainerStudentCategory } from "@/types/trainer-access";

const student: NormalizedTrainerStudent = {
  rowStatus: "active", cohortStatus: "active", cohortType: "cohort",
  cohortMetadataTrusted: true, isArenaLabel: false, isReserved: false,
};

const rw = { read: true, write: true };
const denied = { read: false, write: false };

const validGrants = { active: rw, arena: denied, archived: denied };
const invalidGrants: unknown[] = [
  undefined, null, false, "all", [], [validGrants], {},
  { active: rw },
  { ...validGrants, extra: denied },
  { ...validGrants, active: { read: true } },
  { ...validGrants, active: { write: true } },
  { ...validGrants, active: { read: false, write: true } },
  { ...validGrants, arena: { read: false, write: true } },
  { ...validGrants, archived: { read: false, write: true } },
  { ...validGrants, active: { read: "true", write: true } },
  { ...validGrants, active: { read: 1, write: 0 } },
  { ...validGrants, active: { ...rw, admin: true } },
  { ...validGrants, active: [true, true] },
  { ...validGrants, active: null },
  Object.create(validGrants),
  { ...validGrants, active: Object.create(rw) },
];

describe("isTrainerGrants", () => {
  it.each([validGrants, { active: denied, arena: rw, archived: rw },
    { active: { read: true, write: false }, arena: denied, archived: denied }])(
    "accepts complete boolean grants %j", (grants) => {
      expect(isTrainerGrants(grants)).toBe(true);
    },
  );
  it.each(invalidGrants.map((value, index) => ({ value, index })))(
    "rejects malformed grants #$index without repairing them", ({ value }) => {
      expect(isTrainerGrants(value)).toBe(false);
    },
  );
});

describe("classifyTrainerStudent", () => {
  it("requires a confirmed regular cohort before returning active", () => {
    expect(classifyTrainerStudent(student)).toBe("active");
  });
  it.each([
    { cohortType: "arena" }, { isArenaLabel: true },
    { cohortType: "cohort", isArenaLabel: true },
  ])("arena evidence overrides ordinary type: %j", (fields) => {
    expect(classifyTrainerStudent({ ...student, ...fields })).toBe("arena");
  });
  it.each([
    { rowStatus: "archived" }, { cohortStatus: "archived" },
    { cohortStatus: "archived", rowStatus: "archived" },
    { cohortStatus: "archived", cohortType: "arena", isArenaLabel: true },
    { rowStatus: "archived", cohortType: "arena", isArenaLabel: true },
  ])("archived row/cohort wins over active and arena: %j", (fields) => {
    expect(classifyTrainerStudent({ ...student, ...fields })).toBe("archived");
  });
  it.each([
    { rowStatus: "pending" }, { rowStatus: "inactive" }, { rowStatus: null },
    { rowStatus: "reserved" }, { rowStatus: "" }, { rowStatus: "unknown" },
    { isReserved: true }, { isReserved: true, rowStatus: "archived" },
    { rowStatus: "pending", cohortStatus: "archived" },
    { cohortStatus: undefined }, { cohortStatus: null }, { cohortStatus: "unknown" },
    { cohortType: undefined }, { cohortType: null }, { cohortType: "unknown" },
    { cohortMetadataTrusted: false }, { cohortMetadataTrusted: undefined },
    { cohortMetadataTrusted: "true" },
    { cohortMetadataTrusted: false, rowStatus: "archived" },
    { isArenaLabel: undefined }, { isArenaLabel: "false" },
    { isReserved: undefined }, { isReserved: 0 },
  ])("excludes ineligible or unknown input: %j", (fields) => {
    expect(classifyTrainerStudent({ ...student, ...fields })).toBeNull();
  });
  it.each([null, undefined, [], [student], {}, Object.create(student)])(
    "rejects non-contract input %j", (input) => {
      expect(classifyTrainerStudent(input)).toBeNull();
    },
  );
  it.each(["12", "12기", "A2", "A2회", "A2-1", "A2-1기"])(
    "consumes existing parser evidence for %s, not an active fallback", (label) => {
      const token = parseCohortToken(label);
      const isArenaLabel = token?.type === "arena" || arenaCohortLabelParts(label) !== null;
      expect(classifyTrainerStudent({ ...student, isArenaLabel })).toBe(
        label.startsWith("A") ? "arena" : "active",
      );
    },
  );
});

describe("canTrainerAccessStudent", () => {
  const grades = ["senior", "regular", "apprentice"] as const;
  const categories = ["active", "arena", "archived"] as const;
  const operations = ["read", "write"] as const;
  const target = (category: typeof categories[number]): NormalizedTrainerStudent => ({
    ...student,
    isArenaLabel: category === "arena",
    rowStatus: category === "archived" ? "archived" : "active",
  });
  const actor = (grade: unknown = "senior") => ({
    grade, status: "active", grants: defaultTrainerGrants(grade),
  });

  it.each(grades.flatMap((grade) => categories.flatMap((category) =>
    operations.map((operation) => ({ grade, category, operation })),
  )))("$grade / $category / $operation default matrix", ({ grade, category, operation }) => {
    expect(canTrainerAccessStudent(actor(grade), target(category), operation))
      .toBe(grade === "senior" || category === "active");
  });
  it.each(["pending", "inactive", "archived", "", "unknown", null, undefined])(
    "non-active actor %j cannot read or write", (status) => {
      for (const operation of operations) {
        expect(canTrainerAccessStudent({ ...actor(), status }, student, operation)).toBe(false);
      }
    },
  );
  it.each(["", "unknown", "Senior", " senior ", "__proto__", "constructor", null, undefined, 1, [], {}])(
    "unknown grade %j cannot use even fully permissive grants", (grade) => {
      expect(canTrainerAccessStudent({ ...actor(), grade }, student, "read")).toBe(false);
      expect(canTrainerAccessStudent({ ...actor(), grade }, student, "write")).toBe(false);
    },
  );
  it.each(invalidGrants.map((grants, index) => ({ grants, index })))(
    "invalid grants #$index deny the entire policy (no fallback)", ({ grants }) => {
      expect(canTrainerAccessStudent({ ...actor(), grants }, student, "read")).toBe(false);
      expect(canTrainerAccessStudent({ ...actor(), grants }, student, "write")).toBe(false);
    },
  );
  it.each([null, undefined, [], {}, { grade: "senior", status: "active" }, Object.create(actor())])(
    "missing/invalid actor %j denies", (input) => {
      expect(canTrainerAccessStudent(input, student, "read")).toBe(false);
    },
  );
  it.each([null, undefined, [], "READ", "delete", "constructor"])(
    "unknown operation %j denies", (operation) => {
      expect(canTrainerAccessStudent(actor(), student, operation)).toBe(false);
    },
  );
  it("explicit read-only grants do not acquire write permission", () => {
    const readOnly = { ...actor(), grants: {
      active: { read: true, write: false }, arena: denied, archived: denied,
    } };
    expect(canTrainerAccessStudent(readOnly, student, "read")).toBe(true);
    expect(canTrainerAccessStudent(readOnly, student, "write")).toBe(false);
    expect(canTrainerAccessStudent(readOnly, target("arena"), "read")).toBe(false);
  });
  it.each(["regular", "apprentice"])("%s cannot exceed its grade ceiling", (grade) => {
    const expanded = { ...actor(), grade };
    for (const category of ["arena", "archived"] as const) {
      for (const operation of operations) {
        expect(canTrainerAccessStudent(expanded, target(category), operation)).toBe(false);
      }
    }
  });
  it.each([
    null, [], { ...student, rowStatus: "pending" }, { ...student, isReserved: true },
    { ...student, cohortMetadataTrusted: false }, { ...student, cohortStatus: null },
    { ...student, isArenaLabel: undefined },
  ])("even senior cannot access excluded/unknown student %j", (input) => {
    expect(canTrainerAccessStudent(actor(), input, "read")).toBe(false);
    expect(canTrainerAccessStudent(actor(), input, "write")).toBe(false);
  });
  it("cohort archive prevents a regular actor using an active row", () => {
    expect(canTrainerAccessStudent(actor("regular"), {
      ...student, cohortStatus: "archived",
    }, "read")).toBe(false);
  });
  it("arena evidence in cached label prevents numeric registry active misclassification", () => {
    const registryToken = parseCohortToken("12");
    const labelParts = arenaCohortLabelParts("A2-12기");
    const normalized = { ...student,
      cohortType: registryToken!.type, isArenaLabel: labelParts !== null,
    };
    expect(canTrainerAccessStudent(actor("regular"), normalized, "read")).toBe(false);
    expect(canTrainerAccessStudent(actor("senior"), normalized, "read")).toBe(true);
  });
  it("does not mutate frozen actor, grants or normalized student", () => {
    const grants = defaultTrainerGrants("senior");
    Object.values(grants).forEach(Object.freeze);
    const frozen = Object.freeze({ ...actor(), grants: Object.freeze(grants) });
    expect(canTrainerAccessStudent(frozen, Object.freeze({ ...student }), "write")).toBe(true);
    expect(frozen.grants).toEqual(defaultTrainerGrants("senior"));
  });
});

describe("defaultTrainerGrants", () => {
  it("keeps import-free inferred outputs compatible with the public contracts", () => {
    expectTypeOf<ReturnType<typeof defaultTrainerGrants>>().toMatchTypeOf<TrainerGrants>();
    expectTypeOf<ReturnType<typeof classifyTrainerStudent>>()
      .toEqualTypeOf<TrainerStudentCategory | null>();
  });
  it("returns independent grants for each category and call", () => {
    const first = defaultTrainerGrants("senior");
    expect(first.active).not.toBe(first.arena);
    expect(first.arena).not.toBe(first.archived);
    expect(first.active).not.toBe(defaultTrainerGrants("senior").active);
  });
  it.each(["regular", "apprentice"])("%s gets only active RW", (grade) => {
    expect(defaultTrainerGrants(grade)).toEqual({ active: rw, arena: denied, archived: denied });
  });

  it.each([undefined, null, "", "unknown", "Senior", " senior ", "constructor", "__proto__", 1, {}, []])(
    "unknown grade %j denies every category", (grade) => {
      expect(defaultTrainerGrants(grade)).toEqual({ active: denied, arena: denied, archived: denied });
    },
  );

  it("senior gets explicit read/write grants for all categories", () => {
    expect(defaultTrainerGrants("senior")).toEqual({ active: rw, arena: rw, archived: rw });
  });
});
