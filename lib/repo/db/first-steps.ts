/** 첫걸음 기억 — 계정(이메일 소문자)마다 한 줄. 표가 없거나 DB 가 꺼져 있으면 throw(호출부가 브라우저 기억으로 대신한다). */
import type { FirstStepsState } from "@/types";
import { dbEnabled, getDbPool } from "./client";

function pool() {
  if (!dbEnabled()) throw new Error("first_steps_unavailable");
  return getDbPool();
}
const key = (email: string) => email.trim().toLowerCase();

export async function readFirstSteps(email: string): Promise<{ memory: unknown; done: string[] } | null> {
  const r = await pool().query<{ memory: unknown; done: string[] }>("select memory, done from public.first_steps where email=$1", [key(email)]);
  return r.rows[0] ?? null;
}

export async function writeFirstSteps(email: string, value: FirstStepsState): Promise<void> {
  await pool().query(
    `insert into public.first_steps (email, memory, done) values ($1,$2::jsonb,$3)
     on conflict (email) do update set memory=excluded.memory, done=excluded.done, updated_at=now()`,
    [key(email), JSON.stringify(value.memory), value.done],
  );
}

export async function listFirstStepsDone(): Promise<{ email: string; done: string[]; hidden: boolean }[]> {
  const r = await pool().query<{ email: string; done: string[]; hidden: boolean }>(
    "select email, done, coalesce((memory->>'hidden')::boolean, false) as hidden from public.first_steps",
  );
  return r.rows;
}
