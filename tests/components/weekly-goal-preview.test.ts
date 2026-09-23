// @vitest-environment jsdom
import * as React from "react";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import GoalCopyPanel from "@/components/weekly-goals/GoalCopyPanel";
import { EMPTY_GOALS, type WeeklyGoalView, type WeeklyGoalPrivateRecord } from "@/types/weekly-goals";
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
const view: WeeklyGoalView = {
  student: { email: "fixture@example.test", name: "Fixture", cohort: "test", courseStart: "2026-09-04", region: "Region", trainers: [] },
  current: { week: 2, start: "2026-09-11", end: "2026-09-17", record: { goals: { ...EMPTY_GOALS }, task: "Before", revision: 1, updatedAt: null }, actuals: { production: 0, inflow: 0, contacts: 0, meetings: 0, contracts: 0 } },
  reporting: { start: "2026-09-18", end: "2026-09-24", actuals: { production: 0, inflow: 0, contacts: 0, meetings: 4, contracts: 2 } },
  previous: null, cumulative: { production: 0, inflow: 0, contacts: 0, meetings: 0, contracts: 0 }, canReadInternal: true,
};
const internal: WeeklyGoalPrivateRecord = { specialNotes: "Notes", priorOutcome: "Outcome", revision: 1, updatedAt: null };
const host = document.createElement("div");
document.body.append(host);
let root = createRoot(host);
afterEach(() => { vi.unstubAllGlobals(); act(() => root.unmount()); root = createRoot(host); });
it("keeps the fourteen-column row live and replaces the expanded preview with the canonical Notion link", () => {
  const render = (v: WeeklyGoalView, record: WeeklyGoalPrivateRecord | undefined, dirty = false) => act(() => root.render(createElement(GoalCopyPanel, { view: v, internal: record, dirty })));
  render(view, internal);
  expect(Array.from(host.querySelectorAll("th")).map(t => t.textContent)).toEqual(["지역", "기수", "수강생", "담당T", "금주미팅", "금주계약", "트레이닝 후 특이사항", "지난주 PT과제(성과)", "이번주 PT과제", "목표생산", "목표 유입", "목표 컨택", "목표미팅", "목표계약"]);
  const link = Array.from(host.querySelectorAll("a")).find(a => a.textContent === "회의록 Notion 열기")!;
  expect(link.href).toBe("https://app.notion.com/p/3083fa7fca00806fae60ea8eae34511e");
  expect(link.target).toBe("_blank");
  expect(link.rel).toContain("noopener");
  expect(host.querySelector('textarea[aria-label^="회의록 "]')).toBeNull();
  render({ ...view, current: { ...view.current, record: { ...view.current.record, task: "Changed", goals: { ...EMPTY_GOALS, production: 9 } } } }, { ...internal, priorOutcome: "Changed outcome", specialNotes: "Changed notes" }, true);
  expect(Array.from(host.querySelectorAll("td")).map(td => td.textContent).slice(6, 10)).toEqual(["Changed notes", "Changed outcome", "Changed", "9"]);
  expect(Array.from(host.querySelectorAll("button")).find(b => b.textContent === "클립보드 복사")!.disabled).toBe(true);
  expect(Array.from(host.querySelectorAll("a")).some(a => a.textContent === "회의록 Notion 열기")).toBe(true);
  render({ ...view, student: { ...view.student, region: "Other region", cohort: "Next cohort", trainers: ["Trainer B"] }, current: { ...view.current, actuals: { ...view.current.actuals, meetings: 8, contracts: 3 } } }, internal);
  expect(Array.from(host.querySelectorAll("td")).map(td => td.textContent).slice(0, 6)).toEqual(["Other region", "Next cohort", "Fixture", "Trainer B", "4", "2"]);
  render(view, undefined);
  expect(Array.from(host.querySelectorAll("a")).some(a => a.textContent === "회의록 Notion 열기")).toBe(true);
});

it("copies the displayed Notion row without a header and never falls back while internal data is loading", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  act(() => root.render(createElement(GoalCopyPanel, { view, dirty: false })));
  const copy = () => Array.from(host.querySelectorAll("button")).find(b => b.textContent === "클립보드 복사")!;
  expect(copy().disabled).toBe(true);
  act(() => root.render(createElement(GoalCopyPanel, { view, internal, dirty: false })));
  await act(async () => copy().click());
  const plain = writeText.mock.calls[0]![0] as string;
  expect(plain.split("\t")).toHaveLength(14);
  expect(plain.split("\t").slice(6, 9)).toEqual(["Notes", "Outcome", "Before"]);
  expect(plain).not.toContain("\n");
  expect(plain.startsWith("Region\ttest\tFixture\t")).toBe(true);
});

it("never exposes the internal Notion destination in a public view", () => {
  act(() => root.render(createElement(GoalCopyPanel, { view: { ...view, canReadInternal: false }, dirty: false })));
  expect(Array.from(host.querySelectorAll("a")).some(a => a.textContent === "회의록 Notion 열기")).toBe(false);
  expect(host.textContent).not.toContain("app.notion.com");
});
