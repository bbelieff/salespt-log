/**
 * Layer: service — web push pilot (docs/plans/active/web-push-notifications.md).
 *
 * The notification says exactly what the dashboard 「오늘 챙길 일」 card says: both run
 * `summarizeFollowUps` over the same four loaders. Who may subscribe is `isPushEligible`
 * (PUSH_AUDIENCE=all → every trainee, else PUSH_PILOT_EMAILS), and PUSH_ENABLED=0 stops every send.
 */
import * as Sentry from "@sentry/nextjs";
import { summarizeFollowUps, UPCOMING_DAYS, type FollowUpSummary } from "@/lib/analytics/dashboard-follow-ups";
import * as store from "@/repo/db/push";
import { findUserByEmail } from "@/repo/users";
import { pushConfigured, sendPush, vapidPublicKey } from "@/repo/push-sender";
import { PushPreferences, type PushDevice, type PushSlot, type PushSubscriptionInput } from "@/types/push";
import { loadContractPayments } from "./contract-payment";
import { listAllTodos } from "./todos";
import { loadFollowUpMeetings } from "./meeting-follow-ups";
import { loadDbSheet, resolveDbSheetContext } from "./db-sheet";
import { buildMeetingResultMessage, buildPushMessage, dueMeetingResults, withDeliveryTag } from "./push-messages";
import { buildSeedMessage, type SeedSources } from "./push-seed";
import { addDaysISO, dueSlots, kstNow, nextNotification, onWeekday, WEEKDAY_LABELS, type KstNow } from "./push-schedule";

const TTL_SECONDS: Record<store.DeliverySlot, number> = { morning: 4 * 3600, evening: 3 * 3600, test: 600, meeting: 3 * 3600 };
export const TEST_PUSH_DAILY_LIMIT = 3;

