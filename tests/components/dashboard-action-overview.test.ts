import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/weekly-goals/WeeklyGoalSummary", () => ({ default: () => createElement("section", {}, "weekly-goals") }));
vi.mock("@/components/dashboard/ProductivityIndicators", () => ({ default: () => createElement("section", {}, "productivity") }));
vi.mock("@/components/dashboard/DashboardFollowUps", () => ({ default: () => createElement("section", {}, "follow-ups") }));
vi.mock("@/components/dashboard/DashboardWorkStatus", () => ({ default: () => createElement("section", {}, "work-status") }));
vi.stubGlobal("React", React);
import DashboardActionOverview from "@/components/dashboard/DashboardActionOverview";

describe("dashboard shows all action cards from the first week", () => {
  it.each([
    ["2026-01-02", "2026-01-02", 12, false], // first day
    ["2026-01-02", "2026-02-26", 12, false], // last day of week 8
    ["2026-01-02", "2026-02-27", 12, true], // first day of week 9
    ["2026-01-02", "2026-02-27", 8, true], // legacy course must not clamp at 8
    [undefined, "2026-02-27", 8, false], // unknown start: stable goal-first fallback
    ["", "2026-02-27", 12, false],
    ["2026-03-01", "2026-02-27", 12, false], // pre-course
  ] as const)("start=%s today=%s course=%s follow-ups-first=%s", (courseStartISO, todayISO, weeks, workFirst) => {
    const html = renderToStaticMarkup(createElement(DashboardActionOverview, { matrix: [], weeks, todayISO, courseStartISO }));
    for (const name of ["productivity", "weekly-goals", "follow-ups", "work-status"]) expect(html.match(new RegExp(`>${name}<`, "g"))).toHaveLength(1);
    expect(html.indexOf(">follow-ups<") < html.indexOf(">weekly-goals<")).toBe(workFirst);
    expect(html.indexOf(">work-status<")).toBeLessThan(html.indexOf(">follow-ups<"));
  });
});
