"use client";

import type { DashboardChannelMatrix } from "@/types";
import { parseISO, weekIndexOf } from "@/util/week";
import WeeklyGoalSummary from "@/components/weekly-goals/WeeklyGoalSummary";
import ProductivityIndicators from "./ProductivityIndicators";
import DashboardFollowUps from "./DashboardFollowUps";
import DashboardWorkStatus from "./DashboardWorkStatus";

/** PC 좌열은 생산성→목표, 우열은 진행건→오늘 챙길 일. 모바일은 실제 교육 주차로 두 카드의 순서만 바꾼다. */
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
  return <div className="dashboard-action-overview grid gap-3">
    <ProductivityIndicators weeks={weeks} matrix={matrix} className="dashboard-action-productivity min-w-0" />
    {actualWeek >= 9 ? [work, goals] : [goals, work]}
  </div>;
}
