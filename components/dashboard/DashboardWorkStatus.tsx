"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useContractPayments } from "@/query/contract-payment-hooks";
import { useAllTodos } from "@/query/todos-hooks";
import { activeWorkContracts, buildWorkStatusItems } from "@/lib/analytics/payment-work-status";
import WorkStatusBar from "@/components/payment/WorkStatusBar";

interface Props {
  courseStartISO: string;
  todayISO: string;
}

export default function DashboardWorkStatus({ courseStartISO, todayISO }: Props) {
  const router = useRouter();
  const contracts = useContractPayments();
  const todos = useAllTodos();
  const items = useMemo(() => buildWorkStatusItems(
    activeWorkContracts(contracts.data?.rows ?? [], courseStartISO),
    todos.data?.todos ?? [],
    todayISO,
  ), [contracts.data?.rows, todos.data?.todos, courseStartISO, todayISO]);

  return (
    <section data-dashboard-work-status aria-label="전체 진행건" className="relative z-20 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      {contracts.isError || todos.isError ? (
        <div className="flex items-center justify-between gap-3 text-xs text-slate-600">
          <span>진행 현황을 불러오지 못했어요.</span>
          <button type="button" onClick={() => { void contracts.refetch(); void todos.refetch(); }} className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 font-semibold text-blue-700">다시 시도</button>
        </div>
      ) : !contracts.data || !todos.data ? (
        <div className="flex items-center gap-3 text-xs text-slate-500"><strong className="text-slate-800">전체 진행건</strong><span>불러오는 중…</span></div>
      ) : (
        <WorkStatusBar items={items} popoverPlacement="top" onNavigate={(row, slot) => router.push(row == null ? "/payment" : `/payment?row=${row}&slot=${slot}`)} />
      )}
    </section>
  );
}
