/** 일정 보드 메모·주간 이슈 — 수강생(이메일 소문자) × 키 한 줄. 표가 없거나 DB 가 꺼져 있으면 throw(API 가 503). */
import { dbEnabled, getDbPool } from "./client";

function pool() {
  if (!dbEnabled()) throw new Error("schedule_notes_unavailable");
  return getDbPool();
}
const who = (email: string) => email.trim().toLowerCase();

export async function readScheduleNotes(email: string, keys: string[]): Promise<{ note_key: string; body: unknown }[]> {
  const r = await pool().query<{ note_key: string; body: unknown }>(
    "select note_key, body from public.schedule_notes where email=$1 and note_key = any($2::text[])",
    [who(email), keys],
  );
  return r.rows;
}

export async function writeScheduleNote(email: string, key: string, body: unknown): Promise<void> {
  await pool().query(
    `insert into public.schedule_notes (email, note_key, body) values ($1,$2,$3::jsonb)
     on conflict (email, note_key) do update set body=excluded.body, updated_at=now()`,
    [who(email), key, JSON.stringify(body)],
  );
}
