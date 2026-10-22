/**
 * 2026-10-22 belie — 로그아웃하면 그 기기 알림만 꺼진다(서버 행 먼저, 그다음 브라우저 구독).
 * 서버 호출이 실패해도 브라우저 구독은 지운다(다음 발송이 410 → 서버가 비활성).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { forgetPushOnThisDevice } from "@/query/push-hooks";

function setup(fetchImpl: () => Promise<unknown>, sub: { endpoint: string; unsubscribe: () => Promise<boolean> } | null) {
  const order: string[] = [];
  const fetchMock = vi.fn(async (...args: unknown[]) => { order.push("server"); void args; return fetchImpl(); });
  const unsubscribe = vi.fn(async () => { order.push("browser"); return true; });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("navigator", {
    serviceWorker: { getRegistration: async () => ({ pushManager: { getSubscription: async () => (sub ? { ...sub, unsubscribe } : null) } }) },
  });
  return { order, fetchMock, unsubscribe };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe("forgetPushOnThisDevice", () => {
  it("removes this device on the server, then drops the browser subscription", async () => {
    const t = setup(async () => new Response("{}"), { endpoint: "https://push.example/abc", unsubscribe: async () => true });
    await forgetPushOnThisDevice();
    expect(t.order).toEqual(["server", "browser"]);
    const [url, init] = t.fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/push/subscriptions");
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(String(init.body))).toEqual({ endpoint: "https://push.example/abc" });
  });
  it("still drops the browser subscription when the server call fails", async () => {
    const t = setup(async () => { throw new Error("offline"); }, { endpoint: "https://push.example/abc", unsubscribe: async () => true });
    await forgetPushOnThisDevice();
    expect(t.unsubscribe).toHaveBeenCalledOnce();
  });
  it("does nothing on a browser that never subscribed", async () => {
    const t = setup(async () => new Response("{}"), null);
    await forgetPushOnThisDevice();
    expect(t.fetchMock).not.toHaveBeenCalled();
  });
});
