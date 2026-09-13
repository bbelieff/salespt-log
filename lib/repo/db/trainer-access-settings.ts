/** #958 only. Existing #956 qualification rows are read/locked, never mutated. */
import { dbEnabled, getDbPool } from "./client";
import { TrainerAccessCommand, TrainerAccountKey } from "@/types/trainer-access";
import type { TrainerAccessQualification, TrainerAccessSetting } from "@/types/trainer-access";

type DbRow = {
  email: string; name: string; status: string; grade: TrainerAccessSetting["grade"] | null;
  grants: TrainerAccessSetting["grants"] | null; version: number | null;
};
export interface TrainerAccessRow { qualification: TrainerAccessQualification; setting: TrainerAccessSetting | null }
export interface TrainerAccessTransaction {
  qualification: TrainerAccessQualification | null;
  read(): Promise<TrainerAccessSetting | null>;
  save(input: TrainerAccessCommand, actor: string): Promise<boolean>;
}
function pool() {
  if (!dbEnabled()) throw new Error("trainer_access_unavailable");
  return getDbPool();
}
/** No registry fallback or cache: authoritative #956 qualification contract only. */
export async function listTrainerAccessRows(): Promise<TrainerAccessRow[]> {
  const result = await pool().query<DbRow>(`select q.email, q.name, q.status, s.grade, s.grants, s.version
    from public.trainer_qualifications q left join public.trainer_access_settings s on s.email = q.email
    order by q.name, q.email`);
  return result.rows.map(row => ({
    qualification: { email: row.email, name: row.name, status: row.status },
    setting: row.version === null ? null : { grade: row.grade!, grants: row.grants!, version: row.version },
  }));
}
/** SHARE prevents qualification revocation during service validation + commit.
 * Service decides active eligibility. SQL CAS handles concurrent settings inserts/updates.
 */
export async function withTrainerAccessLock<T>(email: string, work: (tx: TrainerAccessTransaction) => Promise<T>): Promise<T> {
  TrainerAccountKey.parse(email);
  const client = await pool().connect();
  try {
    await client.query("begin");
    const q = await client.query<TrainerAccessQualification>(
      "select email, name, status from public.trainer_qualifications where email = $1 for share", [email]);
    const result = await work({
      qualification: q.rows[0] ?? null,
      read: async () => {
        const rows = await client.query<TrainerAccessSetting>(
          "select grade, grants, version from public.trainer_access_settings where email = $1", [email]);
        return rows.rows[0] ?? null;
      },
      save: async (raw, actor) => {
        const input = TrainerAccessCommand.parse(raw);
        TrainerAccountKey.parse(actor);
        if (input.email !== email) throw new Error("trainer_access_key_mismatch");
        const saved = await client.query(`with saved as (
          insert into public.trainer_access_settings (email, grade, grants, version, updated_by)
          select $1, $2, $3::jsonb, 1, $5 where $4::integer = 0
          on conflict (email) do nothing returning *
        ), updated as (
          update public.trainer_access_settings set grade = $2, grants = $3::jsonb,
            version = version + 1, updated_by = $5, updated_at = now()
          where email = $1 and version = $4::integer and $4::integer > 0 returning *
        ), changed as (select * from saved union all select * from updated)
        insert into public.trainer_access_audit (email, version, grade, grants, changed_by, changed_at)
          select email, version, grade, grants, updated_by, updated_at from changed returning version`,
        [email, input.grade, JSON.stringify(input.grants), input.version, actor]);
        return saved.rowCount === 1;
      },
    });
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally { client.release(); }
}
