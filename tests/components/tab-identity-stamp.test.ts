// @vitest-environment jsdom
/** 탭 신원 도장: 쓰기 요청에 탭 지문을 싣고, 서버는 지금 신원과 다르면 거부한다 (2026-11-10 UI 점검). 가상 값만. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { installTabIdentityStamp, shouldStamp } from "@/components/auth/tab-identity-stamp";
import { TAB_IDENTITY_HEADER } from "@/auth/tab-identity";

const origin = "http://localhost:3000";

describe("shouldStamp", () => {
  it("같은 사이트 /api 쓰기만", () => {
    expect(shouldStamp("/api/contact", "POST", origin)).toBe(true);
    expect(shouldStamp("/api/contact", "patch", origin)).toBe(true);
    expect(shouldStamp("/api/contact", "GET", origin)).toBe(false);
    expect(shouldStamp("/dashboard", "POST", origin)).toBe(false);
    expect(shouldStamp("https://other.example/api/x", "POST", origin)).toBe(false);
  });
});

describe("installTabIdentityStamp", () => {
  let undo: (() => void) | null = null;
  afterEach(() => { undo?.(); undo = null; vi.unstubAllGlobals(); });

  it("★쓰기 요청에 탭 지문을 싣고, 읽기·지문 없음엔 싣지 않는다", async () => {
    const seen: Array<string | null> = [];
    vi.stubGlobal("fetch", vi.fn(async (_i: RequestInfo | URL, init?: RequestInit) => { seen.push(new Headers(init?.headers).get(TAB_IDENTITY_HEADER)); return new Response("{}"); }));
    let fp: string | null = null;
    undo = installTabIdentityStamp(() => fp);
    await fetch("/api/contact", { method: "POST", headers: { "content-type": "application/json" } });
    fp = "fp-a";
    await fetch("/api/contact", { method: "GET" });
    await fetch("/api/contact", { method: "POST", headers: { "content-type": "application/json" } });
    expect(seen).toEqual([null, null, "fp-a"]);
  });
});
