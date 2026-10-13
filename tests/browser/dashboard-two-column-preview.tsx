"use client";
import "./dashboard-two-column-preview.css";

import type { DashboardChannelMatrix } from "@/types";
import { parseISO, weekIndexOf } from "@/util/week";
import WeeklyGoalSummary from "@/components/weekly-goals/WeeklyGoalSummary";
import ProductivityIndicators from "@/components/dashboard/ProductivityIndicators";
import DashboardFollowUps from "./dashboard-followups-rules-preview";
import DashboardWorkStatus from "@/components/dashboard/DashboardWorkStatus";

/** 합성 목업: PC 좌열 생산성→목표, 우열 진행건→오늘 할 일. 모바일 주차별 우선순위 유지. */
export default function DashboardActionOverview({ matrix, weeks, todayISO, courseStartISO }: {
  matrix: DashboardChannelMatrix[]; weeks: number; todayISO: string; courseStartISO?: string;
}) {
  const actualWeek = courseStartISO ? weekIndexOf(parseISO(todayISO), parseISO(courseStartISO)) : 0;
  const work = <div key="work" className="dashboard-action-work min-w-0 space-y-3">
    <DashboardWorkStatus todayISO={todayISO} />
    <DashboardFollowUps todayISO={todayISO} />
  </div>;
  const goals = <div key="goals" className="dashboard-action-goals min-w-0">
    <WeeklyGoalSummary className="h-full min-w-0" />
  </div>;
  return <div className="dashboard-action-overview dashboard-two-column-preview grid gap-3">
    <ProductivityIndicators weeks={weeks} matrix={matrix} className="dashboard-action-productivity min-w-0" />
    {actualWeek >= 9 ? [work, goals] : [goals, work]}
  </div>;
}
