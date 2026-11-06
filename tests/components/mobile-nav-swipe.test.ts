// @vitest-environment jsdom
/** 메뉴 서랍 손가락 밀기(2026-11-07 belie 「왼쪽→오른쪽으로 밀어도 사이드바가 덮게」). 합성 터치만. */
import React, { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMobileNavOpen, setMobileNavOpen, swipeBlocked, swipeIntent } from "@/components/desktop/mobile-nav";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard", useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/query/me-hook", () => ({ useMe: () => ({ data: {} }) }));
vi.mock("@/components/DirtyGuard", () => ({ useGuardedRouter: () => ({ push: vi.fn() }) }));

describe("swipeIntent — 가로로 충분히·세로보다 확실히", () => {
  it("닫힘에서 오른쪽 60px+ 는 열기, 열림에서 왼쪽은 닫기", () => {
    expect(swipeIntent(false, 80, 10)).toBe("open");
    expect(swipeIntent(true, -80, 10)).toBe("close");
  });
  it("짧거나 비스듬하거나 방향이 반대면 아무것도 안 함", () => {
    expect(swipeIntent(false, 40, 0)).toBeNull();
    expect(swipeIntent(false, 80, 50)).toBeNull();
    expect(swipeIntent(false, -80, 0)).toBeNull();
    expect(swipeIntent(true, 80, 0)).toBeNull();
  });
});

describe("swipeBlocked — 입력 칸·손잡이·왼쪽으로 밀린 가로 스크롤 안은 제외", () => {
  it("입력 칸, 크기 조절 손잡이, data-no-nav-swipe 는 막는다", () => {
    document.body.innerHTML = '<input id="a"><div role="separator"><span id="b"></span></div><div data-no-nav-swipe><p id="c"></p></div><p id="d"></p>';
    for (const id of ["a", "b", "c"]) expect(swipeBlocked(document.getElementById(id))).toBe(true);
    expect(swipeBlocked(document.getElementById("d"))).toBe(false);
  });
  it("가로 스크롤 영역은 왼쪽 끝일 때만 열기 허용", () => {
    document.body.innerHTML = '<div id="s" style="overflow-x:auto"><p id="in"></p></div>';
    const s = document.getElementById("s")!;
    Object.defineProperty(s, "scrollWidth", { value: 900 });
    Object.defineProperty(s, "clientWidth", { value: 300 });
    expect(swipeBlocked(document.getElementById("in"))).toBe(false);
    s.scrollLeft = 120;
    expect(swipeBlocked(document.getElementById("in"))).toBe(true);
  });
});

describe("DesktopNav — 문서 어디서든 밀어서 열고 닫기", () => {
  let host: HTMLDivElement, root: Root;
  beforeEach(() => { document.body.innerHTML = ""; host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
  afterEach(() => { act(() => root.unmount()); host.remove(); setMobileNavOpen(false); });
  const touch = (type: string, x: number, y: number, target: EventTarget = document.body) => {
    const ev = new Event(type, { bubbles: true });
    Object.defineProperty(ev, "touches", { value: type === "touchend" ? [] : [{ clientX: x, clientY: y }] });
    act(() => { target.dispatchEvent(ev); });
  };
  it("오른쪽으로 밀면 열리고, 왼쪽으로 밀면 닫힌다 · 다른 팝업이 떠 있으면 열지 않는다", async () => {
    const { default: DesktopNav } = await import("@/components/desktop/DesktopNav");
    act(() => root.render(createElement(DesktopNav)));
    touch("touchstart", 10, 300); touch("touchmove", 100, 310); touch("touchend", 0, 0);
    expect(getMobileNavOpen()).toBe(true);
    expect(host.querySelector("nav")!.getAttribute("data-open")).toBe("true");
    touch("touchstart", 250, 300); touch("touchmove", 150, 305); touch("touchend", 0, 0);
    expect(getMobileNavOpen()).toBe(false);
    const modal = document.createElement("div"); modal.setAttribute("aria-modal", "true"); document.body.append(modal);
    touch("touchstart", 10, 300); touch("touchmove", 120, 300);
    expect(getMobileNavOpen()).toBe(false);
    modal.remove();
    const input = document.createElement("input"); document.body.append(input);
    touch("touchstart", 10, 300, input); touch("touchmove", 120, 300, input);
    expect(getMobileNavOpen()).toBe(false);
  });
});
