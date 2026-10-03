/** Existing qualifications override legacy roster rows; imports happen only on explicit save. */
import { dbEnabled, getDbPool } from "./client";
import { TrainerAccessCommand, TrainerAccountKey } from "@/types/trainer-access";
import type { TrainerAccessQualification, TrainerAccessSetting } from "@/types/trainer-access";

type DbRow = {
  email: string; name: string; status: string; department: string; grade: TrainerAccessSetting["grade"] | null;
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
/** Match the roster: qualification overrides legacy, including revoked/management records. */
export async function listTrainerAccessRows(): Promise<TrainerAccessRow[]> {
  const result = await pool().query<DbRow>(`with legacy as (
    select distinct on (lower(email)) lower(email) as email, name, status,
      case when btrim(cohort)='관리' then '관리' else 'T' end as department
    from public.users u where role='trainer' and status in ('active','pending')
      and not exists (select 1 from public.trainer_qualifications q where q.email=lower(u.email))
    order by lower(email), (status='active') desc, (btrim(cohort)='관리') desc, name
  ), candidates as (
    select email,name,status,department from public.trainer_qualifications
    union all select email,name,status,department from legacy
  ) select q.email, q.name, q.status, q.department, s.grade, s.grants, s.version
    from candidates q left join public.trainer_access_settings s on s.email = q.email
    order by q.name, q.email`);
  return result.rows.map(row => ({
    qualification: { email: row.email, name: row.name, status: row.status, department: row.department },
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
    await client.query("set local lock_timeout='5s'");
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,956))", [email]);
    const q = await client.query<TrainerAccessQualification>(
      "select email, name, status, department from public.trainer_qualifications where email = $1 for share", [email]);
    // Do not create anything during listing. The save transaction can validate a legacy row.
    const legacy = q.rows.length ? null : await client.query<TrainerAccessQualification>(
      `select lower(email) as email,name,status,case when btrim(cohort)='관리' then '관리' else 'T' end as department
       from public.users where lower(email)=$1 and role='trainer' and status in ('active','pending')
       order by (status='active') desc, (btrim(cohort)='관리') desc, name limit 1 for share`, [email]);
    const result = await work({
      qualification: q.rows[0] ?? legacy?.rows[0] ?? null,
      read: async () => {
        const rows = await client.query<TrainerAccessSetting>(
          "select grade, grants, version from public.trainer_access_settings where email = $1", [email]);
        return rows.rows[0] ?? null;
      },
      save: async (raw, actor) => {
        const input = TrainerAccessCommand.parse(raw);
        TrainerAccountKey.parse(actor);
        if (input.email !== email) throw new Error("trainer_access_key_mismatch");
        if (!q.rows.length && legacy?.rows[0]) {
          const l = legacy.rows[0];
          await client.query(`insert into public.trainer_qualifications(email,name,status,department,updated_by)
            values($1,$2,$3,$4,$5) on conflict(email) do nothing`, [email,l.name,l.status,l.department,actor]);
        }
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
