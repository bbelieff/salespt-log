// @vitest-environment jsdom

import * as React from "react";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

let task = "경쟁사 분석\n스크립트 보완";
let resizeCallback: ResizeObserverCallback | undefined;
const observe = vi.fn();
const disconnect = vi.fn();

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("@/components/DirtyGuard", () => ({ useGuardedRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/weekly-goals/client", () => ({
  useGoalView: () => ({
    data: {
      current: {
        week: 2,
        start: "2026-09-11",
        end: "2026-09-17",
        record: { goals: { production: 10, inflow: 10, contacts: 10, meetings: 10, contracts: 1 }, task },
        actuals: { production: 12, inflow: 3, contacts: 2, meetings: 1, contracts: 1 },
      },
    },
  }),
}));

import WeeklyGoalSummary from "@/components/weekly-goals/WeeklyGoalSummary";
import GoalRings from "@/components/weekly-goals/GoalRings";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

function render(element: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(element));
  return container;
}

function rerender(element: ReactNode) {
  act(() => root?.render(element));
}

function setMeasuredLines(lines: number) {
  const measure = container?.querySelector<HTMLElement>(".weekly-goals-task-measure");
  expect(measure).not.toBeNull();
  Object.defineProperty(measure, "clientHeight", { value: Math.min(lines, 2) * 18, configurable: true });
  Object.defineProperty(measure, "scrollHeight", { value: lines * 18, configurable: true });
  act(() => resizeCallback?.([], {} as ResizeObserver));
}

function visibleTaskText() {
  return container?.querySelector(".weekly-goals-task-copy")?.textContent;
}

beforeEach(() => {
  task = "경쟁사 분석\n스크립트 보완";
  resizeCallback = undefined;
  observe.mockClear();
  disconnect.mockClear();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }
      observe = observe;
      unobserve = vi.fn();
      disconnect = disconnect;
    },
  );
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  vi.unstubAllGlobals();
});

describe("dashboard weekly goal presentation", () => {
  it("provides a whole-card entry, separate week controls, and labeled PT tasks without remainder row", () => {
    const html = renderToStaticMarkup(createElement(WeeklyGoalSummary));
    expect(html).toContain('aria-label="주간 목표·PT과제 상세 보기"');
    expect(html).toContain('aria-label="이전 주차 목표"');
    expect(html).toContain("이번 주 PT과제");
    expect(html).toContain("경쟁사 분석");
    expect(html).not.toContain("초과");
    expect(html).not.toContain("남음");
    expect(html).not.toContain("목표·PT과제 열기");
  });

  it("keeps text that fits two rendered lines and replaces overflow with the valid row count", () => {
    render(createElement(WeeklyGoalSummary));
    setMeasuredLines(2);
    expect(visibleTaskText()).toBe("경쟁사 분석\n스크립트 보완");

    setMeasuredLines(3);
    expect(visibleTaskText()).toBe("2건");
    expect(container?.querySelector(".weekly-goals-task-measure")?.getAttribute("aria-hidden")).toBe("true");
  });

  it.each([
    ["   \r\n \n", 3, "0건"],
    ["한 줄이지만 실제 폭에서는 매우 길게 감기는 과제", 4, "1건"],
    ["첫 과제\r\n둘째 과제\r\n\r\n첫 과제", 4, "3건"],
  ])("counts normalized task rows for %j", (nextTask, lines, expected) => {
    task = nextTask;
    render(createElement(WeeklyGoalSummary));
    setMeasuredLines(lines);
    expect(visibleTaskText()).toBe(expected);
  });

  it("remeasures after task, week/student identity, and width changes, then disconnects", () => {
    render(createElement(WeeklyGoalSummary, { date: "2026-09-11", student: "student-a" }));
    expect(observe).toHaveBeenCalled();
    setMeasuredLines(3);
    expect(visibleTaskText()).toBe("2건");

    task = "짧은 과제";
    rerender(createElement(WeeklyGoalSummary, { date: "2026-09-18", student: "student-b" }));
    setMeasuredLines(1);
    expect(visibleTaskText()).toBe("짧은 과제");

    setMeasuredLines(3);
    expect(visibleTaskText()).toBe("1건");
    act(() => root?.unmount());
    root = undefined;
    expect(disconnect).toHaveBeenCalled();
  });

  it("preserves the explicit entry for compact business-tab summaries", () => {
    expect(renderToStaticMarkup(createElement(WeeklyGoalSummary, { compact: true }))).toContain('aria-label="목표·PT과제 열기"');
  });

  it("preserves remainder feedback in the goal editor by default", () => {
    const html = renderToStaticMarkup(createElement(GoalRings, { metrics: ["contracts"], goals: { production: 0, inflow: 0, contacts: 0, meetings: 0, contracts: 3 }, actuals: { production: 0, inflow: 0, contacts: 0, meetings: 0, contracts: 1 } }));
    expect(html).toContain("2 남음");
  });
});
