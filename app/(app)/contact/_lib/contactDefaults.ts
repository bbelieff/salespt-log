/** 컨택관리 기본값·헬퍼 (page.tsx 분할 — UI 무관 상수/순수함수). */
import type { Channel } from "@/types";
import type { ChannelDailyRowMetrics } from "@/service";

export const EMPTY_METRICS: ChannelDailyRowMetrics = {
  production: 0,
  inflow: 0,
  contactProgress: 0,
  meetingReservation: 0,
};

export const EMPTY_BY_CHANNEL = (): Record<Channel, ChannelDailyRowMetrics> => ({
  매입DB: { ...EMPTY_METRICS },
  직접생산: { ...EMPTY_METRICS },
  현수막: { ...EMPTY_METRICS },
  "콜·지·기·소": { ...EMPTY_METRICS },
});

export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
