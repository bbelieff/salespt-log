/** Pure device checks for web push setup (plan §2-1). No imports. */

export type PushDeviceKind = "android" | "ios" | "desktop" | "other";
export type PushReadiness =
  | "ready"            // can ask for permission now
  | "subscribed"       // this browser already receives
  | "kakao"            // KakaoTalk in-app browser: open in Chrome first
  | "ios_needs_home"   // iPhone tab: add to home screen and open the icon
  | "ios_too_old"      // iOS below 16.4
  | "denied"           // permission blocked in browser settings
  | "unsupported";

export interface DeviceInfo { kind: PushDeviceKind; browser: string; standalone: boolean; iosVersion: number | null; kakao: boolean }

export function describeDevice(ua: string, opts: { standalone: boolean; maxTouchPoints: number }): DeviceInfo {
  const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && opts.maxTouchPoints > 1);
  const m = ua.match(/OS (\d+)[_.](\d+)/);
  const iosVersion = ios && m ? Number(m[1]) + Number(m[2]) / 100 : null;
  const kind: PushDeviceKind = /android/i.test(ua) ? "android" : ios ? "ios" : /windows|macintosh|linux|cros/i.test(ua) ? "desktop" : "other";
  const browser = /kakaotalk/i.test(ua) ? "kakao" : /edg\//i.test(ua) ? "edge" : /crios|chrome/i.test(ua) ? "chrome" : /safari/i.test(ua) ? "safari" : "";
  return { kind, browser, standalone: opts.standalone, iosVersion, kakao: /kakaotalk/i.test(ua) };
}

export function pushReadiness(d: DeviceInfo, api: { serviceWorker: boolean; pushManager: boolean; permission: string | null; subscribed: boolean }): PushReadiness {
  if (d.kakao) return "kakao";
  if (d.kind === "ios") {
    if (d.iosVersion !== null && d.iosVersion < 16.04) return "ios_too_old";
    if (!d.standalone) return "ios_needs_home";
  }
  if (!api.serviceWorker || !api.pushManager || api.permission === null) return "unsupported";
  if (api.permission === "denied") return "denied";
  if (api.subscribed) return "subscribed";
  return "ready";
}

/** Server-side platform label stored with the subscription. */
export function platformLabel(d: DeviceInfo): "android" | "ios_pwa" | "desktop" | "other" {
  return d.kind === "ios" ? "ios_pwa" : d.kind;
}

export function urlBase64ToBytes(base64: string): Uint8Array {
  const padded = base64.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
