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
const day = () => ({ date: "2026-11-07", weekIndex: 1, courseStart: "2026-11-06", meetings: [], inflowWaitBase: 0, bannerStockBase: 16,
  channels: { 매입DB: { ...z, production: 5, inflow: 5, contactProgress: 3, meetingReservation: 1, dbSheetInflow: 5, dbSheetContacts: 3 }, 직접생산: { ...z, production: 2, inflow: 2 }, 현수막: { ...z, production: 2, inflow: 1, dbSheetInflow: 1 }, "콜·지·기·소": { ...z, production: 3, inflow: 3, contactProgress: 2, meetingReservation: 1 } } });

let root: Root | null = null, host: HTMLDivElement | null = null;
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; vi.unstubAllGlobals(); });
const flush = () => act(async () => { for (let i = 0; i < 5; i++) await new Promise(r => setTimeout(r, 0)); });

describe("오늘 활동", () => {
  it("닫혀 있어도 흐름 숫자(합계)와 빠른 추가, 현수막 게시 +1 은 현수막 줄만 그대로 보낸다", async () => {
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
    const btn = (t: string) => [...peek.querySelectorAll("button")].find(b => b.textContent === t)!;
    act(() => btn("＋ DB 추가").click());
    expect(onAdd).toHaveBeenCalledTimes(1);
    await act(async () => btn("＋ 현수막 게시").click());
    await flush();
    expect(posts).toEqual([{ 현수막: { ...z, production: 3, inflow: 1, dbSheetInflow: 1 } }]);
  });

  it("펼치면 채널별 표·재고·일별 기록 링크, 닫기 버튼으로 닫힘", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(day()), { status: 200 })));
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    act(() => root!.render(h(QueryClientProvider, { client: new QueryClient() }, h(TodayActivity, { onAdd: vi.fn() }))));
    await flush();
    act(() => [...host!.querySelectorAll("button[aria-expanded]")][0]!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(host.textContent).toContain("재고 14개");
    expect(host.querySelector('a[href="/contact"]')!.textContent).toContain("일별 기록 전체");
    expect(host.querySelectorAll("tbody tr")).toHaveLength(4);
    act(() => host!.querySelector<HTMLButtonElement>('button[aria-label="오늘 활동 닫기"]')!.click());
    expect(host.querySelector("tbody")).toBeNull();
  });
});
