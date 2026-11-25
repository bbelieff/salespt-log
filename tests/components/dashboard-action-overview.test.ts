import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/weekly-goals/WeeklyGoalSummary", () => ({ default: () => createElement("section", {}, "weekly-goals") }));
vi.mock("@/components/dashboard/ProductivityIndicators", () => ({ default: () => createElement("section", {}, "productivity") }));
vi.mock("@/components/dashboard/DashboardWorkStatus", () => ({ default: () => createElement("section", {}, "work-status") }));
vi.stubGlobal("React", React);
import DashboardActionOverview from "@/components/dashboard/DashboardActionOverview";

import { readFileSync } from "node:fs";
import { join } from "node:path";

/** 2026-11-24 할 일 구역 개편: 「오늘 챙길 일」은 page 가 폭 전체로 그리고, 이 묶음은 「성과」(목표·진행건·생산성)만 — 주차와 상관없이 같은 구성. */
describe("dashboard shows the performance cards from the first week", () => {
  it.each([
    ["2026-01-02", "2026-01-02", 12], // first day
    ["2026-01-02", "2026-02-27", 12], // week 9 — no longer reorders
    [undefined, "2026-02-27", 8],
    ["2026-03-01", "2026-02-27", 12], // pre-course
  ] as const)("start=%s today=%s course=%s renders every card once, goals → work status → productivity", (courseStartISO, todayISO, weeks) => {
    const html = renderToStaticMarkup(createElement(DashboardActionOverview, { matrix: [], weeks, todayISO, courseStartISO }));
    for (const name of ["productivity", "weekly-goals", "work-status"]) expect(html.match(new RegExp(`>${name}<`, "g"))).toHaveLength(1);
    // 폰 순서 = DOM 순서(주간 목표 → 진행건 → 생산성). PC 는 진행건 판을 숨겨 주간 목표 | 생산성 2단.
    expect(html.indexOf(">weekly-goals<")).toBeLessThan(html.indexOf(">work-status<"));
    expect(html.indexOf(">work-status<")).toBeLessThan(html.indexOf(">productivity<"));
    expect(html).toContain('class="dashboard-work-status-slot');
    expect(html).not.toContain("data-dashboard-follow-ups");
  });
});

describe("page order — PC: 띠 → 오늘 챙길 일 → 성과 → 차트 / 폰: 진행도 → 오늘 챙길 일 → 매출·비용 → 성과 → 차트", () => {
  const css = readFileSync(join(__dirname, "..", "..", "components", "dashboard", "dashboard-action-overview.css"), "utf8");
  const page = readFileSync(join(__dirname, "..", "..", "app", "(app)", "dashboard", "page.tsx"), "utf8");
  const mobile = css.slice(css.lastIndexOf("@media (max-width: 1023.98px) {\n  .dash-hero.surface-hero"));
  const desktop = css.slice(css.indexOf("@media (min-width: 1024px) {\n  .dash-hero {"), css.lastIndexOf("@media (max-width: 1023.98px) {\n  .dash-hero.surface-hero"));

  it("DOM 순서: 띠(진행도 · 기간 칩+재무) → 오늘 챙길 일 → 성과 제목 → 성과 묶음 → 차트", () => {
    const at = (needle: string) => { const i = page.indexOf(needle); expect(i, needle).toBeGreaterThan(0); return i; };
    const seq = [at("dash-hero-progress"), at("dash-hero-money"), at("<DashboardFollowUps"), at("<PushPrompt"), at('className="section-head dash-after'), at("<DashboardActionOverview"), at("<MobileChartCarousel")];
    expect([...seq].sort((a, b) => a - b)).toEqual(seq);
    expect(page.match(/<DashboardFollowUps/g)).toHaveLength(1);
    expect(page.match(/<DashboardFinance/g)).toHaveLength(1);
  });

  it("폰(1024 미만)만 띠를 풀어 매출·비용을 오늘 챙길 일 아래로 내린다 — 그 뒤 구역은 모두 그보다 아래", () => {
    expect(mobile).toContain(".dash-hero.surface-hero { display: contents; }");
    expect(mobile).toContain(".dash-hero-money { order: 1; }");
    expect(mobile).toContain(".dash-after { order: 2; }");
    // 오늘 챙길 일 뒤에 오는 구역은 빠짐없이 dash-after(성과 제목·성과 묶음·차트·차트 빈 상태·수료생 목표·불러오는 자리).
    expect(page.match(/dash-after/g)!.length).toBeGreaterThanOrEqual(6);
    for (const cls of ["dashboard-goals-bottom dash-after", 'className="dash-after"><DashboardSkeleton', 'className="dash-after space-y-3', 'className="dash-after surface-panel']) expect(page).toContain(cls);
  });

  it("PC 는 지금까지와 같은 한 띠 — 진행 왼쪽 · 칩 오른쪽, 아래 재무(안쪽 묶음의 상자를 지운다)", () => {
    expect(desktop).toContain(".dash-hero { display: flex; flex-wrap: wrap; align-items: center; }");
    expect(desktop).toContain(".dash-hero > .dash-hero-money { display: contents; }");
    expect(desktop).toMatch(/\.dash-hero > \.dash-hero-progress \{ flex: 1 1 24rem; border: 0; border-radius: 0; background: none; box-shadow: none; \}/);
    expect(desktop).toContain(".dash-hero-finance { flex: 0 0 100%; min-width: 0; }");
    expect(desktop).not.toMatch(/[\s;{]order:/); // PC 는 순서를 바꾸지 않는다
    // 성과 묶음: 주간 목표 | 생산성 2단, 진행건 판은 띠로 올라가 숨는다.
    expect(css).toContain(".dashboard-action-overview { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: stretch; }");
    expect(css).toMatch(/@media \(min-width: 1024px\) \{\s*\.dashboard-work-status-slot \{ display: none; \}/);
  });
});
