// @vitest-environment jsdom
/**
 * 수료 후에는 PT과제가 없다(belie 2026-11-25) — 주간 목표 화면에서 「PT과제」 글자·입력,
 * 클립보드 복사, 회의록 열기를 감춘다. 저장된 과제 글은 지우지 않는다.
 */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WeeklyGoalView } from "@/types/weekly-goals";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const GOALS = { production: 10, inflow: 8, contacts: 6, meetings: 3, contracts: 1 };
const ZERO = { production: 0, inflow: 0, contacts: 0, meetings: 0, contracts: 0 };

function makeView(over: Partial<WeeklyGoalView> = {}): WeeklyGoalView {
  const week = (n: number, start: string, end: string, task: string) =>
    ({ week: n, start, end, record: { goals: { ...GOALS }, task, revision: 4, updatedAt: null }, actuals: { ...ZERO } });
  return {
    student: { email: "s@example.invalid", name: "가상 수강생", cohort: "연습", courseStart: "2026-09-04", region: "합성", trainers: [] },
    current: week(14, "2026-12-04", "2026-12-10", "남아 있는 과제"),
    previous: week(13, "2026-11-27", "2026-12-03", "지난 과제"),
    reporting: { start: "2026-11-27", end: "2026-12-03", actuals: { ...ZERO } },
    cumulative: { ...ZERO },
    canReadInternal: false,
    ...over,
  };
}

const net = vi.hoisted(() => ({ view: null as unknown, puts: [] as Array<{ url: string; body: unknown }> }));

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("@/components/DirtyGuard", () => ({
  useGuardedRouter: () => ({ push: vi.fn() }),
  useGuardedNav: () => (fn: () => void) => fn(),
  useDirtyEntry: () => {},
}));
vi.mock("@/components/weekly-goals/useGoalHistoryGuard", () => ({ useGoalHistoryGuard: () => {} }));
vi.mock("@/components/weekly-goals/client", () => ({
  useGoalView: () => ({ data: net.view }),
  goalAccessDenied: () => false,
  goalParams: () => "mock-view-params",
  goalJSON: (url: string, body?: unknown) => {
    if (body === undefined) return Promise.resolve({ revision: 0, specialNotes: "", priorOutcome: "", updatedAt: null });
    net.puts.push({ url, body });
    return Promise.resolve({ revision: 5 });
  },
}));

import WeeklyGoalEditor from "@/components/weekly-goals/WeeklyGoalEditor";
import WeeklyGoalSummary from "@/components/weekly-goals/WeeklyGoalSummary";

let root: Root | undefined;
let el: HTMLDivElement | undefined;

function mount(node: React.ReactNode) {
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
  act(() => root!.render(node));
  return el;
}
const editor = (view: WeeklyGoalView) => mount(h(WeeklyGoalEditor, { view, changeWeek: () => {}, reload: () => {} }));

beforeEach(() => {
  net.puts = [];
  vi.useFakeTimers();
});
afterEach(() => {
  act(() => root?.unmount());
  el?.remove();
  root = undefined;
  el = undefined;
  vi.useRealTimers();
});

describe("수료 후 주간 목표 편집 화면", () => {
  it("PT과제 글자·입력, 클립보드 복사가 없다", () => {
    const host = editor(makeView({ graduated: true }));
    expect(host.textContent).not.toContain("PT과제");
    expect(host.textContent).not.toContain("클립보드");
    expect(host.querySelector('input[aria-label="이번 주 PT과제 1번"]')).toBeNull();
    expect(host.querySelector('input[aria-label="이번 목표 생산"]')).not.toBeNull();
  });

  it("트레이너가 수료생을 봐도 회의록 열기·복사·PT과제 성과가 없고 특이사항은 남는다", async () => {
    const host = editor(makeView({ graduated: true, canReadInternal: true }));
    await act(async () => { await Promise.resolve(); });
    expect(host.textContent).not.toContain("회의록");
    expect(host.textContent).not.toContain("클립보드");
    expect(host.textContent).not.toContain("PT과제");
    expect(host.querySelector('textarea[aria-label="트레이닝 후 특이사항"]')).not.toBeNull();
  });

  it("목표만 고쳐도 저장돼 있던 과제 글은 그대로 보낸다", async () => {
    const host = editor(makeView({ graduated: true }));
    const input = host.querySelector<HTMLInputElement>('input[aria-label="이번 목표 생산"]')!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
      setValue.call(input, "12");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(net.puts).toHaveLength(1);
    expect(net.puts[0]!.body).toMatchObject({ goals: { production: 12 }, task: "남아 있는 과제" });
  });

  it("수강 중에는 그대로 보인다", () => {
    const host = editor(makeView());
    expect(host.querySelector('input[aria-label="이번 주 PT과제 1번"]')).not.toBeNull();
    expect(host.textContent).toContain("클립보드 복사");
    expect(host.textContent).toContain("지난 PT과제");
  });
});

describe("수료 후 주간 목표 카드", () => {
  it("PT과제 미리보기 없이 목표만 보인다", () => {
    net.view = makeView({ graduated: true });
    const host = mount(h(WeeklyGoalSummary, {}));
    expect(host.textContent).not.toContain("PT과제");
    expect(host.querySelector(".weekly-goals-qualitative")).toBeNull();
    expect(host.querySelector(".weekly-goals-quantitative")).not.toBeNull();
    expect(host.querySelector('[aria-label="주간 목표 상세 보기"]')).not.toBeNull();
  });

  it("수강 중에는 PT과제 미리보기가 보인다", () => {
    net.view = makeView();
    const host = mount(h(WeeklyGoalSummary, {}));
    expect(host.textContent).toContain("이번 주 PT과제");
    expect(host.querySelector('[aria-label="주간 목표·PT과제 상세 보기"]')).not.toBeNull();
  });
});
