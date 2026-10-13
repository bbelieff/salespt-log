"use client";

import { useMemo } from "react";
import { useContractPayments } from "@/query/contract-payment-hooks";
import { useAllTodos } from "@/query/todos-hooks";
import { useFollowUpMeetings } from "@/query/follow-up-hooks";
import { isDbSheetUnsupported, useDbSheetLeads } from "@/query/db-sheet-hooks";
import { summarizeFollowUps } from "@/lib/analytics/dashboard-follow-ups";
import DashboardFollowUpsView from "./DashboardFollowUpsView";

const DASHBOARD_STALE_MS = 5 * 60_000;
export default function DashboardFollowUps({ todayISO }: { todayISO: string }) {
  const contracts = useContractPayments();
  const todos = useAllTodos();
  const primaryDone = !contracts.isPending && !todos.isPending;
  const meetings = useFollowUpMeetings(todayISO, { enabled: primaryDone, staleTime: DASHBOARD_STALE_MS });
  const leads = useDbSheetLeads({ enabled: primaryDone, staleTime: DASHBOARD_STALE_MS, background: true });
  const dbHidden = isDbSheetUnsupported(leads.error);
  const dbFailed = leads.isError && !dbHidden;
  const workFailed = contracts.isError || todos.isError;
  const summary = useMemo(() => summarizeFollowUps({
    contracts: workFailed ? undefined : contracts.data?.rows ?? [],
    todos: workFailed ? undefined : todos.data?.todos ?? [],
    meetings: meetings.isError ? undefined : meetings.data?.meetings ?? [],
    leads: dbFailed || dbHidden ? undefined : leads.data?.leads,
  }, todayISO), [workFailed, contracts.data, todos.data, meetings.isError, meetings.data, dbFailed, dbHidden, leads.data, todayISO]);
  const loading = contracts.isPending || todos.isPending || meetings.isPending || leads.isPending;
  if (loading) return <section data-dashboard-follow-ups aria-label="오늘 챙길 일" aria-busy="true" className="follow-ups-card">
    <div className="fx-skeleton h-4 w-40 rounded-md" />
    <div className="mt-2 flex gap-2">{[0, 1, 2].map(i => <div key={i} className="fx-skeleton h-11 w-20 rounded-full pc:h-6 pc:w-16" />)}</div>
  </section>;
  const anyFailure = workFailed || meetings.isError || dbFailed;
  const allFailed = workFailed && meetings.isError && (dbFailed || dbHidden);
  const retry = () => {
    if (contracts.isError) void contracts.refetch();
    if (todos.isError) void todos.refetch();
    if (meetings.isError) void meetings.refetch();
    if (dbFailed) void leads.refetch();
  };
  const notice = <>
    {summary.unlinkedTodos > 0 && <p className="mt-2 text-px-11 text-slate-500">업체 연결이 끊긴 할 일 {summary.unlinkedTodos}건은 빼고 셌어요 · 캘린더에서 정리해 주세요</p>}
    {anyFailure && <p className="mt-1 flex items-center gap-2 text-px-11 text-slate-500" role="status"><span>{allFailed ? "오늘 챙길 일을 불러오지 못했어요." : "일부 항목을 불러오지 못했어요"}</span><button type="button" onClick={retry} className="min-h-11 px-1 font-semibold text-blue-700 pc:min-h-0">다시 시도</button></p>}
  </>;
  return <DashboardFollowUpsView items={summary.items} incomplete={anyFailure} notice={notice} />;
}
