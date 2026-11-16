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

/* ───────── 관리자 조회(admin-phase1, 2026-11-16) — 읽기만. 표를 만들지 않는다(GET 이 DDL 을 하지 않게). ───────── */

/** 목록 한 줄 — 그림(image)은 무거워 싣지 않고 있는지만 알린다. */
export interface BugReportListRow {
  id: string;
  createdAt: string;
  email: string;
  name: string;
  cohort: string;
  category: string;
  body: string;
  hasImage: boolean;
  context: unknown;
  status: string;
}

/** 표가 아직 없으면(신고가 한 번도 없던 DB) 빈 결과로 본다. */
async function readOrEmpty<T>(run: () => Promise<T>, empty: T): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if ((error as { code?: string } | null)?.code === "42P01") return empty;
    throw error;
  }
}

export async function listBugReports(limit: number, offset: number): Promise<BugReportListRow[]> {
  return readOrEmpty(async () => {
    const r = await pool().query<{
      id: string; created_at: Date; email: string; name: string; cohort: string;
      category: string; body: string; has_image: boolean; context: unknown; status: string;
    }>(
      `select id, created_at, email, name, cohort, category, body, (image <> '') as has_image, context, status
         from public.bug_reports order by created_at desc, id desc limit $1 offset $2`,
      [limit, offset]);
    return r.rows.map((x) => ({
      id: x.id, createdAt: new Date(x.created_at).toISOString(), email: x.email, name: x.name, cohort: x.cohort,
      category: x.category, body: x.body, hasImage: !!x.has_image, context: x.context, status: x.status,
    }));
  }, []);
}

export async function countBugReports(): Promise<number> {
  return readOrEmpty(async () => {
    const r = await pool().query<{ n: string }>(`select count(*)::text as n from public.bug_reports`);
    return Number(r.rows[0]?.n ?? 0);
  }, 0);
}

/** 아직 확인 안 한(status=new) 최근 N일 신고 수 — 관리자 홈 「오늘 할 일」. */
export async function countNewBugReports(days: number): Promise<number> {
  return readOrEmpty(async () => {
    const r = await pool().query<{ n: string }>(
      `select count(*)::text as n from public.bug_reports where status='new' and created_at > now() - make_interval(days => $1::int)`,
      [days]);
    return Number(r.rows[0]?.n ?? 0);
  }, 0);
}

/** 한 건의 캡처(data URL). 없으면 빈 문자열, 그런 신고가 없으면 null. */
export async function getBugReportImage(id: string): Promise<string | null> {
  return readOrEmpty(async () => {
    const r = await pool().query<{ image: string }>(`select image from public.bug_reports where id=$1`, [id]);
    return r.rows[0] ? r.rows[0].image : null;
  }, null);
}
