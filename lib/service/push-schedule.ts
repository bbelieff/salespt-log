/** Pure push timing rules (plan §3-2·§3-5). Safe for client import: no I/O. */
import type { PushPreferences } from "@/types/push";

export type DispatchSlot = "morning" | "evening";
export interface KstNow { date: string; /** Monday = 1 … Sunday = 7 */ weekday: number; time: string }

const WEEKDAY: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
export const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

/** Wall clock in Asia/Seoul, minutes floored to the 15-minute cron grid. */
export function kstNow(now: Date): KstNow {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now).map(p => [p.type, p.value]));
  const minute = Math.floor(Number(parts.minute) / 15) * 15;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, weekday: WEEKDAY[parts.weekday!]!, time: `${parts.hour}:${String(minute).padStart(2, "0")}` };
}

export const weekdayBit = (weekday: number) => 1 << (weekday - 1);
export const onWeekday = (prefs: Pick<PushPreferences, "weekdays">, weekday: number) => (prefs.weekdays & weekdayBit(weekday)) !== 0;

/** Slots due exactly at this 15-minute tick. Quiet hours are enforced by the allowed time ranges. */
export function dueSlots(prefs: PushPreferences, now: KstNow): DispatchSlot[] {
  if (!prefs.enabled || !onWeekday(prefs, now.weekday)) return [];
  const out: DispatchSlot[] = [];
  if (prefs.morningEnabled && prefs.morningTime === now.time) out.push("morning");
  if (prefs.eveningEnabled && prefs.eveningTime === now.time) out.push("evening");
  return out;
}

/** Next scheduled notification for the settings preview, or null when nothing is on. */
export function nextNotification(prefs: PushPreferences, now: KstNow): { slot: DispatchSlot; daysAhead: number; weekday: number; time: string } | null {
  if (!prefs.enabled) return null;
  const slots = ([["morning", prefs.morningEnabled, prefs.morningTime], ["evening", prefs.eveningEnabled, prefs.eveningTime]] as const)
    .filter(([, on]) => on).map(([slot, , time]) => ({ slot, time })).sort((a, b) => a.time.localeCompare(b.time));
  if (!slots.length) return null;
  for (let daysAhead = 0; daysAhead < 8; daysAhead++) {
    const weekday = ((now.weekday - 1 + daysAhead) % 7) + 1;
    if (!onWeekday(prefs, weekday)) continue;
    const hit = slots.find(s => daysAhead > 0 || s.time > now.time);
    if (hit) return { slot: hit.slot, daysAhead, weekday, time: hit.time };
  }
  return null;
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
