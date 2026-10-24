/**
 * 「안 본 새 배지」 — 이 기기 브라우저에만 기억한다(서버 기록 없음, 새소식 점과 같은 방식).
 * 처음 쓰는 기기는 기억이 없으므로 최근 7일 안에 얻은 배지만 새 배지로 본다(예전 배지가 한꺼번에 NEW 로 뜨지 않게).
 */
import type { BadgeState } from "@/lib/analytics/badges";
import { addDays, fmtISO, parseISO } from "@/util/week";

export const BADGES_SEEN_EVENT = "salespt:badges-seen";
const RECENT_DAYS = 7;
const storageKey = (who: string) => `badgesSeen:v1:${who.trim().toLowerCase()}`;

/** 새 배지 id. seen=null 은 이 기기에서 처음 보는 경우. */
export function newBadgeIds(states: readonly BadgeState[], seen: ReadonlySet<string> | null, today: string): string[] {
  const since = fmtISO(addDays(parseISO(today), -RECENT_DAYS));
  return states
    .filter(s => s.earned && (seen ? !seen.has(s.id) : !!s.earnedOn && s.earnedOn > since))
    .map(s => s.id);
}

export function readSeen(who: string): Set<string> | null {
  if (typeof window === "undefined" || !who) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(who));
    if (raw === null) return null;
    const ids: unknown = JSON.parse(raw);
    return new Set(Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : []);
  } catch { return null; }
}

/** 지금 얻은 배지를 모두 본 것으로 기억하고 헤더 점을 끈다. */
export function markSeen(who: string, states: readonly BadgeState[]): void {
  if (typeof window === "undefined" || !who) return;
  try {
    window.localStorage.setItem(storageKey(who), JSON.stringify(states.filter(s => s.earned).map(s => s.id)));
    window.dispatchEvent(new Event(BADGES_SEEN_EVENT));
  } catch { /* 저장 불가(사생활 보호 모드 등) — 점이 남을 뿐 화면은 정상 */ }
}
