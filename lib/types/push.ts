/** Web push pilot models (web-push-notifications plan §2-2·§4). */
import { z } from "zod";

export const PUSH_CONTENT_KINDS = ["overdue", "today", "meeting", "initial", "recontact", "stalled"] as const;
export const PushContentKind = z.enum(PUSH_CONTENT_KINDS);
export type PushContentKind = z.infer<typeof PushContentKind>;

const quarter = /^([01]\d|2[0-3]):(00|15|30|45)$/;
export const MorningTime = z.string().regex(quarter).refine(t => t >= "07:00" && t <= "11:00", "07:00~11:00");
export const EveningTime = z.string().regex(quarter).refine(t => t >= "17:00" && t <= "21:00", "17:00~21:00");

export const PushPreferences = z.object({
  enabled: z.boolean(),
  morningEnabled: z.boolean(),
  morningTime: MorningTime,
  eveningEnabled: z.boolean(),
  eveningTime: EveningTime,
  /** Weekday bits, Monday = 1 … Sunday = 64. 31 = weekdays. */
  weekdays: z.number().int().min(1).max(127),
  kinds: z.array(PushContentKind),
  showCompanyNames: z.boolean(),
});
export type PushPreferences = z.infer<typeof PushPreferences>;

export const DEFAULT_PUSH_PREFERENCES: PushPreferences = {
  enabled: true, morningEnabled: true, morningTime: "08:45", eveningEnabled: true, eveningTime: "18:00",
  weekdays: 31, kinds: [...PUSH_CONTENT_KINDS], showCompanyNames: true,
};

export const PushPlatform = z.enum(["android", "ios_pwa", "desktop", "other"]);
export type PushPlatform = z.infer<typeof PushPlatform>;

/** Body of POST /api/push/subscriptions — the browser PushSubscription JSON plus device labels. */
export const PushSubscriptionInput = z.object({
  endpoint: z.string().url().max(2048).refine(u => u.startsWith("https://"), "https only"),
  keys: z.object({ p256dh: z.string().min(1).max(256), auth: z.string().min(1).max(64) }),
  platform: PushPlatform,
  browser: z.string().max(20).default(""),
});
export type PushSubscriptionInput = z.infer<typeof PushSubscriptionInput>;

/** endpointTail = last 16 chars of the endpoint, so a browser can recognise its own row. */
export interface PushDevice { id: string; platform: PushPlatform; browser: string; createdAt: string; lastSuccessAt: string | null; endpointTail: string }
export type PushSlot = "morning" | "evening" | "test";
