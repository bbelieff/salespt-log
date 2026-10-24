// @vitest-environment jsdom
/**
 * 당겨서 새로고침이 안쪽 목록 스크롤을 막지 않는다(2026-10-24 belie 「모바일 위아래 스크롤이 잘 안 됨」).
 * 높이 고정 화면은 페이지가 늘 최상단이라, 안쪽 목록을 위로 올리는 손가락(아래로 끌기)에 preventDefault 가 걸렸다.
 * 같은 날 2차: 막을 수 있는 touchmove 자체가 안드로이드 크롬 스크롤을 늦춰 리스너를 모두 passive 로.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn(async () => undefined) }) }));

import PullToRefresh, { insideScrolledArea } from "@/components/PullToRefresh";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { React?: typeof React }).React = React;

function scroller(scrollTop: number): HTMLElement {
  const el = document.createElement("div");
  el.style.overflowY = "auto";
  Object.defineProperty(el, "scrollHeight", { value: 1000 });
  Object.defineProperty(el, "clientHeight", { value: 300 });
  el.scrollTop = scrollTop;
  Object.defineProperty(el, "scrollTop", { value: scrollTop, writable: true });
  const child = document.createElement("p");
  el.appendChild(child);
  document.body.appendChild(el);
  return child;
}

function touch(type: string, target: Element, y: number): Event {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, "touches", { value: type === "touchend" ? [] : [{ clientX: 100, clientY: y }] });
  target.dispatchEvent(e);
  return e;
}

let root: Root; let host: HTMLDivElement;
let addSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  addSpy = vi.spyOn(document, "addEventListener");
  document.body.innerHTML = "";
  window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
  Object.defineProperty(window, "innerWidth", { value: 375, configurable: true });
  host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(createElement(PullToRefresh)));
});
afterEach(() => { act(() => root.unmount()); addSpy.mockRestore(); });
const indicator = () => document.querySelector('[aria-label="당겨서 새로고침"]');

describe("insideScrolledArea", () => {
  it("내려가 있는 안쪽 목록이면 true, 맨 위 목록·일반 글이면 false", () => {
    expect(insideScrolledArea(scroller(120))).toBe(true);
    expect(insideScrolledArea(scroller(0))).toBe(false);
    expect(insideScrolledArea(document.body)).toBe(false);
  });
});

describe("당김 제스처", () => {
  it("★터치 리스너는 모두 passive — 안드로이드 크롬이 스크롤을 JS 응답까지 기다리지 않게", () => {
    const touchCalls = addSpy.mock.calls.filter(([type]) => String(type).startsWith("touch"));
    expect(touchCalls.length).toBeGreaterThan(0);
    for (const [, , opts] of touchCalls) expect((opts as AddEventListenerOptions).passive).toBe(true);
  });
  it("★안쪽 목록이 내려가 있으면 아래로 끌어도 새로고침이 끼어들지 않는다", () => {
    const t = scroller(200);
    touch("touchstart", t, 100);
    let e!: Event; act(() => { e = touch("touchmove", t, 160); });
    expect(e.defaultPrevented).toBe(false);
    expect(indicator()).toBeNull();
  });
  it("페이지·목록 모두 맨 위에서 아래로 끌면 새로고침 표시(기본 동작 막지 않음)", () => {
    const t = scroller(0);
    touch("touchstart", t, 100);
    let e!: Event; act(() => { e = touch("touchmove", t, 160); });
    expect(e.defaultPrevented).toBe(false);
    expect(indicator()).not.toBeNull();
  });
});
