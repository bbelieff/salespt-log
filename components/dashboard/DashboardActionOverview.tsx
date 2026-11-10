"use client";

import type { DashboardChannelMatrix } from "@/types";
import WeeklyGoalSummary from "@/components/weekly-goals/WeeklyGoalSummary";
import CollapsibleGoalCard from "./CollapsibleGoalCard";
import ProductivityIndicators from "./ProductivityIndicators";
import DashboardFollowUps from "./DashboardFollowUps";
import DashboardWorkStatus from "./DashboardWorkStatus";
import PushPrompt from "@/components/push/PushPrompt";

/**
 * PC 좌열은 진행건→오늘 챙길 일, 우열은 생산성→목표(grid 배치, DOM 순서 무관).
 * 모바일은 주차와 상관없이 오늘 챙길 일 → 주간 목표 → 진행건 → 생산성 순(CSS order,
 * dashboard-action-overview.css · belie 2026-10-23 「모바일만 바꿔줘」).
 * 수료생(graduated)은 목표 카드를 접을 수 있고, 모바일에선 이 자리 대신 대시보드 맨 아래에
 * 접힌 채로 나온다(대시보드 page · CollapsibleGoalCard, belie 2026-11-05).
 */
export default function DashboardActionOverview({ matrix, weeks, todayISO, graduated = false }: {
  matrix: DashboardChannelMatrix[]; weeks: number; todayISO: string; courseStartISO?: string; graduated?: boolean;
}) {
  return <div className="dashboard-action-overview grid gap-6 pc:gap-x-8">
    <ProductivityIndicators weeks={weeks} matrix={matrix} className="dashboard-action-productivity min-w-0" />
    <div className="dashboard-action-work min-w-0 flex flex-col gap-6">
      <div className="dashboard-work-status-slot min-w-0"><DashboardWorkStatus todayISO={todayISO} /></div>
      <DashboardFollowUps todayISO={todayISO} />
      <PushPrompt />
    </div>
    <div className={"dashboard-action-goals min-w-0" + (graduated ? " dashboard-action-goals--graduated" : "")}>
      {graduated ? <CollapsibleGoalCard layout="pc" className="h-full min-w-0" /> : <WeeklyGoalSummary className="h-full min-w-0" />}
    </div>
  </div>;
}
