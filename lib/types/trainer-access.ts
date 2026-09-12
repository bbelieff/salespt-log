import { z } from "zod";
/** Pure trainer-to-student policy contracts. */
/** Server-resolved facts for one already-identified trainee row, not a user lookup. */
export interface NormalizedTrainerStudent {
  readonly rowStatus: "active" | "pending" | "archived" | "inactive";
  readonly cohortStatus: "active" | "archived" | null;
  readonly cohortType: "cohort" | "arena" | null;
  /** Explicit successful, authoritative metadata resolution; catch-to-empty is NOT success. */
  readonly cohortMetadataTrusted: boolean;
  /** Check both registry cohort and cohortLabel, including arena season labels. */
  readonly isArenaLabel: boolean;
  /** Normalize the registry reserved sentinel before calling; never infer from a name. */
  readonly isReserved: boolean;
}

/** Caller has already authenticated and selected the trainer qualification, not a CRM row.
 * Admin and own-CRM access are separate caller-owned paths and MUST NOT depend on this policy.
 * Grants are mandatory: callers may explicitly obtain defaults, never default a corrupt value.
 */
export interface NormalizedTrainerActor {
  readonly grade: TrainerGrade | null;
  readonly status: "active" | "pending" | "inactive" | "archived";
  readonly grants: TrainerGrants | null;
}

export type TrainerGrade = "senior" | "regular" | "apprentice";
export type TrainerStudentCategory = "active" | "arena" | "archived";
export type TrainerAccessOperation = "read" | "write";
/** One selected registry enrollment. Email alone is intentionally insufficient
 * when a person has more than one trainee registration. */
export interface TrainerStudentTarget {
  readonly email: string;
  readonly spreadsheetId: string;
  readonly cohort: string;
  readonly courseStart: string;
}
export type TrainerCategoryGrant = Readonly<{ read: boolean; write: boolean }>;
export type TrainerGrants = Readonly<Record<TrainerStudentCategory, TrainerCategoryGrant>>;

/** Persistence boundary; no coercion, omitted categories, or implicit grade. */
export const TrainerGradeSchema = z.enum(["senior", "regular", "apprentice"]);
export const TrainerAccountKey = z.string().email().max(254).refine(s => s === s.trim().toLowerCase());
const Grant = z.object({ read: z.boolean(), write: z.boolean() }).strict()
  .refine(g => !g.write || g.read);
export const TrainerGrantsSchema = z.object({ active: Grant, arena: Grant, archived: Grant }).strict();
export const TrainerAccessValue = z.object({ grade: TrainerGradeSchema, grants: TrainerGrantsSchema }).strict()
  .refine(s => s.grade === "senior" || (!s.grants.arena.read && !s.grants.arena.write && !s.grants.archived.read && !s.grants.archived.write));
export const TrainerAccessCommand = z.object({
  email: TrainerAccountKey, grade: TrainerGradeSchema, grants: TrainerGrantsSchema,
  version: z.number().int().min(0).max(2147483646),
}).strict().refine(s => TrainerAccessValue.safeParse({ grade: s.grade, grants: s.grants }).success);
export type TrainerAccessCommand = z.infer<typeof TrainerAccessCommand>;
export interface TrainerAccessSetting { grade: TrainerGrade; grants: TrainerGrants; version: number }
/** Compatible with #956 trainer_qualifications; display name is never an identity key. */
export interface TrainerAccessQualification { email: string; name: string; status: string }
export interface TrainerAccessPerson extends TrainerAccessQualification {
  grade: TrainerGrade | null; grants: TrainerGrants; version: number;
}
