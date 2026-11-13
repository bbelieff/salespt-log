"use client";

import SkeletonBars from "@/components/ui/SkeletonBars";
import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useContractPayments } from "@/query/contract-payment-hooks";
import { useAllTodos } from "@/query/todos-hooks";
import { activeWorkContracts, buildWorkStatusItems } from "@/lib/analytics/payment-work-status";
import WorkStatusBar from "@/components/payment/WorkStatusBar";
import type { WorkColumnData } from "./FinanceWorkColumn";

/**
 * 대시보드 「전체 진행건」 자료 — 실무/수납과 같은 계약·Todo 조회와 분류.
 * 아래 진행건 판(폰)과 맨 위 띠의 「진행건」 칸(PC, A안 2026-11-13)이 같이 쓴다 — 같은 조회 키라 새 요청은 없다.
 */
export function useDashboardWorkItems(todayISO: string): WorkColumnData {
  const router = useRouter();
  const contracts = useContractPayments();
  const todos = useAllTodos();
  const items = useMemo(() => (contracts.data && todos.data ? buildWorkStatusItems(
    activeWorkContracts(contracts.data.rows ?? []),
    todos.data.todos ?? [],
    todayISO,
  ) : null), [contracts.data, todos.data, todayISO]);
  const { refetch: refetchContracts } = contracts;
  const { refetch: refetchTodos } = todos;
  const onRetry = useCallback(() => { void refetchContracts(); void refetchTodos(); }, [refetchContracts, refetchTodos]);
  const onNavigate = useCallback((row: number | null, slot: number) => router.push(row == null ? "/payment" : `/payment?row=${row}&slot=${slot}`), [router]);
  return { items, failed: contracts.isError || todos.isError, onRetry, onNavigate };
}

interface Props {
  todayISO: string;
}

export default function DashboardWorkStatus({ todayISO }: Props) {
  const work = useDashboardWorkItems(todayISO);

  return (
    <section data-dashboard-work-status aria-label="전체 진행건" className="relative z-20">
      {work.failed ? (
        <div className="flex items-center justify-between gap-3 text-xs text-slate-600">
          <span>진행 현황을 불러오지 못했어요.</span>
          <button type="button" onClick={work.onRetry} className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 font-semibold text-blue-700">다시 시도</button>
        </div>
      ) : !work.items ? (
        <div className="flex items-center gap-3 text-xs text-slate-500"><strong className="text-slate-800">전체 진행건</strong><SkeletonBars label="불러오는 중…" rows={1} className="flex-1" /></div>
      ) : (
        <WorkStatusBar items={work.items} popoverPlacement="top" onNavigate={work.onNavigate} />
      )}
    </section>
  );
}
