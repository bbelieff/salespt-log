/** Layer: repo — the only place that talks to browser push services (web-push + VAPID, plan §5). */
import webpush from "web-push";
import type { StoredSubscription } from "./db/push";

export interface PushPayload { title: string; body: string; url: string; d: string | null }
export type SendOutcome = { ok: true } | { ok: false; gone: boolean; status: number | null; fatal: boolean };

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY?.trim(), priv = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  if (!pub || !priv || !subject) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null;
}

export function pushConfigured(): boolean {
  return configure();
}

/**
 * Sends one encrypted payload. TTL keeps a stale morning reminder from arriving at night;
 * Topic lets a newer queued message replace an older one for the same slot.
 */
export async function sendPush(sub: StoredSubscription, payload: PushPayload, opts: { ttlSeconds: number; topic: string }): Promise<SendOutcome> {
  if (!configure()) return { ok: false, gone: false, status: null, fatal: true };
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: opts.ttlSeconds, urgency: "normal", topic: opts.topic, contentEncoding: "aes128gcm" },
    );
    return { ok: true };
  } catch (error) {
    const status = typeof (error as { statusCode?: unknown }).statusCode === "number" ? (error as { statusCode: number }).statusCode : null;
    return { ok: false, gone: status === 404 || status === 410, status, fatal: status === 401 || status === 403 };
  }
}
