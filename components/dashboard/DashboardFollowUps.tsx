"use client";

import DashboardFollowUpsView from "./DashboardFollowUpsView";
import { useTodayFollowUps } from "./useTodayFollowUps";
import BadgeChip from "@/components/badges/BadgeChip";

export default function DashboardFollowUps({ todayISO }: { todayISO: string }) {
  const { summary, loading, anyFailure, allFailed, retry } = useTodayFollowUps(todayISO);
  if (loading) return <section data-dashboard-follow-ups aria-label="오늘 챙길 일" aria-busy="true" className="follow-ups-card ft-card">
    <div className="fx-skeleton h-4 w-40 rounded-md" />
    <div className="mt-2 flex gap-2">{[0, 1, 2].map(i => <div key={i} className="fx-skeleton h-11 w-20 rounded-full pc:h-6 pc:w-16" />)}</div>
  </section>;
  const notice = <>
    {summary.unlinkedTodos > 0 && <p className="mt-2 text-px-11 text-slate-500">업체 연결이 끊긴 할 일 {summary.unlinkedTodos}건은 빼고 셌어요 · 캘린더에서 정리해 주세요</p>}
    {anyFailure && <p className="mt-1 flex items-center gap-2 text-px-11 text-slate-500" role="status"><span>{allFailed ? "오늘 챙길 일을 불러오지 못했어요." : "일부 항목을 불러오지 못했어요"}</span><button type="button" onClick={retry} className="min-h-11 px-1 font-semibold text-blue-700 pc:min-h-0">다시 시도</button></p>}
    {/* 배지 칩 — 승인 목업 2026-10-24: 챙길 일이 0건이어도 남는다 */}
    <BadgeChip />
  </>;
  return <DashboardFollowUpsView items={summary.items} incomplete={anyFailure} notice={notice} />;
}
