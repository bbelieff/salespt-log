// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FollowUpsLauncherView from "@/components/dashboard/FollowUpsLauncherView";
import DashboardFollowUpsView from "@/components/dashboard/DashboardFollowUpsView";
import { hasOverdueFollowUps, topUrgentFollowUps, type FollowUpGroup, type FollowUpItem } from "@/lib/analytics/dashboard-follow-ups";
vi.mock("next/link", () => ({ default: (props: React.ComponentProps<"a">) => React.createElement("a", props) }));
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const make = (index: number, group: FollowUpGroup, days: number | null): FollowUpItem => ({
  key: `example:${index}`, kind: "overdue", step: index % 2 ? "2" : "4", group,
  title: `샘플 업체${index}`, company: `샘플 업체${index}`, detail: "합성 상세",
  badge: days === null ? "날짜 확인" : days === 0 ? "오늘" : `D${days > 0 ? "+" : "-"}${String(Math.abs(days)).padStart(2, "0")}`,
  href: `/payment?row=${index + 3}&slot=1`, dueISO: days === null ? null : `2026-09-${String(20 - days).padStart(2, "0")}`, overdueDays: days,
  action: "서류 확인", reasons: ["미완료 투두"], facts: [],
});
const mixed = [make(0, "today", 0), make(1, "overdue", 3), make(2, "long-overdue", 15), make(3, "upcoming", -2), make(4, "today", 0), make(5, "unknown", null), make(6, "overdue", 1), make(7, "today", 0)];
const calm = [make(0, "today", 0), make(1, "upcoming", -1), make(2, "unknown", null)];

let root: Root, host: HTMLDivElement;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });
const render = (el: React.ReactElement) => act(() => root.render(el));
const fab = () => host.querySelector<HTMLButtonElement>(".fl-fab")!;
const pop = () => host.querySelector<HTMLElement>(".fl-pop")!;
const click = (el: Element) => act(() => (el as HTMLElement).click());

describe("오늘 챙길 일 강조 규칙", () => {
  it("경과 또는 장기누락이 있을 때만 움직이는 테두리", () => {
    expect(hasOverdueFollowUps(mixed)).toBe(true);
    expect(hasOverdueFollowUps([make(0, "long-overdue", 9)])).toBe(true);
    expect(hasOverdueFollowUps([make(0, "overdue", 1)])).toBe(true);
    expect(hasOverdueFollowUps(calm)).toBe(false);
    expect(hasOverdueFollowUps([])).toBe(false);
  });
  it("카드에 data-emphasis=flow 를 지연이 있을 때만 단다", () => {
    render(React.createElement(DashboardFollowUpsView, { items: mixed }));
    expect(host.querySelector("[data-dashboard-follow-ups]")?.getAttribute("data-emphasis")).toBe("flow");
    render(React.createElement(DashboardFollowUpsView, { items: calm }));
    expect(host.querySelector("[data-dashboard-follow-ups]")?.hasAttribute("data-emphasis")).toBe(false);
  });
});

describe("우하단 빠른 보기", () => {
  it("예정을 뺀 긴급순 5건과 나머지 건수", () => {
    const { top, rest, total } = topUrgentFollowUps(mixed);
    expect(total).toBe(7);
    expect(rest).toBe(2);
    expect(top.map(i => i.group)).toEqual(["long-overdue", "overdue", "overdue", "today", "today"]);
  });
  it("배지 = 오늘 건수, 0건이면 배지를 숨긴다", () => {
    render(React.createElement(FollowUpsLauncherView, { items: mixed }));
    expect(host.querySelector(".fl-count")?.textContent).toBe("7");
    render(React.createElement(FollowUpsLauncherView, { items: [make(0, "upcoming", -3)] }));
    expect(host.querySelector(".fl-count")).toBeNull();
    expect(fab()).not.toBeNull();
  });
  it("열기·× 닫기·Esc 닫기, 초점은 버튼으로 돌아온다", () => {
    render(React.createElement(FollowUpsLauncherView, { items: mixed }));
    expect(fab().getAttribute("aria-expanded")).toBe("false");
    expect(fab().getAttribute("aria-controls")).toBe(pop().id);
    expect(pop().hasAttribute("inert")).toBe(true);
    click(fab());
    expect(fab().getAttribute("aria-expanded")).toBe("true");
    expect(pop().dataset.open).toBe("true");
    expect(pop().hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(pop());
    const items = pop().querySelectorAll(".fl-item");
    expect(items).toHaveLength(5);
    expect(items[0]?.querySelector(".ft-badge")?.textContent).toBe("D+15");
    expect(items[0]?.querySelector("a")?.getAttribute("href")).toBe("/payment?row=5&slot=1");
    expect(pop().querySelector(".fl-foot")?.textContent).toContain("대시보드에서 2건 더 보기");
    expect(pop().querySelector(".fl-foot .fl-report")?.textContent).toContain("오류신고");
    click(pop().querySelector(".fl-close")!);
    expect(fab().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(fab());
    click(fab());
    act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(pop().dataset.open).toBe("false");
    expect(document.activeElement).toBe(fab());
  });
  it("바깥을 누르면 닫히고, 창 안을 누르면 유지", () => {
    render(React.createElement(FollowUpsLauncherView, { items: mixed }));
    click(fab());
    act(() => { pop().querySelector(".fl-head")!.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true })); });
    expect(pop().dataset.open).toBe("true");
    act(() => { document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true })); });
    expect(pop().dataset.open).toBe("false");
  });
  it("0건이면 기존 빈 상태를 보여준다", () => {
    render(React.createElement(FollowUpsLauncherView, { items: [] }));
    click(fab());
    expect(pop().querySelector(".ft-empty")?.textContent).toContain("지금 처리할 일이 없어요");
  });
});
