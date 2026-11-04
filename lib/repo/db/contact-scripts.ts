/** 컨택 대본·문자양식 — 계정(이메일 소문자)마다 한 줄. 줄이 없으면 null(기본 대본은 service 가 채운다). */
import type { ContactScript } from "@/types";
import { dbEnabled, getDbPool } from "./client";

function pool() {
  if (!dbEnabled()) throw new Error("contact_script_unavailable");
  return getDbPool();
}

export async function readContactScript(email: string): Promise<ContactScript | null> {
  const r = await pool().query<ContactScript>("select script, sms from public.contact_scripts where email=$1", [email.trim().toLowerCase()]);
  return r.rows[0] ?? null;
}

export async function writeContactScript(email: string, value: ContactScript): Promise<void> {
  await pool().query(
    `insert into public.contact_scripts (email, script, sms) values ($1,$2,$3)
     on conflict (email) do update set script=excluded.script, sms=excluded.sms, updated_at=now()`,
    [email.trim().toLowerCase(), value.script, value.sms],
  );
}

/** 「기본 대본으로」 — 내 줄을 지워 기본값으로 돌아간다. */
export async function deleteContactScript(email: string): Promise<void> {
  await pool().query("delete from public.contact_scripts where email=$1", [email.trim().toLowerCase()]);
}
