// @vitest-environment jsdom
/** 「오늘 활동」(belie 2026-11-07): 일별 기록 오늘 숫자 그대로, 현수막 게시 ±1 은 현수막 줄만 저장. 합성 값만. */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => h("a", { ...p, href }, children) }));
import { TodayActivity } from "@/app/(app)/db-sheet/_components/TodayActivity";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
const z = { production: 0, inflow: 0, contactProgress: 0, meetingReservation: 0 };
const day = () => ({ date: "2026-11-07", weekIndex: 1, courseStart: "2026-11-06", meetings: [], inflowWaitBase: 8, bannerStockBase: 16, bannerOrderQty: 20,
  channels: { 매입DB: { ...z, production: 5, inflow: 5, contactProgress: 3, meetingReservation: 1, dbSheetInflow: 5, dbSheetContacts: 3 }, 직접생산: { ...z, production: 2, inflow: 2 }, 현수막: { ...z, production: 2, inflow: 1, dbSheetInflow: 1 }, "콜·지·기·소": { ...z, production: 3, inflow: 3, contactProgress: 2, meetingReservation: 1 } } });

const btnIn = (el: Element, label: string) => el.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
let root: Root | null = null, host: HTMLDivElement | null = null;
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; vi.unstubAllGlobals(); });
const flush = () => act(async () => { for (let i = 0; i < 5; i++) await new Promise(r => setTimeout(r, 0)); });

