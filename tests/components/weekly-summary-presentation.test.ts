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
  // belie 2026-10-12 #8 — 대시보드만 제목 아래 한 줄 문장. 칸별 「N 남음/초과」 줄은 계속 숨긴다.
  it("shows one headline only when opted in, in present or past form, still without remainder rows", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-09-15T03:00:00Z")); // 그 주(~09-17) 진행 중
      const present = renderToStaticMarkup(React.createElement(WeeklyGoalSummary, { headline: true }));
      expect(present).toContain("data-card-headline");
      expect(present).toContain("미팅완료 목표까지 9건 남았어요");
      expect(present).not.toMatch(/\d+ 남음/);
      expect(present).not.toContain("초과");
      vi.setSystemTime(new Date("2026-10-12T03:00:00Z")); // 그 주가 끝난 뒤
      const past = renderToStaticMarkup(React.createElement(WeeklyGoalSummary, { headline: true }));
      expect(past).toContain("미팅완료 목표에 9건 못 미쳤어요");
      expect(past).not.toContain("💪");
    } finally {
      vi.useRealTimers();
    }
    expect(renderToStaticMarkup(React.createElement(WeeklyGoalSummary))).not.toContain("data-card-headline");
  });
  it("preserves the explicit entry for compact business-tab summaries", () => {
    expect(renderToStaticMarkup(React.createElement(WeeklyGoalSummary,{compact:true}))).toContain('aria-label="목표·PT과제 열기"');
  });
  it("preserves remainder feedback in the goal editor by default", () => {
    const html=renderToStaticMarkup(React.createElement(GoalRings,{metrics:["contracts"],goals:{production:0,inflow:0,contacts:0,meetings:0,contracts:3},actuals:{production:0,inflow:0,contacts:0,meetings:0,contracts:1}}));
    expect(html).toContain("2 남음");
  });
});
