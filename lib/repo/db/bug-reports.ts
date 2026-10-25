/**
 * Layer: repo — 오류신고 저장(2026-10-25). 운영 DB 에만 둔다(공개 저장소·외부 이슈로 보내지 않음).
 * 표는 처음 쓸 때 만든다(create if not exists, expense-ledger 와 같은 방식) — 배포 때 손으로 돌릴 마이그레이션이 없다.
 */
import { randomUUID } from "node:crypto";
import { dbEnabled, getDbPool } from "./client";
import type { BugReportContext } from "@/types/bug-report";

let ready: Promise<void> | null = null;
function pool() {
  if (!dbEnabled()) throw new Error("bug_report_db_unavailable");
  return getDbPool();
}
async function ensureTable(): Promise<void> {
  if (!ready) {
    ready = pool().query(`
      create table if not exists public.bug_reports (
        id uuid primary key,
        created_at timestamptz not null default now(),
        email text not null,
        name text not null default '',
        cohort text not null default '',
        category text not null,
        body text not null default '',
        image text not null default '',
        context jsonb not null default '{}'::jsonb,
        status text not null default 'new'
      );
      create index if not exists bug_reports_created_at on public.bug_reports (created_at desc);
      create index if not exists bug_reports_email_created on public.bug_reports (email, created_at desc);
    `).then(() => undefined).catch(error => { ready = null; throw error; });
  }
  return ready;
}

export interface NewBugReport { email: string; name: string; cohort: string; category: string; body: string; image: string; context: BugReportContext }

export async function insertBugReport(r: NewBugReport): Promise<string> {
  await ensureTable();
  const id = randomUUID();
  await pool().query(
    `insert into public.bug_reports (id, email, name, cohort, category, body, image, context) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, r.email.trim().toLowerCase(), r.name, r.cohort, r.category, r.body, r.image, JSON.stringify(r.context)]);
  return id;
}

/** 같은 사람이 최근 24시간 안에 보낸 건수 — 실수로 여러 번 누르는 것·남용 막기. */
export async function countRecentBugReports(email: string): Promise<number> {
  await ensureTable();
  const r = await pool().query<{ n: string }>(
    `select count(*)::text as n from public.bug_reports where email=$1 and created_at > now() - interval '24 hours'`,
    [email.trim().toLowerCase()]);
  return Number(r.rows[0]?.n ?? 0);
}
