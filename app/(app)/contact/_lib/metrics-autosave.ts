/**
 * Contact metrics autosave — pure helpers.
 *
 * The numeric payload is channels-only by construction: it can never carry
 * meeting drafts or trigger meeting side effects (no slot creation here, no
 * saveAllDirty call — the page wires metrics through useAutosave alone).
 */
import type { Channel } from "@/types";
import type { ChannelDailyRowMetrics } from "@/service";

export const METRIC_KEYS = [
  "production",
  "inflow",
  "contactProgress",
  "meetingReservation",
] as const;

/** Channels-only snapshot for POST /api/daily/:date — no meeting data, ever. */
export function metricsSavePayload(
  draft: Record<Channel, ChannelDailyRowMetrics>,
): Record<Channel, ChannelDailyRowMetrics> {
  return {
    매입DB: { ...draft.매입DB },
    직접생산: { ...draft.직접생산 },
    현수막: { ...draft.현수막 },
    "콜·지·기·소": { ...draft["콜·지·기·소"] },
  };
}

/** True when every channel entry holds only the four numeric metric keys. */
export function isMetricsOnlyPayload(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const channels = ["매입DB", "직접생산", "현수막", "콜·지·기·소"];
  const rec = value as Record<string, unknown>;
  for (const ch of channels) {
    const row = rec[ch];
    if (typeof row !== "object" || row === null) return false;
    const keys = Object.keys(row).sort();
    if (JSON.stringify(keys) !== JSON.stringify([...METRIC_KEYS].sort())) return false;
    for (const k of keys) {
      if (typeof (row as Record<string, unknown>)[k] !== "number") return false;
    }
  }
  return true;
}

/**
 * 시트 일관성 경고(H vs 실제 카드 수) — 저장된 스냅샷에만 적용, 드래프트와 무관.
 * ADR-0010: H는 카드 수로 다시 센다.
 */
export function channelConsistencyWarnings(server: {
  channels: Record<Channel, ChannelDailyRowMetrics>;
  meetings: Array<{ channel: Channel }>;
}): string[] {
  const bad: string[] = [];
  for (const ch of (["매입DB", "직접생산", "현수막", "콜·지·기·소"] as Channel[])) {
    const h = server.channels[ch].meetingReservation;
    const cnt = server.meetings.filter((m) => m.channel === ch).length;
    if (h > cnt) bad.push(`${ch}: 미팅예약 ${h} vs 미팅 ${cnt}건`);
  }
  return bad;
}

/** Same-day check for the per-draft inline warning (record date vs meeting date). */
export function isSameDayMeeting(reservationDate: string, meetingDate: string): boolean {
  return !!meetingDate && reservationDate === meetingDate;
}

/**
 * Idempotent-register guard — retrying a draft whose tempId already exists on
 * the server must treat it as success, never append a duplicate row.
 */
export function shouldSkipRegister(tempId: string, existingIds: Set<string>): boolean {
  return existingIds.has(tempId);
}
