/** Trainer qualification SSOT; never mutate users or student CRM keys. */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { dbEnabled, getDbPool } from "./client";
import type { TrainerQualification } from "../trainer-qualification";
const normalized = (email: string) => email.trim().toLowerCase();
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
function pool() {
  if (!dbEnabled()) throw new Error("recruitment_unavailable");
  return getDbPool();
}
/** Every qualification/invitation mutation for a recipient takes the same lock first. */
async function transaction<T>(email: string, work: (client: PoolClient, key: string) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  const key = normalized(email);
  try {
    await client.query("begin");
    await client.query("set local lock_timeout='5s'");
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,956))", [key]);
    const result = await work(client, key);
    await client.query("commit");
    return result;
  } catch (error) { await client.query("rollback"); throw error; }
  finally { client.release(); }
}
export async function listTrainerQualifications(email?: string): Promise<TrainerQualification[]> {
  if (!dbEnabled()) return [];
  const { rows } = await pool().query<TrainerQualification>(
    "select email,name,status,department from public.trainer_qualifications" + (email ? " where email=$1" : ""),
    email ? [normalized(email)] : [],
  );
  return rows;
}
async function importLegacy(client: PoolClient, key: string, actor: string) {
  await client.query(`insert into public.trainer_qualifications(email,name,status,department,updated_by)
    select lower(email),name,status,case when cohort='관리' then '관리' else 'T' end,$2
    from public.users where lower(email)=$1 and role='trainer' and status in ('active','pending')
    order by (status='active') desc limit 1 on conflict (email) do nothing`, [key, actor]);
}
export async function applyForTrainer(email: string, name: string): Promise<TrainerQualification> {
  return transaction(email, async (client, key) => {
    await importLegacy(client,key,key);
    const { rows } = await client.query<TrainerQualification>(`insert into public.trainer_qualifications(email,name,status,updated_by)
      values($1,$2,'pending',$1) on conflict(email) do update set
      status=case when trainer_qualifications.status='active' then 'active' else 'pending' end,
      name=excluded.name,updated_by=$1,updated_at=now() returning email,name,status,department`,[key,name.trim()]);
    return rows[0]!;
  });
}
export async function changeTrainerQualification(email: string, action: "approve" | "reject" | "remove" | "cancel", actor: string): Promise<void> {
  return transaction(email, async (client,key) => {
    await importLegacy(client,key,actor);
    const status = {approve:"active",reject:"rejected",remove:"revoked",cancel:"cancelled"}[action];
    const result = await client.query(`update public.trainer_qualifications set status=$2,updated_by=$3,updated_at=now()
      where email=$1 and ($4='remove' or status='pending' or ($4='approve' and status='active') or ($4='cancel' and status='cancelled')) returning email`,[key,status,actor,action]);
    if (!result.rows.length) throw new Error("invalid_transition");
    if (action === "reject" || action === "remove") await client.query(`update public.trainer_invitations set revoked_at=now(),revoked_by=$2
      where recipient_email=$1 and accepted_at is null and revoked_at is null`,[key,actor]);
  });
}
export async function setQualificationDepartment(email: string, department: "T" | "관리", actor: string) {
  return transaction(email, async (client,key) => {
    await importLegacy(client,key,actor);
    const result = await client.query("update public.trainer_qualifications set department=$2,updated_by=$3,updated_at=now() where email=$1 and status='active' returning email",[key,department,actor]);
    if (!result.rows.length) throw new Error("invalid_transition");
  });
}
export async function createTrainerInvite(actor: string, recipient: string) {
  return transaction(recipient, async (client,key) => {
    const token = randomBytes(32).toString("base64url");
    const id = randomUUID();
    const { rows } = await client.query<{expires_at:Date}>(`insert into public.trainer_invitations
      (id,token_hash,recipient_email,created_by,expires_at) values($1,$2,$3,$4,now()+interval '7 days') returning expires_at`,[id,digest(token),key,normalized(actor)]);
    return {id,token,expiresAt:rows[0]!.expires_at};
  });
}
export async function revokeTrainerInvite(id: string, actor: string) {
  const lookup = await pool().query<{recipient_email:string}>("select recipient_email from public.trainer_invitations where id=$1",[id]);
  if (!lookup.rows.length) throw new Error("invalid_invitation");
  return transaction(lookup.rows[0]!.recipient_email, async (client) => {
    const result = await client.query(`update public.trainer_invitations set revoked_at=coalesce(revoked_at,now()),revoked_by=coalesce(revoked_by,$2)
      where id=$1 and accepted_at is null returning id`,[id,normalized(actor)]);
    if (!result.rows.length) throw new Error("invalid_invitation");
  });
}
export async function listTrainerInvites() {
  const { rows } = await pool().query(`select id,recipient_email,created_at,expires_at,accepted_at,revoked_at
    from public.trainer_invitations order by created_at desc limit 100`);
  return rows;
}
export async function acceptTrainerInvite(token: string, email: string, name: string): Promise<TrainerQualification> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("invalid_invitation");
  return transaction(email, async (client,key) => {
    const found = await client.query<{accepted_at:Date|null}>(`select accepted_at from public.trainer_invitations
      where token_hash=$1 and recipient_email=$2 and revoked_at is null and (accepted_at is not null or expires_at>now()) for update`,[digest(token),key]);
    if (!found.rows.length) throw new Error("invalid_invitation");
    if (found.rows[0]!.accepted_at) {
      const existing = await client.query<TrainerQualification>("select email,name,status,department from public.trainer_qualifications where email=$1 and status='active'",[key]);
      if (!existing.rows.length) throw new Error("invalid_invitation");
      return existing.rows[0]!; // Retry is idempotent, but never resurrect a revoked qualification.
    }
    await client.query("update public.trainer_invitations set accepted_at=now(),accepted_by=$2 where token_hash=$1",[digest(token),key]);
    const { rows } = await client.query<TrainerQualification>(`insert into public.trainer_qualifications(email,name,status,updated_by)
      values($1,$2,'active',$1) on conflict(email) do update set status='active',name=excluded.name,updated_by=$1,updated_at=now()
      returning email,name,status,department`,[key,name.trim()]);
    return rows[0]!;
  });
}

/** Caller must verify ADMIN_EMAILS. Persists display department, never changes admin authority. */
export async function setAdminQualificationDepartment(email: string, name: string, department: "T" | "관리", actor: string) {
  return transaction(email, async (client,key) => {
    await client.query(`insert into public.trainer_qualifications(email,name,status,department,updated_by)
      values($1,$2,'active',$3,$4) on conflict(email) do update set status='active',department=$3,updated_by=$4,updated_at=now()`,[key,name,department,actor]);
  });
}
