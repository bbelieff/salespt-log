// @vitest-environment jsdom
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DbPage from "@/app/(app)/db/page";
import ContactPage from "@/app/(app)/contact/page";
import DirtyProvider from "@/components/DirtyGuard";
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
const mocks = vi.hoisted(() => ({ save: vi.fn().mockResolvedValue({}), append: vi.fn().mockResolvedValue({}) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/TopHeader", () => ({ default: () => null }));
vi.mock("@/components/weekly-goals/WeeklyGoalSummary", () => ({ default: () => null }));
vi.mock("@/app/(app)/db/_components/DbNudgeBanner", () => ({ default: () => null }));
vi.mock("@/query/db-hooks", () => ({
 useDBOverview: () => ({ data: { purchases: [], productions: [], banners: [], leads: [] }, isLoading: false }),
 useLeadCandidates: () => ({ data: [] }),
 useAppendDB: () => ({ mutateAsync: mocks.append }),
 usePatchDB: () => ({ mutateAsync: vi.fn() }), useRemoveDB: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/query/contact-hooks", () => ({
 useDay: (date: string) => ({ data: { date, courseStart: "2026-09-04", channels: Object.fromEntries(["매입DB", "직접생산", "현수막", "콜·지·기·소"].map(c => [c, { production: 0, inflow: 0, contactProgress: 0, meetingReservation: 0 }])), meetings: [], inflowWaitBase: 100, bannerStockBase: 10 } }),
 useMeetingScheduleWeeks: () => [], useWeekMeetings: () => ({ data: undefined }), useSaveMetrics: () => ({ mutateAsync: mocks.save }),
 useAppendMeeting: () => ({ mutateAsync: vi.fn() }), usePatchMeeting: () => ({ mutateAsync: vi.fn() }),
 useMoveDailyMetrics: () => ({ mutateAsync: vi.fn() }), useRemoveMeeting: () => ({ mutateAsync: vi.fn() }),
}));
let root: Root, el: HTMLDivElement;
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); history.replaceState({}, "", "/"); el=document.createElement("div"); document.body.append(el); root=createRoot(el); });
afterEach(() => { act(() => root.unmount()); el.remove(); });
function render(page: React.ReactNode) { act(() => root.render(h(DirtyProvider, null, page))); }
function button(text: string) { const b=[...el.querySelectorAll("button")].find(x => x.textContent?.trim() === text && !x.closest("[hidden]")); if(!b) throw Error(`Missing ${text}`); return b; }
function click(b: HTMLElement) { act(() => b.click()); }
function input(node: HTMLInputElement, value: string) { act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(node,value); node.dispatchEvent(new Event("input",{bubbles:true})); }); }
describe("low-click input flow", () => {
 it("starts without a channel and opens new input in one click", () => {
  render(h(DbPage)); expect(el.querySelector("input")).toBeNull();
  click(button("매입DB")); expect(el.querySelector("input")).not.toBeNull();
  expect(el.querySelector('[aria-pressed="true"]')?.textContent).toBe("매입DB");
  expect(el.textContent).not.toContain("저장하지 않고 나갈까요?");
 });
 it("preserves the actual DB form across channel switches without prompting", () => {
  render(h(DbPage)); click(button("매입DB"));
  const field=el.querySelector<HTMLInputElement>('input[type="text"]')!; input(field,"draft-example");
  click(button("직접생산")); expect(field.closest("[hidden]")).not.toBeNull();
  click(button("매입DB")); expect(field.value).toBe("draft-example"); expect(field.closest("[hidden]")).toBeNull();
  expect(el.textContent).not.toContain("저장하지 않고 나갈까요?"); expect(mocks.append).not.toHaveBeenCalled();
 });
 it("honors DB deep links with no extra selection", () => {
  history.replaceState({},"","/?channel=현수막&focus=add"); render(h(DbPage));
  expect(el.querySelector('[aria-pressed="true"]')?.textContent).toBe("현수막"); expect(el.querySelector("input")).not.toBeNull();
 });
 it("keeps channel metrics and protects a dirty date change", () => {
  render(h(ContactPage));
  click(el.querySelector<HTMLElement>('[aria-label="유입 증가"]')!);
  click(button("직접생산·")); click(button("매입DB1"));
  expect(el.querySelector<HTMLInputElement>('[aria-label="유입 수치"]')?.value).toBe("1");
  expect(el.textContent).not.toContain("저장하지 않고 나갈까요?");
  click(el.querySelector<HTMLElement>('[aria-label="이전 주차"]')!);
  expect(el.textContent).toContain("저장하지 않고 나갈까요?");
 });
 it("restores recent channel but gives an explicit link precedence", () => {
  sessionStorage.setItem("salespt-contact-channel","직접생산"); history.replaceState({},"","/?channel=현수막&date=2026-09-11");
  render(h(ContactPage)); expect(el.querySelector('button[aria-grabbed][aria-pressed="true"]')?.textContent).toContain("현수막");
  expect(el.textContent).toContain("9/11 기록 저장");
 });
});
vi.mock("@/app/(app)/contact/_components/RecordMoveModal", () => ({ default: () => null }));


it("saves the displayed date and preserves values from both channels", async () => {
 history.replaceState({},"","/?date=2026-09-11&channel=매입DB"); render(h(ContactPage));
 click(el.querySelector<HTMLElement>('[aria-label="유입 증가"]')!);
 click(button("직접생산·")); click(el.querySelector<HTMLElement>('[aria-label="컨택진행 증가"]')!);
 await act(async () => { button("💾 9/11 기록 저장").click(); });
 expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({date:"2026-09-11",channels:expect.objectContaining({매입DB:expect.objectContaining({inflow:1}),직접생산:expect.objectContaining({contactProgress:1})})}));
});
it("restores recent channel when no link channel was specified", () => {
 sessionStorage.setItem("salespt-contact-channel","직접생산"); render(h(ContactPage));
 expect(el.querySelector('button[aria-grabbed][aria-pressed="true"]')?.textContent).toContain("직접생산");
});