describe("오늘 활동", () => {
  it("닫혀 있어도 흐름 숫자(합계)와 빠른 추가, 현수막 게시는 패널을 열어 장수 칸으로 — 현수막 줄만 보낸다", async () => {
    const posts: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") { posts.push(JSON.parse(String(init.body))); return new Response('{"ok":true}', { status: 200 }); }
      return new Response(JSON.stringify(day()), { status: 200 });
    }));
    const onAdd = vi.fn();
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    act(() => root!.render(h(QueryClientProvider, { client: new QueryClient() }, h(TodayActivity, { onAdd }))));
    await flush();
    const peek = host.querySelector('section[aria-label="오늘 활동"]')!;
    expect(peek.textContent).toContain("12생산");
    expect(peek.textContent).toContain("11유입");
    expect(peek.textContent).toContain("5컨택");
    expect(peek.textContent).toContain("2미팅");
    const btn = (t: string) => [...peek.querySelectorAll("button")].find(b => b.textContent?.startsWith(t))!;
    expect(btn("＋ 현수막 게시").textContent).toContain("재고 14");
    act(() => btn("＋ DB 추가").click());
    expect(onAdd).toHaveBeenCalledTimes(1);
    act(() => btn("＋ 현수막 게시").click());
    const input = host.querySelector<HTMLInputElement>('input[aria-label="오늘 현수막 게시 수"]')!;
    expect(document.activeElement).toBe(input); // 바로 적게
    await act(async () => btnIn(host!, "현수막 게시 10장 더하기").click());
    await flush();
    expect(posts).toEqual([{ 현수막: { ...z, production: 12, inflow: 1, dbSheetInflow: 1 } }]);
  });

  it("PC 중간 폭 띠: 숫자 네 칸이 보이고, 띠 아무 데나 누르면 펼친다(belie 2026-11-09)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(day()), { status: 200 })));
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    act(() => root!.render(h(QueryClientProvider, { client: new QueryClient() }, h(TodayActivity, { onAdd: vi.fn() }))));
    await flush();
    const pill = host.querySelector(".ta-pc-pill section")!;
    expect(pill.textContent).toContain("12생산");
    expect(pill.textContent).toContain("2미팅");
    expect(pill.querySelectorAll("button")).toHaveLength(1); // 추가 버튼 없이 펼치기만 — 높이를 한 줄로
    act(() => pill.querySelector("b")!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(host.querySelector("tbody")).not.toBeNull();
  });

  it("펼치면 채널별 표·재고·일별 기록 링크, 장수 칸 직접 입력, 닫기 버튼으로 닫힘", async () => {
    const posts: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") { posts.push(JSON.parse(String(init.body))); return new Response('{"ok":true}', { status: 200 }); }
      return new Response(JSON.stringify(day()), { status: 200 });
    }));
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    act(() => root!.render(h(QueryClientProvider, { client: new QueryClient() }, h(TodayActivity, { onAdd: vi.fn() }))));
    await flush();
    act(() => [...host!.querySelectorAll("button[aria-expanded]")][0]!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(host.textContent).toContain("재고 14개");
    // 매입DB 유입대기 = inflowWaitBase 8 − 오늘 유입 5 = 3
    expect(host.textContent).toMatch(/유입대기.*유입 안 된 수3개/);
    expect(host.querySelector('a[href="/contact"]')!.textContent).toContain("일별 기록에서 고치기");
    expect(host.querySelectorAll("tbody tr")).toHaveLength(4);
    // 장수 칸에 바로 적기 — 15 를 적고 Enter 면 현수막 줄 production 15 만 보낸다(belie 2026-11-08 대량 게시)
    const input = host.querySelector<HTMLInputElement>('input[aria-label="오늘 현수막 게시 수"]')!;
    act(() => input.focus());
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => { set.call(input, "15"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => { input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
    await flush();
    expect(posts).toEqual([{ 현수막: { ...z, production: 15, inflow: 1, dbSheetInflow: 1 } }]);
    act(() => host!.querySelector<HTMLButtonElement>('button[aria-label="오늘 활동 닫기"]')!.click());
    expect(host.querySelector("tbody")).toBeNull();
  });

  it("폰: 띠를 위로 쓸어 올리면 열리고, 펼친 머리를 아래로 쓸면 닫힌다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(day()), { status: 200 })));
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    act(() => root!.render(h(QueryClientProvider, { client: new QueryClient() }, h(TodayActivity, { onAdd: vi.fn() }))));
    await flush();
    const touch = (el: Element, type: string, y: number) => {
      const ev = new Event(type, { bubbles: true });
      Object.defineProperty(ev, "touches", { value: type === "touchend" ? [] : [{ clientY: y }] });
      act(() => { el.dispatchEvent(ev); });
    };
    const strip = host.querySelector('section[aria-label="오늘 활동"]')!; // 첫 번째 = 폰 띠
    touch(strip, "touchstart", 700); touch(strip, "touchmove", 690); // 10px 은 안 열림
    expect(host.querySelector("tbody")).toBeNull();
    touch(strip, "touchmove", 650); touch(strip, "touchend", 650);
    expect(host.querySelector("tbody")).not.toBeNull();
    const head = host.querySelector('button[aria-label="오늘 활동 닫기"]')!.parentElement!;
    touch(head, "touchstart", 100); touch(head, "touchmove", 160);
    expect(host.querySelector("tbody")).toBeNull();
  });

  it("네 칸이 모두 0인 채널은 표에서 빼고, 다 0이면 한 줄 안내", async () => {
    const zeroDirect = { ...day(), channels: { ...day().channels, 직접생산: { ...z } } };
    const allZero = { ...day(), channels: { 매입DB: { ...z }, 직접생산: { ...z }, 현수막: { ...z }, "콜·지·기·소": { ...z } } };
    for (const [data, rows] of [[zeroDirect, 3], [allZero, 0]] as const) {
      vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(data), { status: 200 })));
      host = document.createElement("div"); document.body.append(host); root = createRoot(host);
      act(() => root!.render(h(QueryClientProvider, { client: new QueryClient() }, h(TodayActivity, { onAdd: vi.fn() }))));
      await flush();
      act(() => [...host!.querySelectorAll("button[aria-expanded]")][0]!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
      expect(host.querySelectorAll("tbody tr")).toHaveLength(rows);
      if (rows) expect(host.querySelector("tbody")!.textContent).not.toContain("직접생산");
      else expect(host.textContent).toContain("아직 오늘 기록이 없어요");
      act(() => root!.unmount()); host.remove(); root = null; host = null;
    }
  });

  it("현수막을 산 적이 없으면 오늘 게시가 있어도 현수막 게시 칸·버튼을 뺀다", async () => {
    // 재고 base 는 오늘 게시를 더한 값이라(0 − 0 + 3 = 3) 구매가 없어도 양수가 된다 — 구매 수로 판단.
    const none = { ...day(), bannerOrderQty: 0, bannerStockBase: 3, channels: { ...day().channels, 현수막: { ...z, production: 3 } } };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(none), { status: 200 })));
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    act(() => root!.render(h(QueryClientProvider, { client: new QueryClient() }, h(TodayActivity, { onAdd: vi.fn() }))));
    await flush();
    expect(host.textContent).not.toContain("현수막 게시");
    act(() => [...host!.querySelectorAll("button[aria-expanded]")][0]!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(host.querySelector('input[aria-label="오늘 현수막 게시 수"]')).toBeNull();
    expect(host.textContent).not.toContain("목록에 없는 활동");
  });

  it("재고보다 많이 붙이려 하면 저장하지 않고 남은 재고를 알려 준다", async () => {
    const posts: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") { posts.push(init.body); return new Response('{"ok":true}', { status: 200 }); }
      return new Response(JSON.stringify(day()), { status: 200 });
    }));
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    act(() => root!.render(h(QueryClientProvider, { client: new QueryClient() }, h(TodayActivity, { onAdd: vi.fn() }))));
    await flush();
    act(() => [...host!.querySelectorAll("button[aria-expanded]")][0]!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    const input = host.querySelector<HTMLInputElement>('input[aria-label="오늘 현수막 게시 수"]')!;
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => { input.focus(); set.call(input, "30"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    await flush();
    expect(posts).toHaveLength(0);
    expect(host.textContent).toContain("재고가 14개뿐이에요");
  });
  it("날짜 ‹ › 로 지난 날을 그 자리에서 보고, 그날 현수막도 그날로 저장 — 오늘 뒤로는 못 가고 닫으면 오늘로", async () => {
    const gets: string[] = [], posts: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") { posts.push(url); return new Response('{"ok":true}', { status: 200 }); }
      gets.push(url);
      return new Response(JSON.stringify(day()), { status: 200 });
    }));
    const { todayKST, addDays } = await import("@/util/week");
    const today = todayKST();
    const yest = addDays(new Date(`${today}T12:00:00+09:00`), -1).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    act(() => root!.render(h(QueryClientProvider, { client: new QueryClient() }, h(TodayActivity, { onAdd: vi.fn() }))));
    await flush();
    act(() => [...host!.querySelectorAll("button[aria-expanded]")][0]!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(btnIn(host, "하루 뒤").disabled).toBe(true);
    act(() => btnIn(host!, "하루 전").click());
    await flush();
    expect(gets.some(u => u.endsWith(`/api/daily/${yest}`))).toBe(true);
    expect(host.querySelector("h2")!.textContent).toBe("지난 활동");
    expect(btnIn(host, "하루 뒤").disabled).toBe(false);
    await act(async () => btnIn(host!, "현수막 게시 1장 더하기").click());
    await flush();
    expect(posts.at(-1)).toContain(yest);
    act(() => [...host!.querySelectorAll("button")].find(b => b.textContent === "오늘로")!.click());
    expect(host.querySelector("h2")!.textContent).toBe("오늘 활동");
    act(() => btnIn(host!, "하루 전").click());
    act(() => host!.querySelector<HTMLButtonElement>('button[aria-label="오늘 활동 닫기"]')!.click());
    act(() => [...host!.querySelectorAll("button[aria-expanded]")][0]!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(host.querySelector("h2")!.textContent).toBe("오늘 활동");
  });
});
