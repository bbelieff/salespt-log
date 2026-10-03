/** Pure projection. Never use a trainer qualification as the student's CRM key. */
import { User } from "@/types";
import { pickPreferredUser } from "./user-priority";
export interface TrainerQualification {
  email: string;
  name: string;
  status: "pending" | "active" | "rejected" | "revoked" | "cancelled";
  department: string;
}
export function pickCrmUser(users: User[]): User | null {
  const students = users.filter((u) => u.role === "trainee");
  return pickPreferredUser(students) ?? pickPreferredUser(users.filter((u) => u.status === "active")) ?? pickPreferredUser(users);
}
export function applyTrainerQualifications(users: User[], qualifications: TrainerQualification[]): User[] {
  const emails = new Set(qualifications.map((q) => q.email.toLowerCase()));
  const activeEmails = new Set(qualifications.filter(q=>q.status === "active").map(q=>q.email.toLowerCase()));
  const result = users.filter((u) => !(u.role === "trainer" && emails.has(u.email.toLowerCase())) && !(u.role === "admin" && activeEmails.has(u.email.toLowerCase())));
  for (const q of qualifications) {
    if (q.status !== "active" && q.status !== "pending") continue;
    result.push(User.parse({ email: q.email, name: q.name, role: "trainer", status: q.status, cohort: q.department, spreadsheetId: "" }));
  }
  return result;
}
