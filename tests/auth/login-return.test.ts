import { describe, expect, it } from "vitest";
import { safeLoginReturn } from "@/util/login-return";

describe("login return destination", () => {
  it.each([
    "/trainer/apply", "/trainer/invite/fixture-invite", "/trainer/invite?invite=fixture",
    "/dashboard?week=3", "/contact", "/admin/trainers", "/claim",
  ])("preserves the requested internal destination %s", (path) => {
    expect(safeLoginReturn(path)).toBe(path);
  });

  it.each([
    undefined, null, ["/trainer/apply"], "", "/", "/login", "/api/auth/signout",
    "https://example.org", "//example.org", "/\\example.org", "/%2fexample.org",
    "/trainer/../../api/auth/signout", "/trainer/%2e%2e/%2e%2e/", "/trainer/%252f%252fexample.org",
    "/trainer\n/apply", "/trainer?x=%0a", "/trainer?x=%5c", "/trainer?x=%zz",
    "/trainer-other", " /trainer", `/trainer?x=${"a".repeat(2048)}`,
  ])("rejects untrusted or looping destination %j", (path) => {
    expect(safeLoginReturn(path)).toBeNull();
  });
});
