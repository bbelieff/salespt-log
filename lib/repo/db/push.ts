/** Layer: repo — web push subscriptions, preferences and delivery log (migration 0009). */
import { randomUUID } from "node:crypto";
import { dbEnabled, getDbPool } from "./client";
import { DEFAULT_PUSH_PREFERENCES } from "@/types/push";
import type { PushContentKind, PushDevice, PushPlatform, PushPreferences, PushSlot, PushSubscriptionInput, ReminderKind } from "@/types/push";

function pool() {
  if (!dbEnabled()) throw new Error("push_db_unavailable");
  return getDbPool();
}
const key = (email: string) => email.trim().toLowerCase();

export interface StoredSubscription { id: string; endpoint: string; p256dh: string; auth: string }

export async function upsertSubscription(email: string, input: PushSubscriptionInput): Promise<string> {
  const r = await pool().query<{ id: string }>(
    `insert into public.push_subscriptions (id, email, endpoint, p256dh, auth, platform, browser)
     values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (endpoint) do update set email=excluded.email, p256dh=excluded.p256dh, auth=excluded.auth,
       platform=excluded.platform, browser=excluded.browser, disabled_at=null, failure_count=0
     returning id`,
    [randomUUID(), key(email), input.endpoint, input.keys.p256dh, input.keys.auth, input.platform, input.browser]);
  return r.rows[0]!.id;
}

/** Disables one device of this user (by id or endpoint). Returns whether a row changed. */
export async function disableSubscription(email: string, ref: { id?: string; endpoint?: string }): Promise<boolean> {
  const r = await pool().query(
    `update public.push_subscriptions set disabled_at=now()
     where email=$1 and disabled_at is null and (id::text=$2 or endpoint=$3)`,
    [key(email), ref.id ?? "", ref.endpoint ?? ""]);
  return (r.rowCount ?? 0) > 0;
}

export async function listActiveSubscriptions(email: string): Promise<StoredSubscription[]> {
  const r = await pool().query<StoredSubscription>(
    `select id::text, endpoint, p256dh, auth from public.push_subscriptions where email=$1 and disabled_at is null`, [key(email)]);
  return r.rows;
}

export async function listDevices(email: string): Promise<PushDevice[]> {
  const r = await pool().query<{ id: string; platform: PushPlatform; browser: string; created_at: Date; last_success_at: Date | null; tail: string }>(
    `select id::text, platform, browser, created_at, last_success_at, right(endpoint, 16) as tail from public.push_subscriptions
     where email=$1 and disabled_at is null order by created_at`, [key(email)]);
  return r.rows.map(x => ({ id: x.id, platform: x.platform, browser: x.browser, createdAt: x.created_at.toISOString(), lastSuccessAt: x.last_success_at?.toISOString() ?? null, endpointTail: x.tail }));
}

/** Success clears failures. A gone endpoint (404/410) or 5 failures in a row disables the device. */
export async function recordSendResult(id: string, ok: boolean, gone: boolean): Promise<void> {
  if (ok) {
    await pool().query(`update public.push_subscriptions set last_success_at=now(), failure_count=0 where id::text=$1`, [id]);
    return;
  }
  await pool().query(
    `update public.push_subscriptions set last_failure_at=now(), failure_count=failure_count+1,
       disabled_at=case when $2 or failure_count+1>=5 then now() else disabled_at end where id::text=$1`, [id, gone]);
}

type PrefRow = {
  enabled: boolean; morning_enabled: boolean; morning_time: string; evening_enabled: boolean; evening_time: string;
  weekdays: number; kinds: string[]; show_company_names: boolean;
  reminders_enabled: boolean; meeting_lead_minutes: number; reminder_kinds: string[];
};
const toPrefs = (r: PrefRow): PushPreferences => ({
  enabled: r.enabled, morningEnabled: r.morning_enabled, morningTime: r.morning_time, eveningEnabled: r.evening_enabled,
  eveningTime: r.evening_time, weekdays: r.weekdays, kinds: r.kinds as PushContentKind[], showCompanyNames: r.show_company_names,
  remindersEnabled: r.reminders_enabled, meetingLeadMinutes: r.meeting_lead_minutes as PushPreferences["meetingLeadMinutes"],
  reminderKinds: r.reminder_kinds as ReminderKind[],
});
const PREF_COLS = "enabled, morning_enabled, morning_time, evening_enabled, evening_time, weekdays, kinds, show_company_names, reminders_enabled, meeting_lead_minutes, reminder_kinds";

