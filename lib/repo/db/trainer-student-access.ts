import { dbEnabled, getDbPool } from "./client";
import type { TrainerStudentTarget } from "@/types/trainer-access";

/** One uncached statement/snapshot; raw DB values, no Sheet/cache/default-active fallback.
 * Email-only access cannot identify multiple student enrollments; service rejects ambiguity.
 */
export async function readTrainerStudentAccessFacts(actor: string, target: string | TrainerStudentTarget): Promise<unknown> {
  if (!dbEnabled()) throw new Error("managed_access_unavailable");
  const exact = typeof target === "string" ? null : target;
  const targetEmail = (typeof target === "string" ? target : target.email).toLowerCase();
  const studentWhere = exact
    ? "lower(email) = $2 and spreadsheet_id = $3 and cohort = $4 and course_start_iso = $5"
    : "lower(email) = $2";
  const result = await getDbPool().query(`select
    (select coalesce(jsonb_agg(q), '[]'::jsonb) from
      (select email, status from public.trainer_qualifications where email = $1) q) as qualifications,
    (select coalesce(jsonb_agg(s), '[]'::jsonb) from
      (select grade, grants, version from public.trainer_access_settings where email = $1) s) as settings,
    (select coalesce(jsonb_agg(u), '[]'::jsonb) from
      (select email, role, status, cohort, cohort_label, spreadsheet_id, course_start_iso from public.users where ${studentWhere}) u) as students,
    (select coalesce(jsonb_agg(c), '[]'::jsonb) from
      (select label, status, type from public.cohorts) c) as cohorts`, exact
    ? [actor, targetEmail, exact.spreadsheetId, exact.cohort, exact.courseStart]
    : [actor, targetEmail]);
  if (result.rows.length !== 1) throw new Error("managed_access_unavailable");
  return result.rows[0];
}
