"use client";

import type { DashboardChannelMatrix } from "@/types";
import WeeklyGoalSummary from "@/components/weekly-goals/WeeklyGoalSummary";
import CollapsibleGoalCard from "./CollapsibleGoalCard";
import ProductivityIndicators from "./ProductivityIndicators";
import DashboardWorkStatus from "./DashboardWorkStatus";

/**
 * 「성과」 구역 — PC 는 주간 목표 | 생산성 지표 2단, 폰은 주간 목표 → 진행건 → 생산성(DOM 순서 그대로).
 * 2026-11-24 할 일 구역 개편: 「오늘 챙길 일」은 이 묶음에서 빠져 대시보드 page 가 폭 전체로 그린다.
 * 진행건 판은 PC 에서 숨긴다(맨 위 띠의 네 번째 칸, A안 2026-11-13).
 * 수료생(graduated)은 목표 카드를 접을 수 있고, 폰에선 이 자리 대신 대시보드 맨 아래에
 * 접힌 채로 나온다(대시보드 page · CollapsibleGoalCard, belie 2026-11-05).
 */
export default function DashboardActionOverview({ matrix, weeks, todayISO, graduated = false }: {
  matrix: DashboardChannelMatrix[]; weeks: number; todayISO: string; courseStartISO?: string; graduated?: boolean;
}) {
  return <div className="dashboard-action-overview grid gap-4">
    <div className={"dashboard-action-goals surface-panel min-w-0" + (graduated ? " dashboard-action-goals--graduated" : "")}>
      {graduated ? <CollapsibleGoalCard layout="pc" className="h-full min-w-0" /> : <WeeklyGoalSummary className="h-full min-w-0" />}
    </div>
    <div className="dashboard-work-status-slot surface-panel min-w-0"><DashboardWorkStatus todayISO={todayISO} /></div>
    <ProductivityIndicators weeks={weeks} matrix={matrix} className="dashboard-action-productivity surface-panel min-w-0" />
  </div>;
}
