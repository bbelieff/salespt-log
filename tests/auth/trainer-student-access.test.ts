import { beforeEach, expect, it, vi } from "vitest";
import { defaultTrainerGrants } from "@/util/trainer-access-policy";
const m = vi.hoisted(() => ({ query: vi.fn(), enabled: true }));
vi.mock("@/repo/db/client", () => ({ dbEnabled: () => m.enabled, getDbPool: () => ({ query: m.query }) }));
import { canAccessManagedStudent } from "@/service/trainer-student-access";
const email = "coach@example.test", target = "student@example.test";
const facts = (grade = "regular") => ({
  qualifications: [{ email, status: "active" }],
  settings: [{ grade, grants: defaultTrainerGrants(grade), version: 1 }],
  students: [{ email: target, role: "trainee", status: "active", cohort: "8", cohort_label: "8기" }],
  cohorts: [{ label: "8", status: "active", type: "cohort" }, { label: "A2", status: "active", type: "arena" }],
});
beforeEach(() => { vi.resetAllMocks(); m.enabled = true; m.query.mockResolvedValue({ rows: [facts()] }); });
it.each(["read", "write"] as const)("regular unassigned active allows %s using raw metadata and saved qualification", async op => {
  expect(await canAccessManagedStudent(email, target, op)).toBe(true);
  expect(m.query).toHaveBeenCalledWith(expect.stringContaining("public.trainer_qualifications"), [email, target]);
});
it.each(["arena", "archived"])("regular denies %s", async category => {
  const f = facts(); if (category === "arena") f.students[0]!.cohort_label = "A2-8기"; else f.cohorts[0]!.status = "archived";
  m.query.mockResolvedValue({ rows: [f] });
  for (const op of ["read", "write"] as const) expect(await canAccessManagedStudent(email, target, op)).toBe(false);
});
it.each(["active", "arena", "archived"])("senior allows both operations for %s", async category => {
  const f = facts("senior"); if (category === "arena") f.students[0]!.cohort_label = "A2-8기"; else if (category === "archived") f.students[0]!.status = "archived";
  m.query.mockResolvedValue({ rows: [f] });
  for (const op of ["read", "write"] as const) expect(await canAccessManagedStudent(email, target, op)).toBe(true);
});
it("read-only saved reduction blocks write", async () => {
  const f = facts(); f.settings[0]!.grants.active.write = false; m.query.mockResolvedValue({ rows: [f] });
  expect(await canAccessManagedStudent(email, target, "read")).toBe(true); expect(await canAccessManagedStudent(email, target, "write")).toBe(false);
});
it("trusted arena type determines category independently of numeric label", async () => {
  const f = facts("senior"); f.cohorts[0]!.type = "arena"; m.query.mockResolvedValue({ rows: [f] });
  expect(await canAccessManagedStudent(email, target, "read")).toBe(true);
  f.settings[0]!.grade = "regular"; f.settings[0]!.grants = defaultTrainerGrants("regular");
  expect(await canAccessManagedStudent(email, target, "read")).toBe(false);
});
it.each<(f: ReturnType<typeof facts>) => void>([
  (f: ReturnType<typeof facts>) => { f.qualifications = []; },
  f => { f.qualifications[0]!.status = "revoked"; }, f => { f.qualifications[0]!.status = "pending"; },
  f => { f.qualifications.push(f.qualifications[0]!); }, f => { f.settings = []; },
  f => { f.settings[0]!.grade = "unknown"; }, f => { f.settings[0]!.grants = null as never; },
  f => { f.settings[0]!.grants.active.read = false; }, f => { f.settings[0]!.grants.arena.read = true; },
  f => { f.settings[0]!.grants.active.write = "true" as never; }, f => { f.settings[0]!.version = 0; },
  f => { f.students[0]!.status = ""; }, f => { f.students[0]!.status = "pending"; },
  f => { f.students[0]!.cohort = "유보"; }, f => { f.students[0]!.cohort = "unknown"; },
  f => { f.students[0]!.cohort_label = "unknown"; }, f => { f.students[0]!.cohort = null as never; },
  f => { f.students[0]!.role = "invalid"; }, f => { f.students[0]!.email = "other@example.test"; },
  f => { f.students.push({ ...f.students[0]!, status: "archived", cohort: "7" }); },
  f => { f.cohorts = []; }, f => { f.cohorts[0]!.status = ""; }, f => { f.cohorts[0]!.type = "unknown"; },
  f => { f.cohorts.push({ ...f.cohorts[0]!, label: "8기" }); },
  f => { f.students[0]!.cohort_label = "A2-8기"; f.cohorts.pop(); },
])("invalid/revoked/ambiguous facts deny both operations %#", async mutate => {
  const f = facts(); mutate(f); m.query.mockResolvedValue({ rows: [f] });
  for (const op of ["read", "write"] as const) expect(await canAccessManagedStudent(email, target, op)).toBe(false);
});
it("archived arena season takes precedence and missing raw result denies", async () => {
  const f = facts(); f.students[0]!.cohort_label = "A2-8기"; f.cohorts[1]!.status = "archived";
  m.query.mockResolvedValue({ rows: [f] }); expect(await canAccessManagedStudent(email, target, "read")).toBe(false);
  m.query.mockResolvedValue({ rows: [] }); expect(await canAccessManagedStudent(email, target, "read")).toBe(false);
});
it("DB disabled/read failure fails closed without fallback", async () => {
  m.enabled = false; expect(await canAccessManagedStudent(email, target, "read")).toBe(false); expect(m.query).not.toHaveBeenCalled();
  m.enabled = true; m.query.mockRejectedValue(new Error("private connection")); expect(await canAccessManagedStudent(email, target, "write")).toBe(false);
});
it.each(["read", "write"] as const)("exact targetRef reaches SQL without email-only substitution for %s", async op => {
  const selected = { email: target.toUpperCase(), spreadsheetId: "selected-sheet", cohort: "8", courseStart: "2026-09-04" };
  const f = facts();
  Object.assign(f.students[0]!, { spreadsheet_id: selected.spreadsheetId, course_start_iso: selected.courseStart });
  m.query.mockResolvedValue({ rows: [f] });
  expect(await canAccessManagedStudent(email, selected, op)).toBe(true);
  expect(m.query).toHaveBeenCalledWith(expect.stringContaining("spreadsheet_id = $3 and cohort = $4 and course_start_iso = $5"),
    [email, target, selected.spreadsheetId, selected.cohort, selected.courseStart]);
});
it.each(["spreadsheetId", "cohort", "courseStart"] as const)("exact targetRef rejects mismatched %s without a retry", async field => {
  const selected = { email: target, spreadsheetId: "selected-sheet", cohort: "8", courseStart: "2026-09-04" };
  const f = facts();
  Object.assign(f.students[0]!, { spreadsheet_id: selected.spreadsheetId, course_start_iso: selected.courseStart });
  m.query.mockResolvedValue({ rows: [f] });
  expect(await canAccessManagedStudent(email, { ...selected, [field]: "different" }, "write")).toBe(false);
  expect(m.query).toHaveBeenCalledTimes(1);
});
