// @vitest-environment jsdom
import * as React from "react";
import { act, createElement as h } from "react";
Object.assign(globalThis, { React });
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import WorkStatusBar from "@/components/payment/WorkStatusBar";
import type { WorkStatusItem } from "@/lib/analytics/payment-work-status";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const item = (key: string, status: WorkStatusItem["status"]): WorkStatusItem =>
  ({ key, status, row: 3, slot: 1, company: "예시상사", product: "", institution: "" }) as unknown as WorkStatusItem;

describe("전체 진행건 호버 팝업 (belie 2026-09-29)", () => {
  afterEach(() => vi.useRealTimers());
  it.each(["top", "bottom"] as const)("%s: 막대·팝업 왕복 후 어느 쪽에서 나가도 닫히며 사이 간격에서는 유지된다", (popoverPlacement) => {
    vi.useFakeTimers();
    const host = document.createElement("div"); document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(h(WorkStatusBar, { items: [item("a", "waiting")], onNavigate: vi.fn(), popoverPlacement })));
    const bar = host.querySelector('[aria-label="진행대기 1건"]') as HTMLElement;
    const pop = () => host.querySelector("[data-work-status-popover]") as HTMLElement | null;
    const enter = (target: HTMLElement, from: EventTarget = document.body) => act(() => {
      target.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, relatedTarget: from, clientX: 100 }));
    });
    const leave = (target: HTMLElement, to: EventTarget = document.body) => act(() => {
      target.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: to }));
    });
    const settle = () => act(() => vi.advanceTimersByTime(150));
    try {
      enter(bar);
      leave(bar); settle(); // 팝업에 들어가지 않고 막대에서 바로 이탈.
      expect(pop()).toBeNull();

      enter(bar);
      const firstPopup = pop()!;
      leave(bar); // 막대와 팝업 사이 작은 간격.
      act(() => vi.advanceTimersByTime(60));
      enter(firstPopup); settle();
      expect(pop()).not.toBeNull();
      leave(firstPopup, bar); enter(bar, firstPopup); settle();
      expect(pop()).not.toBeNull(); // 팝업 → 막대 이동은 유지.
      leave(bar); settle();
      expect(pop()).toBeNull(); // 보고된 팝업 → 막대 → 바깥 경로.

      enter(bar);
      const secondPopup = pop()!;
      leave(bar, secondPopup); enter(secondPopup, bar);
      leave(secondPopup); settle();
      expect(pop()).toBeNull();

      enter(bar);
      act(() => window.dispatchEvent(new Event("blur")));
      expect(pop()).toBeNull(); // 브라우저 창 밖으로 이동/전환.
    } finally {
      act(() => root.unmount()); host.remove();
    }
  });
  it("마우스 지점에서 뜨고, 화면 밖으로는 안 나가며, 제목줄이 상태 막대 색으로 채워진다", () => {
    const host = document.createElement("div"); document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(h(WorkStatusBar, { items: [item("a", "waiting"), item("b", "progress"), item("c", "progress")], onNavigate: vi.fn() })));
    const bar = host.querySelector("[data-work-status-bar]") as HTMLElement;
    vi.spyOn(bar, "getBoundingClientRect").mockReturnValue({ left: 100, top: 0, right: 1100, bottom: 40, width: 1000, height: 40 } as DOMRect);
    const progress = host.querySelector('[aria-label="진행 2건"]') as HTMLElement;
    act(() => { progress.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, clientX: 500 })); });
    let pop = host.querySelector("[data-work-status-popover]") as HTMLElement;
    expect(pop).not.toBeNull();
    expect(pop.style.left).toBe("384px"); // 500 - 100 - 16
    const banner = pop.querySelector("[data-work-status-banner]") as HTMLElement;
    expect(banner.textContent).toContain("진행 2건");
    expect(banner.className).toContain("from-sky-400");
    // 오른쪽 끝에서 들어오면 폭(360) 만큼 안쪽으로 당긴다.
    const waiting = host.querySelector('[aria-label="진행대기 1건"]') as HTMLElement;
    act(() => { waiting.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, clientX: 1090 })); });
    pop = host.querySelector("[data-work-status-popover]") as HTMLElement;
    expect(parseFloat(pop.style.left)).toBeLessThanOrEqual(1000 - parseFloat(pop.style.width));
    expect(pop.querySelector("[data-work-status-banner]")!.className).toContain("bg-slate-300");
    act(() => root.unmount()); host.remove();
  });
});