export async function getPreferences(email: string): Promise<PushPreferences> {
  const r = await pool().query<PrefRow>(`select ${PREF_COLS} from public.push_preferences where email=$1`, [key(email)]);
  return r.rows[0] ? toPrefs(r.rows[0]) : { ...DEFAULT_PUSH_PREFERENCES, kinds: [...DEFAULT_PUSH_PREFERENCES.kinds] };
}

export async function savePreferences(email: string, p: PushPreferences): Promise<void> {
  await pool().query(
    `insert into public.push_preferences (email, ${PREF_COLS}, updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now())
     on conflict (email) do update set enabled=$2, morning_enabled=$3, morning_time=$4, evening_enabled=$5,
       evening_time=$6, weekdays=$7, kinds=$8, show_company_names=$9, reminders_enabled=$10, meeting_lead_minutes=$11,
       reminder_kinds=$12, updated_at=now()`,
    [key(email), p.enabled, p.morningEnabled, p.morningTime, p.eveningEnabled, p.eveningTime, p.weekdays, p.kinds, p.showCompanyNames,
      p.remindersEnabled, p.meetingLeadMinutes, p.reminderKinds]);
}

export interface PushCandidate { email: string; prefs: PushPreferences }
/** Users with at least one active device (only those in `emails` unless null = everyone), with preferences (defaults when unset). */
export async function listCandidates(emails: string[] | null): Promise<PushCandidate[]> {
  if (emails && !emails.length) return [];
  const r = await pool().query<PrefRow & { email: string; has_prefs: boolean }>(
    `select s.email, p.email is not null as has_prefs, ${PREF_COLS.split(", ").map(c => `p.${c}`).join(", ")}
     from (select distinct email from public.push_subscriptions where disabled_at is null and ($1::text[] is null or email = any($1))) s
     left join public.push_preferences p on p.email = s.email`, [emails ? emails.map(key) : null]);
  return r.rows.map(row => ({ email: row.email, prefs: row.has_prefs ? toPrefs(row) : { ...DEFAULT_PUSH_PREFERENCES, kinds: [...DEFAULT_PUSH_PREFERENCES.kinds] } }));
}

/** 정기 슬롯 + 미팅 끝 결과 알림(0011). */
export type DeliverySlot = PushSlot | "meeting";
/** Claims the (email, date, slot) send once. Null = already claimed by an earlier run. */
export async function claimDelivery(idempotencyKey: string, email: string, slot: DeliverySlot, localDate: string): Promise<string | null> {
  const r = await pool().query<{ id: string }>(
    `insert into public.push_deliveries (id, idempotency_key, email, slot, local_date) values ($1,$2,$3,$4,$5)
     on conflict (idempotency_key) do nothing returning id::text`, [randomUUID(), idempotencyKey, key(email), slot, localDate]);
  return r.rows[0]?.id ?? null;
}

export interface DeliveryResult { status: "sent" | "skipped_zero" | "failed"; messageId: string; itemCount: number; devicesSent: number; devicesFailed: number }
export async function finishDelivery(id: string, d: DeliveryResult): Promise<void> {
  await pool().query(
    `update public.push_deliveries set status=$2, message_id=$3, item_count=$4, devices_sent=$5, devices_failed=$6 where id::text=$1`,
    [id, d.status, d.messageId, d.itemCount, d.devicesSent, d.devicesFailed]);
}

export async function recentMessageIds(email: string, limit = 3): Promise<string[]> {
  const r = await pool().query<{ message_id: string }>(
    `select message_id from public.push_deliveries where email=$1 and status='sent' order by created_at desc limit $2`, [key(email), limit]);
  return r.rows.map(x => x.message_id);
}

export async function countDeliveries(email: string, localDate: string, slot: PushSlot): Promise<number> {
  const r = await pool().query<{ n: string }>(
    `select count(*)::text as n from public.push_deliveries where email=$1 and local_date=$2 and slot=$3`, [key(email), localDate, slot]);
  return Number(r.rows[0]?.n ?? 0);
}

/** First open wins; only the owner of the delivery can mark it. */
export async function markOpened(id: string, email: string): Promise<boolean> {
  const r = await pool().query(
    `update public.push_deliveries set opened_at=now() where id::text=$1 and email=$2 and opened_at is null`, [id, key(email)]);
  return (r.rowCount ?? 0) > 0;
}
