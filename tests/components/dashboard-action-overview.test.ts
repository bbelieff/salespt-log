import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/weekly-goals/WeeklyGoalSummary", () => ({ default: () => createElement("section", {}, "weekly-goals") }));
vi.mock("@/components/dashboard/ProductivityIndicators", () => ({ default: () => createElement("section", {}, "productivity") }));
vi.mock("@/components/dashboard/DashboardFollowUps", () => ({ default: () => createElement("section", {}, "follow-ups") }));
vi.mock("@/components/dashboard/DashboardWorkStatus", () => ({ default: () => createElement("section", {}, "work-status") }));
vi.mock("@/components/push/PushPrompt", () => ({ default: () => null }));
vi.stubGlobal("React", React);
import DashboardActionOverview from "@/components/dashboard/DashboardActionOverview";

import { readFileSync } from "node:fs";
import { join } from "node:path";

/** belie 2026-10-23 「모바일만 바꿔줘」: 주차와 상관없이 같은 구성, 모바일 순서는 CSS order 로만. */
describe("dashboard shows all action cards from the first week", () => {
  it.each([
    ["2026-01-02", "2026-01-02", 12], // first day
    ["2026-01-02", "2026-02-27", 12], // week 9 — no longer reorders
    [undefined, "2026-02-27", 8],
    ["2026-03-01", "2026-02-27", 12], // pre-course
  ] as const)("start=%s today=%s course=%s renders every card once, PC DOM order fixed", (courseStartISO, todayISO, weeks) => {
    const html = renderToStaticMarkup(createElement(DashboardActionOverview, { matrix: [], weeks, todayISO, courseStartISO }));
    for (const name of ["productivity", "weekly-goals", "follow-ups", "work-status"]) expect(html.match(new RegExp(`>${name}<`, "g"))).toHaveLength(1);
    // PC grid: work column keeps 진행건 above 오늘 챙길 일.
    expect(html.indexOf(">work-status<")).toBeLessThan(html.indexOf(">follow-ups<"));
    expect(html).toContain('class="dashboard-work-status-slot');
  });
});

describe("mobile order is follow-ups → goals → work status → productivity", () => {
  const css = readFileSync(join(__dirname, "..", "..", "components", "dashboard", "dashboard-action-overview.css"), "utf8");
  const mobile = css.slice(css.indexOf("@media (max-width: 1023.98px)"));
  const order = (sel: string) => {
    const at = mobile.indexOf(`${sel} {`);
    return at < 0 ? NaN : Number(mobile.slice(at).match(/order:\s*(\d+)/)?.[1]);
  };
  it("assigns increasing CSS order below 1024px only", () => {
    expect(mobile.length).toBeGreaterThan(0);
    const seq = [order(".dashboard-action-work > [data-dashboard-follow-ups]"), order(".dashboard-action-goals"), order(".dashboard-work-status-slot"), order(".dashboard-action-productivity")];
    expect(seq.every(Number.isFinite)).toBe(true);
    expect([...seq].sort((a, b) => a - b)).toEqual(seq);
    expect(mobile).toMatch(/\.dashboard-action-work\s*\{\s*display:\s*contents/);
  });
});
