/** Layer: repo — 비서 사서함 하루요약 (migration 0013). */
import { randomUUID } from "node:crypto";
import { dbEnabled, getDbPool } from "./client";
import type { DailyReport, InboxReport, ReportSection, ReportSlot } from "@/types/push-report";

function pool() {
  if (!dbEnabled()) throw new Error("push_db_unavailable");
  return getDbPool();
}
const key = (email: string) => email.trim().toLowerCase();

export interface StoredReportRef { id: string; headline: string; itemCount: number }

/** Saves the (email, slot, date) report once. Null = an earlier run already saved it. */
export async function saveReport(email: string, r: DailyReport, itemCount: number): Promise<string | null> {
  const res = await pool().query<{ id: string }>(
    `insert into public.push_reports (id, email, slot, local_date, sent_at, headline, sections, item_count)
     values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict (email, slot, local_date) do nothing returning id::text`,
    [randomUUID(), key(email), r.slot, r.localDate, r.sentAt, r.headline, JSON.stringify(r.sections), itemCount]);
  return res.rows[0]?.id ?? null;
}

export async function findReport(email: string, slot: ReportSlot, localDate: string): Promise<StoredReportRef | null> {
  const r = await pool().query<{ id: string; headline: string; item_count: number }>(
    `select id::text, headline, item_count from public.push_reports where email=$1 and slot=$2 and local_date=$3`, [key(email), slot, localDate]);
  return r.rows[0] ? { id: r.rows[0].id, headline: r.rows[0].headline, itemCount: r.rows[0].item_count } : null;
}

/** `${email}:${slot}` for every report already made on this date. */
export async function reportsMadeOn(localDate: string): Promise<Set<string>> {
  const r = await pool().query<{ email: string; slot: string }>(`select email, slot from public.push_reports where local_date=$1`, [localDate]);
  return new Set(r.rows.map(x => `${x.email}:${x.slot}`));
}

type Row = { id: string; slot: ReportSlot; local_date: string; sent_at: string; headline: string; read_at: Date | null; sections: ReportSection[] };
const toReport = (x: Row): InboxReport => ({
  id: x.id, slot: x.slot, localDate: x.local_date, sentAt: x.sent_at, headline: x.headline, readAt: x.read_at?.toISOString() ?? null,
  sections: x.sections, counts: x.sections.map(s => ({ key: s.key, title: s.title, n: s.items.length })),
});

/** Newest first, only reports with something in them, from `sinceDate` on. */
export async function listReports(email: string, sinceDate: string): Promise<InboxReport[]> {
  const r = await pool().query<Row>(
    `select id::text, slot, local_date::text, sent_at, headline, read_at, sections from public.push_reports
     where email=$1 and local_date>=$2 and item_count>0 order by local_date desc, sent_at desc`, [key(email), sinceDate]);
  return r.rows.map(toReport);
}

export async function getReport(email: string, id: string): Promise<InboxReport | null> {
  const r = await pool().query<Row>(
    `select id::text, slot, local_date::text, sent_at, headline, read_at, sections from public.push_reports where id::text=$1 and email=$2`,
    [id, key(email)]);
  return r.rows[0] ? toReport(r.rows[0]) : null;
}

/** First open wins; only the owner can mark it. */
export async function markReportRead(email: string, id: string): Promise<void> {
  await pool().query(`update public.push_reports set read_at=now() where id::text=$1 and email=$2 and read_at is null`, [id, key(email)]);
}

export async function deleteReportsBefore(localDate: string): Promise<number> {
  const r = await pool().query(`delete from public.push_reports where local_date<$1`, [localDate]);
  return r.rowCount ?? 0;
}
