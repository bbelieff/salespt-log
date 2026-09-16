import { describe, expect, it } from "vitest";
import { User } from "@/types";
import { pickCrmUser, applyTrainerQualifications } from "@/repo/trainer-qualification";
const student = User.parse({ email: "member@example.com", name: "학생", cohort: "8", role: "trainee", status: "active", spreadsheetId: "own-sheet" });
const pending = User.parse({ ...student, cohort: "T", role: "trainer", status: "pending", spreadsheetId: "" });
describe("separate trainer qualification from CRM identity", () => {
  it("pending or active trainer cannot displace a student's own registry identity", () => {
    for (const status of ["active", "archived"] as const) {
      const own = { ...student, status };
      expect(pickCrmUser([pending, own])).toBe(own);
      expect(pickCrmUser([{ ...pending, status: "active" }, own])).toBe(own);
    }
  });
  it("overlay revokes only trainer representation and leaves student bytes/keys intact", () => {
    const input = [pending, student];
    const before = JSON.stringify(input);
    const output = applyTrainerQualifications(input, [{ email: student.email, name: "트레이너", status: "revoked", department: "T" }]);
    expect(output).toEqual([student]);
    expect(JSON.stringify(input)).toBe(before);
  });
  it("active qualification is a separate sheetless row, pending never replaces student", () => {
    const output = applyTrainerQualifications([student], [{ email: student.email, name: "트레이너", status: "active", department: "T" }]);
    expect(output).toHaveLength(2);
    expect(output[0]).toBe(student);
    expect(output[1]).toMatchObject({ role: "trainer", spreadsheetId: "", status: "active" });
    expect(pickCrmUser(output)).toBe(student);
  });
});
