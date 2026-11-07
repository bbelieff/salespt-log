// @vitest-environment jsdom
/** STEP 1.5·2 통합(belie 2026-11-07): STEP 2 = DB관리(DB 목록 + 일별 기록), DB 전환 전 기수는 일별 기록으로. 합성 값만. */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }), usePathname: () => "/db-sheet" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => h("a", { ...p, href }, children) }));

import DbManagementTabs from "@/components/DbManagementTabs";
import { NAV_STEPS } from "@/components/TabBar";
import { DbSheetLoadError, isDbSheetUnsupported } from "@/lib/query/db-sheet-hooks";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | null = null, host: HTMLDivElement | null = null;
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; push.mockClear(); });

describe("STEP 2 DB관리 탭", () => {
  it("DB 목록 · 일별 기록 두 탭, 지금 화면은 aria-current, 다른 탭은 미저장 확인을 거쳐 이동", () => {
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    act(() => root!.render(h(DbManagementTabs, { current: "/contact" })));
    const links = [...host.querySelectorAll("a")];
    expect(links.map((a) => [a.textContent, a.getAttribute("href"), a.getAttribute("aria-current")])).toEqual([["DB 목록", "/db-sheet", null], ["일별 기록", "/contact", "page"]]);
    act(() => links[0]!.click());
    expect(push).toHaveBeenCalledWith("/db-sheet");
    act(() => links[1]!.click());
    expect(push).toHaveBeenCalledTimes(1); // 지금 화면은 다시 이동하지 않는다
  });

  it("메뉴(PC 왼쪽·폰 서랍 공용) — STEP 2 는 DB관리, DB 목록·일별 기록 어디서든 켜지고 STEP 1 은 DB생산에서만", () => {
    expect(NAV_STEPS.map((t) => `${t.step} ${t.label}`)).toEqual(["1 DB생산", "2 DB관리", "3 일정·계약", "4 실무/수납"]);
    const [one, two] = NAV_STEPS;
    expect(two!.href).toBe("/db-sheet");
    expect([two!.match("/db-sheet"), two!.match("/contact"), two!.match("/db")]).toEqual([true, true, false]);
    expect([one!.match("/db"), one!.match("/db-sheet")]).toEqual([true, false]);
  });

  it("DB 전환 전 기수: 서버 문구가 대시보드 「지원 안 함」 판정과 짝이고, DB 목록 화면은 일별 기록으로 보낸다", () => {
    const service = readFileSync("lib/service/db-sheet.ts", "utf8");
    const message = /new DbSheetUnavailable\("([^"]+)", "unsupported"\)/.exec(service)?.[1];
    expect(message).toBeTruthy();
    expect(isDbSheetUnsupported(new DbSheetLoadError(message!, 503))).toBe(true);
    expect(readFileSync("app/api/db-sheet/route.ts", "utf8")).toContain("code: error.code");
    const page = readFileSync("app/(app)/db-sheet/page.tsx", "utf8");
    expect(page).toMatch(/errorCode==='unsupported'\)router\.replace\('\/contact'\)/);
    expect(readFileSync("app/(app)/db-sheet/_components/use-db-sheet.ts", "utf8")).toContain('state.errorCode !== "unsupported"');
  });
});
