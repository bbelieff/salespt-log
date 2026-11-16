// @vitest-environment jsdom
/** 메뉴 서랍 손가락 밀기(2026-11-07 belie 「왼쪽→오른쪽으로 밀어도 사이드바가 덮게」). 합성 터치만. */
import React, { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { claimEdgeTouch, edgeTapTarget, getMobileNavOpen, setMobileNavOpen, swipeBlocked, swipeIntent, swipeSkipped } from "@/components/desktop/mobile-nav";

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

describe("claimEdgeTouch — 화면 끝 밀기는 브라우저 뒤로·앞으로 가기 대신 앱이 받는다(2026-11-07 · 11-16)", () => {
  it("왼쪽 24px 안, 그리고 폭을 주면 오른쪽 24px 안에서 true — 버튼 위여도", () => {
    expect(claimEdgeTouch(10)).toBe(true);
    expect(claimEdgeTouch(40)).toBe(false);
    expect(claimEdgeTouch(380, 390)).toBe(true); // 오른쪽 끝 → 앞으로 가기(월 보기로 넘어가던 것) 막음
    expect(claimEdgeTouch(200, 390)).toBe(false);
  });
  it("막은 터치가 제자리 누르기면 그 버튼·링크를 대신 누른다, 밀었으면 누르지 않는다", () => {
    document.body.innerHTML = '<p id="p"></p><button id="b"><span id="bi"></span></button><input id="i">';
    expect(edgeTapTarget(document.getElementById("bi"), 2, 3)).toBe(document.getElementById("b"));
    expect(edgeTapTarget(document.getElementById("bi"), 40, 0)).toBeNull();
    expect(edgeTapTarget(document.getElementById("p"), 0, 0)).toBeNull();
    expect(swipeSkipped(document.getElementById("i"))).toBe(true); // 입력 칸은 막지 않는다
    expect(swipeSkipped(document.getElementById("b"))).toBe(false);
  });
});

describe("DesktopNav — 문서 어디서든 밀어서 열고 닫기", () => {
  let host: HTMLDivElement, root: Root;
  beforeEach(() => { document.body.innerHTML = ""; host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
  afterEach(() => { act(() => root.unmount()); host.remove(); setMobileNavOpen(false); });
  const touch = (type: string, x: number, y: number, target: EventTarget = document.body) => {
    const ev = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(ev, "touches", { value: type === "touchend" ? [] : [{ clientX: x, clientY: y }] });
    act(() => { target.dispatchEvent(ev); });
    return ev;
  };
  it("오른쪽으로 밀면 열리고, 왼쪽으로 밀면 닫힌다 · 다른 팝업이 떠 있으면 열지 않는다", async () => {
    const { default: DesktopNav } = await import("@/components/desktop/DesktopNav");
    act(() => root.render(createElement(DesktopNav)));
    expect(touch("touchstart", 10, 300).defaultPrevented).toBe(true); // 왼쪽 끝 → 브라우저 뒤로 가기 막음
    touch("touchmove", 100, 310); touch("touchend", 0, 0);
    expect(getMobileNavOpen()).toBe(true);
    expect(host.querySelector("nav")!.getAttribute("data-open")).toBe("true");
    touch("touchstart", 250, 300); touch("touchmove", 150, 305); touch("touchend", 0, 0);
    expect(getMobileNavOpen()).toBe(false);
    expect(touch("touchstart", 120, 300).defaultPrevented).toBe(false); // 가운데에서 시작한 터치는 그대로(스크롤·탭)
    touch("touchend", 0, 0);
    const modal = document.createElement("div"); modal.setAttribute("aria-modal", "true"); document.body.append(modal);
    touch("touchstart", 10, 300); touch("touchmove", 120, 300);
    expect(getMobileNavOpen()).toBe(false);
    modal.remove();
    const input = document.createElement("input"); document.body.append(input);
    touch("touchstart", 10, 300, input); touch("touchmove", 120, 300, input);
    expect(getMobileNavOpen()).toBe(false);
    // 2026-11-16: 오른쪽 끝·버튼 위에서 시작해도 막고, 제자리 누르기는 대신 눌러 준다. 입력 칸은 그대로.
    expect(touch("touchstart", 10, 300, input).defaultPrevented).toBe(false);
    expect(touch("touchstart", window.innerWidth - 5, 300).defaultPrevented).toBe(true);
    touch("touchend", 0, 0);
    const button = document.createElement("button"); let clicks = 0; button.onclick = () => { clicks += 1; }; document.body.append(button);
    expect(touch("touchstart", 8, 300, button).defaultPrevented).toBe(true);
    const end = new Event("touchend", { bubbles: true, cancelable: true });
    Object.defineProperty(end, "touches", { value: [] }); Object.defineProperty(end, "changedTouches", { value: [{ clientX: 9, clientY: 301 }] });
    act(() => { button.dispatchEvent(end); });
    expect(clicks).toBe(1);
  });
});