export function pilotEmails(): string[] {
  return (process.env.PUSH_PILOT_EMAILS ?? "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
}
export function isPushPilot(email: string): boolean {
  return pilotEmails().includes(email.trim().toLowerCase());
}
/**
 * PUSH_AUDIENCE=all opens push to every registered trainee, active or graduated (belie 2026-10-24,
 * 전 수강생 배포). Anything else keeps it to PUSH_PILOT_EMAILS — the rollback switch.
 */
export function pushAudience(): "all" | "pilot" {
  return process.env.PUSH_AUDIENCE?.trim() === "all" ? "all" : "pilot";
}
export async function isPushEligible(email: string): Promise<boolean> {
  if (isPushPilot(email)) return true;
  if (pushAudience() !== "all") return false;
  const user = await findUserByEmail(email);
  return !!user && user.role === "trainee" && user.status !== "pending";
}
function sendingOn(): boolean {
  return process.env.PUSH_ENABLED !== "0" && pushConfigured();
}

export class PushNotAvailable extends Error {}
async function requireEligible(email: string) {
  if (!(await isPushEligible(email))) throw new PushNotAvailable("push_not_available");
}

/**
 * viewingOther = an admin or trainer is looking at someone else's screen. Push always belongs to
 * the signed-in person, so the screens hide their push prompts in that case (2026-10-22 belie).
 */
export interface PushState { available: boolean; publicKey: string | null; preferences: PushPreferences | null; devices: PushDevice[]; viewingOther: boolean }
export async function getPushState(email: string, viewingOther = false): Promise<PushState> {
  if (!(await isPushEligible(email))) return { available: false, publicKey: null, preferences: null, devices: [], viewingOther };
  const [preferences, devices] = await Promise.all([store.getPreferences(email), store.listDevices(email)]);
  return { available: true, publicKey: vapidPublicKey(), preferences, devices, viewingOther };
}

export async function savePushPreferences(email: string, input: unknown): Promise<PushPreferences> {
  await requireEligible(email);
  const prefs = PushPreferences.parse(input);
  await store.savePreferences(email, prefs);
  return prefs;
}

export async function subscribePush(email: string, input: PushSubscriptionInput): Promise<string> {
  await requireEligible(email);
  return store.upsertSubscription(email, input);
}

export async function unsubscribePush(email: string, ref: { id?: string; endpoint?: string }): Promise<boolean> {
  return store.disableSubscription(email, ref);
}

export async function markPushOpened(email: string, deliveryId: string): Promise<boolean> {
  return /^[0-9a-f-]{36}$/i.test(deliveryId) ? store.markOpened(deliveryId, email) : false;
}

/** Same sources and failure handling as components/dashboard/DashboardFollowUps.tsx. */
export async function loadFollowUpSummary(email: string, today: string): Promise<FollowUpSummary> {
  return (await loadFollowUpSources(email, today)).summary;
}

/** The four dashboard sources plus their summary; the seed reuses the same reads. */
export async function loadFollowUpSources(email: string, today: string, nowHHMM?: string): Promise<{ summary: FollowUpSummary; seed: SeedSources }> {
  const [contracts, todos, meetings, leads] = await Promise.allSettled([
    loadContractPayments(email),
    listAllTodos(email),
    loadFollowUpMeetings(email, addDaysISO(today, UPCOMING_DAYS)),
    resolveDbSheetContext(email).then(loadDbSheet),
  ]);
  const work = contracts.status === "fulfilled" && todos.status === "fulfilled";
  if (!work && meetings.status === "rejected" && leads.status === "rejected") throw new Error("follow_up_sources_failed");
  const src = {
    contracts: work ? contracts.value : undefined,
    todos: work ? todos.value : undefined,
    meetings: meetings.status === "fulfilled" ? meetings.value : undefined,
    leads: leads.status === "fulfilled" ? leads.value : undefined,
  };
  return { summary: summarizeFollowUps(src, today, nowHHMM), seed: { leads: src.leads, contracts: src.contracts, todos: src.todos } };
}

interface Fanout { sent: number; failed: number; fatal: boolean }
async function fanout(email: string, payload: { title: string; body: string; url: string; d: string }, slot: store.DeliverySlot): Promise<Fanout> {
  const subs = await store.listActiveSubscriptions(email);
  const out: Fanout = { sent: 0, failed: 0, fatal: false };
  for (const sub of subs) {
    const r = await sendPush(sub, payload, { ttlSeconds: TTL_SECONDS[slot], topic: slot });
    await store.recordSendResult(sub.id, r.ok, !r.ok && r.gone);
    if (r.ok) out.sent++; else { out.failed++; if (r.fatal) out.fatal = true; }
  }
  return out;
}

export type TestPushResult = { ok: true; devices: number } | { ok: false; reason: "limit" | "no_device" | "not_configured" | "send_failed" };
export async function sendTestPush(email: string, now = new Date()): Promise<TestPushResult> {
  await requireEligible(email);
  if (!sendingOn()) return { ok: false, reason: "not_configured" };
  const kst = kstNow(now);
  const used = await store.countDeliveries(email, kst.date, "test");
  if (used >= TEST_PUSH_DAILY_LIMIT) return { ok: false, reason: "limit" };
  if (!(await store.listActiveSubscriptions(email)).length) return { ok: false, reason: "no_device" };
  const id = await store.claimDelivery(`${email.toLowerCase()}:${kst.date}:test:${used + 1}`, email, "test", kst.date);
  if (!id) return { ok: false, reason: "limit" };
  const prefs = await store.getPreferences(email);
  const next = nextNotification(prefs, kst);
  const when = next ? `${next.daysAhead === 0 ? "오늘" : next.daysAhead === 1 ? "내일" : `${WEEKDAY_LABELS[next.weekday - 1]}요일`} ${next.time}` : null;
  const body = when ? `알림이 잘 와요. 다음 알림은 ${when}에 보내 드릴게요.` : "알림이 잘 와요. 지금은 받을 알림이 모두 꺼져 있어요.";
  const r = await fanout(email, { title: "경영일지", body, url: withDeliveryTag("/settings/notifications", id), d: id }, "test");
  await store.finishDelivery(id, { status: r.sent ? "sent" : "failed", messageId: "test.v1", itemCount: 0, devicesSent: r.sent, devicesFailed: r.failed });
  return r.sent ? { ok: true, devices: r.sent } : { ok: false, reason: "send_failed" };
}

export interface DispatchStats { tick: string; candidates: number; sent: number; skippedZero: number; failed: number; duplicate: number }
/** Called by the VPS cron every 15 minutes (plan §5). Safe to run twice: each send is claimed once. */
export async function dispatchDuePush(now = new Date()): Promise<DispatchStats> {
  const kst = kstNow(now);
  const stats: DispatchStats = { tick: `${kst.date} ${kst.time}`, candidates: 0, sent: 0, skippedZero: 0, failed: 0, duplicate: 0 };
  if (!sendingOn()) return stats;
  const candidates = await store.listCandidates(pushAudience() === "all" ? null : pilotEmails());
  for (const { email, prefs } of candidates) {
    for (const slot of dueSlots(prefs, kst)) {
      stats.candidates++;
      const id = await store.claimDelivery(`${email}:${kst.date}:${slot}`, email, slot, kst.date);
      if (!id) { stats.duplicate++; continue; }
      try {
        const { summary, seed } = await loadFollowUpSources(email, kst.date, kst.time);
        const recent = await store.recentMessageIds(email);
        // 「오늘의 씨앗」: only on a morning with nothing to follow up, and only if the person keeps it on.
        const msg = buildPushMessage(slot, summary, prefs, kst.date, recent)
          ?? (slot === "morning" && prefs.kinds.includes("seed") ? buildSeedMessage(seed, prefs.showCompanyNames, kst.date, recent) : null);
        if (!msg) {
          await store.finishDelivery(id, { status: "skipped_zero", messageId: "", itemCount: 0, devicesSent: 0, devicesFailed: 0 });
          stats.skippedZero++;
          continue;
        }
        const r = await fanout(email, { title: "경영일지", body: msg.body, url: withDeliveryTag(msg.url, id), d: id }, slot);
        await store.finishDelivery(id, { status: r.sent ? "sent" : "failed", messageId: msg.messageId, itemCount: msg.itemCount, devicesSent: r.sent, devicesFailed: r.failed });
        if (r.sent) stats.sent++; else stats.failed++;
        if (r.fatal) {
          // 401/403 = our VAPID setup is wrong; every further send would fail the same way.
          Sentry.captureMessage("push_vapid_rejected", { level: "error", tags: { where: "push-dispatch" } });
          return stats;
        }
      } catch (error) {
        stats.failed++;
        await store.finishDelivery(id, { status: "failed", messageId: "", itemCount: 0, devicesSent: 0, devicesFailed: 0 }).catch(() => {});
        Sentry.captureException(error, { tags: { where: "push-dispatch", slot } });
      }
    }
    if (await dispatchMeetingResult(email, prefs, kst, stats) === "fatal") return stats;
  }
  return stats;
}

/**
 * 미팅 시작 3시간 뒤 결과 알림(belie 2026-10-25) — 정기 아침·저녁과 별개로, 미팅마다 한 번.
 * 알림을 켜 두고 「미팅」 내용과 그 요일을 받는 사람만. 한 번에 한 건만 보내고 나머지는 다음 15분에.
 */
async function dispatchMeetingResult(email: string, prefs: PushPreferences, kst: KstNow, stats: DispatchStats): Promise<"ok" | "fatal"> {
  if (!prefs.enabled || !prefs.kinds.includes("meeting") || !onWeekday(prefs, kst.weekday)) return "ok";
  try {
    const due = dueMeetingResults(await loadFollowUpMeetings(email, kst.date), kst.date, kst.time);
    for (const m of due) {
      const id = await store.claimDelivery(`${email}:${kst.date}:meeting:${m.id}`, email, "meeting", kst.date);
      if (!id) continue;
      stats.candidates++;
      const msg = buildMeetingResultMessage(m, prefs.showCompanyNames);
      const r = await fanout(email, { title: "경영일지", body: msg.body, url: withDeliveryTag(msg.url, id), d: id }, "meeting");
      await store.finishDelivery(id, { status: r.sent ? "sent" : "failed", messageId: msg.messageId, itemCount: 1, devicesSent: r.sent, devicesFailed: r.failed });
      if (r.sent) stats.sent++; else stats.failed++;
      if (r.fatal) { Sentry.captureMessage("push_vapid_rejected", { level: "error", tags: { where: "push-meeting-result" } }); return "fatal"; }
      break;
    }
  } catch (error) {
    // 운영 DB 에 0011 이 아직 없으면 claim 이 제약에 걸린다 — 정기 알림은 그대로 두고 이 알림만 쉰다.
    Sentry.captureException(error, { tags: { where: "push-meeting-result" } });
  }
  return "ok";
}
