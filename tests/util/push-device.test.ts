/** web-push-notifications §2-1 — 기기별 준비 상태. 합성 UA. */
import { describe, expect, it } from "vitest";
import { describeDevice, pushReadiness, urlBase64ToBytes } from "@/util/push-device";

const api = { serviceWorker: true, pushManager: true, permission: "default", subscribed: false };
const ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36";
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 CriOS/129.0 Mobile/15E148 Safari/604.1";
const IPHONE_OLD = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 Version/16.3 Mobile/15E148 Safari/604.1";
const KAKAO = ANDROID + " KAKAOTALK 10.8.0";

describe("pushReadiness", () => {
  it("Android Chrome can ask right away", () => {
    expect(pushReadiness(describeDevice(ANDROID, { standalone: false, maxTouchPoints: 5 }), api)).toBe("ready");
  });
  it("an iPhone tab is sent to the home-screen app; the home-screen app can ask", () => {
    expect(pushReadiness(describeDevice(IPHONE_CHROME, { standalone: false, maxTouchPoints: 5 }), api)).toBe("ios_needs_home");
    expect(pushReadiness(describeDevice(IPHONE_CHROME, { standalone: true, maxTouchPoints: 5 }), api)).toBe("ready");
  });
  it("iOS below 16.4 and KakaoTalk are recognised", () => {
    expect(pushReadiness(describeDevice(IPHONE_OLD, { standalone: true, maxTouchPoints: 5 }), api)).toBe("ios_too_old");
    expect(pushReadiness(describeDevice(KAKAO, { standalone: false, maxTouchPoints: 5 }), api)).toBe("kakao");
  });
  it("blocked permission and an existing subscription", () => {
    const d = describeDevice(ANDROID, { standalone: false, maxTouchPoints: 5 });
    expect(pushReadiness(d, { ...api, permission: "denied" })).toBe("denied");
    expect(pushReadiness(d, { ...api, permission: "granted", subscribed: true })).toBe("subscribed");
  });
});

it("decodes a base64url VAPID key", () => {
  expect(Array.from(urlBase64ToBytes("AQID_-8"))).toEqual([1, 2, 3, 255, 239]);
});
