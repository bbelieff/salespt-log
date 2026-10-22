/**
 * React Query + browser glue for web push (plan §2-2). The service worker is registered only
 * for pilot users, and only when one of the push screens is open.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PushDevice, PushPreferences } from "@/types/push";
import { describeDevice, platformLabel, pushReadiness, urlBase64ToBytes, type DeviceInfo, type PushReadiness } from "@/util/push-device";

export interface PushStateView { available: boolean; publicKey: string | null; preferences: PushPreferences | null; devices: PushDevice[] }
const pushKey = ["push"] as const;

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((body as { error?: string }).error ?? `push ${res.status}`), { status: res.status, body });
  return body as T;
}

export function usePushState(enabled = true) {
  return useQuery({
    queryKey: pushKey,
    queryFn: () => fetch("/api/push", { cache: "no-store" }).then(r => json<PushStateView>(r)),
    enabled, staleTime: 5 * 60_000, refetchOnWindowFocus: false, retry: 1,
  });
}

export function useSavePushPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prefs: PushPreferences) => fetch("/api/push", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(prefs) }).then(r => json<{ preferences: PushPreferences }>(r)),
    onSuccess: ({ preferences }) => qc.setQueryData<PushStateView>(pushKey, s => (s ? { ...s, preferences } : s)),
  });
}

export function useRemovePushDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetch("/api/push/subscriptions", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }).then(r => json<{ removed: boolean }>(r)),
    onSettled: () => qc.invalidateQueries({ queryKey: pushKey }),
  });
}

export type TestPushResponse = { ok: true; devices: number } | { ok: false; reason: "limit" | "no_device" | "not_configured" | "send_failed" };
export async function sendTestPush(): Promise<TestPushResponse> {
  const res = await fetch("/api/push/test", { method: "POST" });
  return (await res.json().catch(() => ({ ok: false, reason: "send_failed" }))) as TestPushResponse;
}

/** This browser's readiness, plus a subscribe action that must run inside the button tap (iOS). */
export function useThisDevicePush(state: PushStateView | undefined) {
  const qc = useQueryClient();
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [readiness, setReadiness] = useState<PushReadiness | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [endpoint, setEndpoint] = useState<string | null>(null);

  useEffect(() => {
    if (!state?.available) return;
    let cancelled = false;
    const nav = navigator as Navigator & { standalone?: boolean };
    const d = describeDevice(navigator.userAgent, {
      standalone: window.matchMedia?.("(display-mode: standalone)").matches || nav.standalone === true,
      maxTouchPoints: navigator.maxTouchPoints ?? 0,
    });
    setDevice(d);
    const api = { serviceWorker: "serviceWorker" in navigator, pushManager: "PushManager" in window, permission: "Notification" in window ? Notification.permission : null };
    (async () => {
      let reg: ServiceWorkerRegistration | null = null;
      let sub: PushSubscription | null = null;
      if (api.serviceWorker && api.pushManager && !d.kakao) {
        try {
          reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
          sub = await reg.pushManager.getSubscription();
        } catch { reg = null; }
      }
      // Subscribed only when the server still lists this browser; a device removed in settings
      // stays removed until the person taps 「알림 받기」 again.
      const known = !!sub && state.devices.some(dev => dev.endpointTail === sub.endpoint.slice(-16));
      if (cancelled) return;
      setRegistration(reg);
      setEndpoint(sub?.endpoint ?? null);
      setReadiness(pushReadiness(d, { ...api, serviceWorker: api.serviceWorker && !!reg, subscribed: known }));
    })();
    return () => { cancelled = true; };
  }, [state?.available, state?.devices]);

  /** Call synchronously from a click handler: permission and subscribe stay inside the tap. */
  const subscribe = useCallback(async (): Promise<"subscribed" | "denied" | "failed"> => {
    if (!registration || !state?.publicKey || !device) return "failed";
    const permission = await Notification.requestPermission();
    if (permission !== "granted") { setReadiness(permission === "denied" ? "denied" : "ready"); return "denied"; }
    try {
      const sub = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(state.publicKey) as BufferSource });
      const body = sub.toJSON();
      await fetch("/api/push/subscriptions", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: body.endpoint, keys: body.keys, platform: platformLabel(device), browser: device.browser }),
      }).then(r => json<{ id: string }>(r));
      setEndpoint(sub.endpoint);
      setReadiness("subscribed");
      await qc.invalidateQueries({ queryKey: pushKey });
      return "subscribed";
    } catch {
      return "failed";
    }
  }, [registration, state?.publicKey, device, qc]);

  /** After removing this browser's row, also drop the browser-side subscription. */
  const forgetThisBrowser = useCallback(async () => {
    try { await (await registration?.pushManager.getSubscription())?.unsubscribe(); } catch { /* server row is already gone */ }
    setEndpoint(null);
    setReadiness("ready");
  }, [registration]);

  return { device, readiness, endpoint, subscribe, forgetThisBrowser };
}
