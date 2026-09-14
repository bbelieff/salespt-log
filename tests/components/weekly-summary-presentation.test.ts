import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.stubGlobal("React", React);
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("@/components/DirtyGuard", () => ({ useGuardedRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/weekly-goals/client", () => ({ useGoalView: () => ({ data: { current: { week: 2, start: "2026-09-11", end: "2026-09-17", record: { goals: {production:10,inflow:10,contacts:10,meetings:10,contracts:1},task:"경쟁사 분석\n스크립트 보완" }, actuals: {production:12,inflow:3,contacts:2,meetings:1,contracts:1} } } }) }));
import WeeklyGoalSummary from "@/components/weekly-goals/WeeklyGoalSummary";
import GoalRings from "@/components/weekly-goals/GoalRings";
describe("dashboard weekly goal presentation", () => {
  it("provides a whole-card entry, separate week controls, and labeled PT tasks without remainder row", () => {
    const html=renderToStaticMarkup(React.createElement(WeeklyGoalSummary));
    expect(html).toContain('aria-label="주간 목표·PT과제 상세 보기"');
    expect(html).toContain('aria-label="이전 주차 목표"');
    expect(html).toContain("이번 주 PT과제");
    expect(html).toContain("경쟁사 분석");
    expect(html).not.toContain("초과");
    expect(html).not.toContain("남음");
    expect(html).not.toContain("목표·PT과제 열기");
  });
  it("preserves the explicit entry for compact business-tab summaries", () => {
    expect(renderToStaticMarkup(React.createElement(WeeklyGoalSummary,{compact:true}))).toContain('aria-label="목표·PT과제 열기"');
  });
  it("preserves remainder feedback in the goal editor by default", () => {
    const html=renderToStaticMarkup(React.createElement(GoalRings,{metrics:["contracts"],goals:{production:0,inflow:0,contacts:0,meetings:0,contracts:3},actuals:{production:0,inflow:0,contacts:0,meetings:0,contracts:1}}));
    expect(html).toContain("2 남음");
  });
});
