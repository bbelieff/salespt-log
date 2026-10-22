/*
 * 경영일지 push-only service worker (docs/plans/active/web-push-notifications.md §5).
 * No fetch handler on purpose: registering one (even an empty one) wakes this worker on
 * every page load. No caching, no offline mode.
 */
const SW_VERSION = "push-1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Every push must show a notification: Safari revokes permission for silent pushes.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = {}; }
  const title = typeof data.title === "string" && data.title ? data.title : "경영일지";
  const body = typeof data.body === "string" && data.body ? data.body : "오늘 챙길 일을 확인해 보세요.";
  const url = typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/dashboard";
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: "/apple-icon",
    data: { url, d: typeof data.d === "string" ? data.d : null, v: SW_VERSION },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const { url, d } = event.notification.data || {};
  const target = new URL(url || "/dashboard", self.location.origin).href;
  event.waitUntil((async () => {
    if (d) {
      try {
        await fetch("/api/push/opened", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ d }) });
      } catch (_) { /* opening the app matters more than the tag */ }
    }
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      try { if ("navigate" in client) await client.navigate(target); } catch (_) { /* fall through to focus */ }
      if ("focus" in client) return client.focus();
    }
    return self.clients.openWindow(target);
  })());
});

function platformOf(ua) {
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && self.navigator.maxTouchPoints > 1)) return "ios_pwa";
  if (/windows|macintosh|linux|cros/i.test(ua)) return "desktop";
  return "other";
}

// The browser rotated the subscription: register the new one so the device keeps receiving.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil((async () => {
    const state = await fetch("/api/push", { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (!state || !state.available || !state.publicKey) return;
    const key = Uint8Array.from(atob(state.publicKey.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((state.publicKey.length + 3) % 4)), (c) => c.charCodeAt(0));
    const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    const json = sub.toJSON();
    await fetch("/api/push/subscriptions", {
      method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, platform: platformOf(self.navigator.userAgent), browser: "" }),
    });
  })());
});
