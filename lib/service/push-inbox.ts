/**
 * Layer: service — 비서 사서함 (web-push-notifications §16, belie 2026-10-26).
 * Every eligible trainee gets a morning and an evening summary in the inbox at their notification times
 * (defaults when never set), whether or not notifications are on. The push for that slot then points at it.
 */
import type { FollowUpSummary } from "@/lib/analytics/dashboard-follow-ups";
import * as store from "@/repo/db/push-inbox";
import type { Meeting } from "@/types";
import type { PushPreferences } from "@/types/push";
import type { InboxEntry, InboxReport, ReportSlot } from "@/types/push-report";
import { buildDailyReport } from "./push-report";
import { addDaysISO, onWeekday, type KstNow } from "./push-schedule";

export const REPORT_KEEP_DAYS = 90;
/** A missed tick is caught up within this many minutes after the slot time; later, that slot is skipped. */
export const REPORT_WINDOW_MINUTES = 180;

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Slots whose summary should exist by now — the notification on/off switches do not matter here. */
export function reportDueSlots(prefs: PushPreferences, kst: KstNow): ReportSlot[] {
  if (!onWeekday(prefs, kst.weekday)) return [];
  const now = minutes(kst.time);
  return ([["morning", prefs.morningTime], ["evening", prefs.eveningTime]] as const)
    .filter(([, t]) => now >= minutes(t) && now < minutes(t) + REPORT_WINDOW_MINUTES)
    .map(([slot]) => slot);
}

/** Builds and keeps the slot's summary once (an empty one too, so it is not rebuilt every tick). */
export async function saveDailyReport(email: string, slot: ReportSlot, kst: KstNow, summary: Pick<FollowUpSummary, "items" | "urgent">, meetings: Meeting[]): Promise<store.StoredReportRef | null> {
  const report = buildDailyReport(slot, summary, meetings, kst.date, kst.time);
  const itemCount = report.sections.reduce((n, s) => n + s.items.length, 0);
  const id = await store.saveReport(email, report, itemCount);
  return id ? { id, headline: report.headline, itemCount } : store.findReport(email, slot, kst.date);
}

export const findDailyReport = store.findReport;
export const reportsMadeOn = store.reportsMadeOn;
export const purgeOldReports = (today: string) => store.deleteReportsBefore(addDaysISO(today, -REPORT_KEEP_DAYS));

/** 「비서의 아침 요약이 도착했어요. 컨택 3 · …」 → title + counts line, opening that summary. */
export function reportPushMessage(slot: ReportSlot, ref: store.StoredReportRef) {
  const [title, ...rest] = ref.headline.split(". ");
  return { title: title!, body: rest.join(". "), url: `/inbox/${ref.id}`, messageId: `report.${slot}.v1`, itemCount: ref.itemCount };
}

export interface InboxView { available: boolean; viewingOther: boolean; entries: InboxEntry[]; unread: number }

export async function getInbox(email: string, opts: { eligible: boolean; viewingOther: boolean; today: string }): Promise<InboxView> {
  if (!opts.eligible || opts.viewingOther) return { available: false, viewingOther: opts.viewingOther, entries: [], unread: 0 };
  const reports = await store.listReports(email, addDaysISO(opts.today, -REPORT_KEEP_DAYS));
  const entries = reports.map(({ sections: _sections, ...entry }) => entry);
  return { available: true, viewingOther: false, entries, unread: entries.filter(e => !e.readAt).length };
}

/** Opening a summary marks it read — never while looking at someone else's screen. */
export async function openInboxReport(email: string, id: string, viewingOther: boolean): Promise<InboxReport | null> {
  if (viewingOther) return null;
  const report = await store.getReport(email, id);
  if (report && !report.readAt) await store.markReportRead(email, id);
  return report;
}
