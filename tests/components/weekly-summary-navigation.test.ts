// @vitest-environment jsdom

import * as React from "react";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const state = vi.hoisted(() => ({
  pushes: [] as string[],
  overrideWeek: 0,
  pending: false,
  error: false,
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("@/components/DirtyGuard", () => ({
  useGuardedRouter: () => ({
    push: (href: string) => { state.pushes.push(href); },
  }),
}));
vi.mock("@/components/weekly-goals/client", () => ({
  useGoalView: (params: string) => {
    if (state.pending) {
      return { data: undefined, isPending: true, isError: false, isFetching: false, refetch: vi.fn() };
    }
    if (state.error) {
      return { data: undefined, isPending: false, isError: true, isFetching: false, refetch: vi.fn() };
    }
    const toUTC = (iso: string) => {
      const parts = iso.split("-").map(Number);
      return Date.UTC(parts[0] as number, (parts[1] as number) - 1, parts[2] as number);
    };
    const date = new URLSearchParams(params).get("date") ?? "2026-09-11";
    const week = state.overrideWeek || 2 + Math.round((toUTC(date) - toUTC("2026-09-11")) / 86400000 / 7);
    const end = new Date(toUTC(date) + 6 * 86400000).toISOString().slice(0, 10);
    return {
      data: {
        current: {
          week,
          start: date,
          end,
          record: {
            goals: { production: 1, inflow: 1, contacts: 1, meetings: 1, contracts: 1 },
            task: "",
          },
          actuals: { production: 0, inflow: 0, contacts: 0, meetings: 0, contracts: 0 },
        },
      },
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    };
  },
}));

import WeeklyGoalSummary from "@/components/weekly-goals/WeeklyGoalSummary";

const ANCHOR = "2026-09-11";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

function render(element: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(element));
  if (!container) throw new Error("render container is missing");
  return container;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  state.pushes.length = 0;
  state.overrideWeek = 0;
  state.pending = false;
  state.error = false;
});

function byLabel(label: string) {
  const el = container?.querySelector(`button[aria-label="${label}"]`);
  if (!el || !(el instanceof HTMLButtonElement)) throw new Error(`button '${label}' is missing`);
  return el;
}

function byText(text: string) {
  const el = [...(container?.querySelectorAll("button") ?? [])].find(
    candidate => candidate.textContent?.trim() === text,
  );
  if (!el || !(el instanceof HTMLButtonElement)) throw new Error(`button '${text}' is missing`);
  return el;
}

function click(el: HTMLButtonElement) {
  act(() => { el.click(); });
}

function text() {
  return container?.textContent ?? "";
}

function summary() {
  return render(createElement(WeeklyGoalSummary, { date: ANCHOR }));
}

describe("weekly summary future-week navigation", () => {
  it("moves current -> future on NEXT", () => {
    summary();
    const next = byLabel("다음 주차 목표");
    expect(next.disabled).toBe(false);
    click(next);
    expect(text()).toContain("2026-09-18");
    expect(text()).toContain("3주차");
    expect(byText("선택 주").disabled).toBe(false);
  });

  it("keeps moving future -> future on NEXT", () => {
    summary();
    click(byLabel("다음 주차 목표"));
    click(byLabel("다음 주차 목표"));
    expect(text()).toContain("2026-09-25");
    expect(text()).toContain("4주차");
  });

  it("returns to the anchor and resets the selection on BACK", () => {
    summary();
    click(byLabel("다음 주차 목표"));
    click(byLabel("이전 주차 목표"));
    expect(text()).toContain(ANCHOR);
    expect(text()).toContain("2주차");
    expect(byText("선택 주").disabled).toBe(true);
  });

  it("goes back and keeps the previous-week minimum at week 1", () => {
    summary();
    click(byLabel("이전 주차 목표"));
    expect(text()).toContain("2026-09-04");
    expect(text()).toContain("1주차");
    expect(byLabel("이전 주차 목표").disabled).toBe(true);
    expect(byText("선택 주").disabled).toBe(false);
  });

  it("resets to the current week", () => {
    summary();
    click(byLabel("다음 주차 목표"));
    click(byText("선택 주"));
    expect(text()).toContain(ANCHOR);
    expect(byText("선택 주").disabled).toBe(true);
  });

  it("preserves the future date in the detail URL", () => {
    summary();
    click(byLabel("다음 주차 목표"));
    click(byLabel("주간 목표·PT과제 상세 보기"));
    expect(state.pushes).toHaveLength(1);
    expect(state.pushes[0]).toContain("date=2026-09-18");
  });

  it("disables NEXT at the API upper guard (week 5200)", () => {
    state.overrideWeek = 5200;
    summary();
    expect(byLabel("다음 주차 목표").disabled).toBe(true);
  });

  it("keeps NEXT enabled just below the upper guard", () => {
    state.overrideWeek = 5199;
    summary();
    expect(byLabel("다음 주차 목표").disabled).toBe(false);
  });

  it("retains the loading and error states", () => {
    state.pending = true;
    summary();
    expect(text()).toContain("불러오는 중…");
    act(() => root?.unmount());
    container?.remove();

    state.pending = false;
    state.error = true;
    summary();
    expect(text()).toContain("목표를 불러오지 못했어요.");
  });
});
