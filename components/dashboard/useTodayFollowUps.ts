"use client";
/** 「오늘 챙길 일」 조회·집계 단일 진입점 — 대시보드 카드와 우하단 빠른 보기가 같은 쿼리 캐시를 공유한다. */
import { useMemo } from "react";
import { useContractPayments } from "@/query/contract-payment-hooks";
import { useAllTodos } from "@/query/todos-hooks";
import { useFollowUpMeetings } from "@/query/follow-up-hooks";
import { isDbSheetUnsupported, useDbSheetLeads } from "@/query/db-sheet-hooks";
import { summarizeFollowUps } from "@/lib/analytics/dashboard-follow-ups";

const DASHBOARD_STALE_MS = 5 * 60_000;

/** enabled=false 면 조회하지 않는다(빠른 보기의 지연 시작). background=true 면 전역 로딩 팝업에서 뺀다. */
export function useTodayFollowUps(todayISO: string, opts: { enabled?: boolean; background?: boolean } = {}) {
  const enabled = opts.enabled ?? true;
  const contracts = useContractPayments(opts);
  const todos = useAllTodos(opts);
  const primaryDone = enabled && !contracts.isPending && !todos.isPending;
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
  const anyFailure = workFailed || meetings.isError || dbFailed;
  const allFailed = workFailed && meetings.isError && (dbFailed || dbHidden);
  const retry = () => {
    if (contracts.isError) void contracts.refetch();
    if (todos.isError) void todos.refetch();
    if (meetings.isError) void meetings.refetch();
    if (dbFailed) void leads.refetch();
  };
  return { summary, loading, anyFailure, allFailed, retry };
}
