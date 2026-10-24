// @vitest-environment jsdom
/**
 * 당겨서 새로고침이 안쪽 목록 스크롤을 막지 않는다(2026-10-24 belie 「모바일 위아래 스크롤이 잘 안 됨」).
 * 높이 고정 화면은 페이지가 늘 최상단이라, 안쪽 목록을 위로 올리는 손가락(아래로 끌기)에 preventDefault 가 걸렸다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn(async () => undefined) }) }));

import PullToRefresh, { insideScrolledArea } from "@/components/PullToRefresh";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
beforeEach(() => {
  document.body.innerHTML = "";
  window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
  Object.defineProperty(window, "innerWidth", { value: 375, configurable: true });
  host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(createElement(PullToRefresh)));
});
afterEach(() => act(() => root.unmount()));

describe("insideScrolledArea", () => {
  it("내려가 있는 안쪽 목록이면 true, 맨 위 목록·일반 글이면 false", () => {
    expect(insideScrolledArea(scroller(120))).toBe(true);
    expect(insideScrolledArea(scroller(0))).toBe(false);
    expect(insideScrolledArea(document.body)).toBe(false);
  });
});

describe("당김 제스처", () => {
  it("★안쪽 목록이 내려가 있으면 아래로 끌어도 막지 않는다(목록이 위로 스크롤)", () => {
    const t = scroller(200);
    touch("touchstart", t, 100);
    expect(touch("touchmove", t, 160).defaultPrevented).toBe(false);
    touch("touchend", t, 160);
  });
  it("페이지·목록 모두 맨 위에서 아래로 끌면 새로고침 당김(기존 동작 유지)", () => {
    const t = scroller(0);
    touch("touchstart", t, 100);
    expect(touch("touchmove", t, 160).defaultPrevented).toBe(true);
  });
});
