import { z } from "zod";
import { readTrainerStudentAccessFacts } from "@/repo/db/trainer-student-access";
import { TrainerAccessValue, TrainerAccountKey } from "@/types/trainer-access";
import type { TrainerAccessOperation, TrainerStudentTarget } from "@/types/trainer-access";
import { canTrainerAccessStudent } from "@/util/trainer-access-policy";
import { arenaCohortLabelParts, parseCohortToken } from "@/service/cohort-token";

const Facts = z.object({
  qualifications: z.array(z.object({ email: TrainerAccountKey, status: z.literal("active") }).strict()).length(1),
  settings: z.array(z.object({ grade: z.unknown(), grants: z.unknown(), version: z.number().int().min(1).max(2147483646) }).strict()).length(1),
  students: z.array(z.object({ email: z.string().email(), role: z.enum(["trainee", "trainer", "admin"]),
    status: z.enum(["active", "pending", "archived"]), cohort: z.string().min(1), cohort_label: z.string(),
    spreadsheet_id: z.string().optional(), course_start_iso: z.string().optional() }).strict()),
  cohorts: z.array(z.object({ label: z.string().trim().min(1), status: z.enum(["active", "archived"]), type: z.enum(["cohort", "arena"]) }).strict()),
}).strict();
function key(label: string): string { return parseCohortToken(label)?.label ?? label.trim(); }

/** Trainer-to-other-student only. Authentication, admin and self remain identity boundaries.
 * Never repair raw invalid status/grants and never pick an enrollment by email priority.
 */
export async function canAccessManagedStudent(actor: string, target: string | TrainerStudentTarget, operation: TrainerAccessOperation): Promise<boolean> {
  try {
    const actorKey = actor.toLowerCase(), targetKey = (typeof target === "string" ? target : target.email).toLowerCase();
    if (!TrainerAccountKey.safeParse(actorKey).success || !TrainerAccountKey.safeParse(targetKey).success) return false;
    if (typeof target !== "string" && (!target.spreadsheetId || !target.cohort || !target.courseStart)) return false;
    const facts = Facts.parse(await readTrainerStudentAccessFacts(actorKey,
      typeof target === "string" ? targetKey : { ...target, email: targetKey }));
    if (facts.qualifications[0]!.email !== actorKey) return false;
    const setting = facts.settings[0]!;
    const value = TrainerAccessValue.parse({ grade: setting.grade, grants: setting.grants });
    const students = facts.students.filter(row => row.role === "trainee");
    if (students.length !== 1 || facts.students.some(row => row.email.toLowerCase() !== targetKey)) return false;
    const student = students[0]!;
    if (typeof target !== "string" &&
      (student.spreadsheet_id !== target.spreadsheetId || student.cohort !== target.cohort || student.course_start_iso !== target.courseStart)) return false;
    if (student.cohort.trim() === "유보" || student.cohort_label.trim() === "유보") return false;
    const metadata = new Map<string, (typeof facts.cohorts)[number]>();
    for (const row of facts.cohorts) {
      const label = key(row.label);
      if (metadata.has(label)) return false;
      metadata.set(label, row);
    }
    const labels = [student.cohort, student.cohort_label].map(s => s.trim()).filter(Boolean);
    const resolved = new Set<(typeof facts.cohorts)[number]>();
    let arena = false;
    for (const label of labels) {
      const participant = arenaCohortLabelParts(label);
      const token = parseCohortToken(label);
      arena ||= participant !== null || token?.type === "arena";
      const required = participant ? [String(participant.gisu), `A${participant.season}`] : [key(label)];
      for (const requiredLabel of required) {
        const row = metadata.get(requiredLabel);
        if (!row) return false;
        resolved.add(row);
      }
    }
    // Conflicting ordinary cohort labels are not a trustworthy single enrollment.
    if (!arena && new Set(labels.map(key)).size !== 1) return false;
    const rows = [...resolved];
    return canTrainerAccessStudent({ ...value, status: "active" }, {
      rowStatus: student.status,
      cohortStatus: rows.some(row => row.status === "archived") ? "archived" : "active",
      cohortType: rows.some(row => row.type === "arena") ? "arena" : "cohort",
      cohortMetadataTrusted: rows.length > 0, isArenaLabel: arena, isReserved: false,
    }, operation);
  } catch { return false; }
}
