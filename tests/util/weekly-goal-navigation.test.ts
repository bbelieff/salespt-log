import { describe, expect, it } from "vitest";
import { goalReturnTarget } from "@/util/weekly-goal-navigation";

describe("weekly goal entry route", () => {
  it.each(["/dashboard", "/db", "/contact", "/schedule"])("keeps trainer's student entry %s", href => {
    expect(goalReturnTarget(href, true).href).toBe(href);
  });
  it("preserves trainer roster entry", () => {
    expect(goalReturnTarget("/trainer/weekly-goals", true)).toEqual({ href: "/trainer/weekly-goals", label: "담당 수강생" });
  });
  it.each(["https://attacker.test", "//attacker.test", "/dashboard?next=evil", "/unknown", "toString"])("rejects unknown return target %s", value => {
    expect(goalReturnTarget(value).href).toBe("/dashboard");
  });
  it("keeps role fallback only for direct links without an entry", () => {
    expect(goalReturnTarget(undefined, true).href).toBe("/trainer/weekly-goals");
    expect(goalReturnTarget(undefined, false).href).toBe("/dashboard");
  });
});
