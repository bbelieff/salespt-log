// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardFollowUpsView from "@/components/dashboard/DashboardFollowUpsView";
import type { FollowUpItem } from "@/lib/analytics/dashboard-follow-ups";
vi.mock("next/link", () => ({ default: (props: React.ComponentProps<"a">) => React.createElement("a", props) }));
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement;
const records: FollowUpItem[] = [0, 3, 26, 9, 22, 3, 14].map((days, index) => ({
  key: `example:${index}`, kind: "overdue", step: "4", group: days >= 7 ? "long-overdue" : days ? "overdue" : "today",
  title: `샘플 업체${index}`, company: `샘플 업체${index}`, detail: "합성 상세", badge: days ? `D+${days}` : "오늘",
  href: `/payment?row=${index + 3}&slot=1`, dueISO: `2026-09-${String(30 - days).padStart(2, "0")}`, overdueDays: days,
  action: "서류 확인", reasons: ["미완료 투두"], facts: [{ label: "기관", value: "합성 기관" }],
}));
beforeEach(() => { vi.useFakeTimers(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); });
const render = (items = records, incomplete = false) => act(() => root.render(React.createElement(DashboardFollowUpsView, { items, incomplete })));
const dialog = () => document.querySelector<HTMLElement>("[role=dialog]");
function row(index = 3): HTMLElement {
  const element = host.querySelectorAll<HTMLElement>(".ft-summary-row")[index];
  if (!element) throw new Error(`Expected STEP row at index ${index}`);
  return element;
}
const click = (element: Element) => act(() => (element as HTMLElement).click());
function pointer(element: Element, type: string, relatedTarget: Element | null = null) {
  act(() => { const event = new MouseEvent(type, { bubbles: true, relatedTarget }); Object.defineProperty(event, "pointerType", { value: "mouse" }); element.dispatchEvent(event); });
}
const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));
describe("follow-up table interactions", () => {
  it("uses a single heading and omits repeated STEP labels in a step-specific list", () => {
    render(); click(row().querySelector("button")!);
    expect(dialog()!.querySelector("h3")!.textContent).toContain("실무/수납 · 전체");
    expect([...dialog()!.querySelectorAll("tbody small")].some(e => e.textContent?.includes("STEP"))).toBe(false);
    click(dialog()!.querySelector(".ft-action")!);
    expect(dialog()!.querySelector(".ft-expanded")!.textContent).toContain("기준일");
  });
  it("opens to the right on desktop and stays inside the viewport after a mobile resize", () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    const rect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("ft-card")) return { left: 220, right: 700, top: 200, bottom: 600, width: 480, height: 400 } as DOMRect;
      if (this.classList.contains("ft-panel")) return { left: 0, right: 500, top: 0, bottom: 200, width: 500, height: 200 } as DOMRect;
      return { left: 230, right: 690, top: 300, bottom: 340, width: 460, height: 40 } as DOMRect;
    });
    try {
      render(); click(row().querySelector("button")!);
      expect(parseFloat(dialog()!.style.left)).toBeGreaterThan(700);
      expect(parseFloat(dialog()!.style.left) + parseFloat(dialog()!.style.width)).toBeLessThanOrEqual(1280);
      act(() => { Object.defineProperty(window, "innerWidth", { configurable: true, value: 320 }); window.dispatchEvent(new Event("resize")); });
      expect(parseFloat(dialog()!.style.left)).toBeGreaterThanOrEqual(12);
      expect(parseFloat(dialog()!.style.left) + parseFloat(dialog()!.style.width)).toBeLessThanOrEqual(308);
    } finally {
      rect.mockRestore(); Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
    }
  });
  it("shows seven urgency-sorted rows with exact links and expandable reasons", () => {
    render(); click(row().querySelector("button")!);
    expect(dialog()!.querySelectorAll("tbody > tr")).toHaveLength(7);
    expect([...dialog()!.querySelectorAll(".ft-badge")].map(e => e.textContent)).toEqual(["D+26", "D+22", "D+14", "D+9", "D+3", "D+3", "오늘"]);
    expect(dialog()!.querySelector(".ft-go")!.getAttribute("href")).toBe("/payment?row=5&slot=1");
    click(dialog()!.querySelector(".ft-action")!);
    expect(dialog()!.textContent).toContain("미완료 투두");
    expect(dialog()!.textContent).toContain("합성 기관");
  });
  it("keeps zero stages visible and distinguishes incomplete data from an empty list", () => {
    render([]); expect(host.querySelectorAll(".ft-summary-row")).toHaveLength(4);
    expect([...host.querySelectorAll(".ft-count")].every(e => e.textContent === "0")).toBe(true);
    click(row(0).querySelector("button")!); expect(dialog()!.textContent).toContain("지금 처리할 일이 없어요");
    render([], true); expect([...host.querySelectorAll(".ft-count")].every(e => e.textContent === "—")).toBe(true);
    expect(dialog()!.textContent).toContain("아직 확인하지 못한 항목이 있어요");
    expect(dialog()!.textContent).not.toContain("0건");
  });
  it("hover stays open across the gap, then closes outside both row and panel", () => {
    render(); pointer(row(), "pointerover"); tick(151); expect(dialog()).not.toBeNull();
    pointer(row(), "pointerout", document.body); tick(100);
    pointer(dialog()!, "pointerover", document.body); pointer(dialog()!, "pointermove"); tick(250); expect(dialog()).not.toBeNull();
    pointer(document.body, "pointermove"); tick(201); expect(dialog()).toBeNull();
  });
  it("a click cancels pending hover so a filtered list cannot be replaced after 150ms", () => {
    render(); pointer(row(), "pointerover"); click(row().querySelector('[data-tone="today"]')!); tick(250);
    expect(dialog()!.querySelectorAll("tbody > tr")).toHaveLength(1);
    expect(dialog()!.textContent).toContain("오늘");
    pointer(row(), "pointermove"); pointer(document.body, "pointermove"); tick(201); expect(dialog()).toBeNull();
  });
  it("can hover another step and use keyboard activation without focus being stolen by hover", () => {
    render(); const first = row().querySelector("button")! as HTMLButtonElement;
    act(() => first.focus()); pointer(row(), "pointerover"); tick(151); expect(document.activeElement).toBe(first);
    pointer(row(), "pointerout", row(1)); pointer(row(1), "pointerover", row()); pointer(row(1), "pointermove"); tick(151);
    expect(dialog()!.getAttribute("aria-label")).toContain("STEP 2");
    click(first); expect(document.activeElement).toBe(dialog());
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(dialog()).toBeNull(); expect(document.activeElement).toBe(first);
  });
});
