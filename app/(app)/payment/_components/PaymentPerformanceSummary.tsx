"use client";

import { useMemo, useState } from "react";
import type { ContractPayment, Todo } from "@/types";
import { formatMoney } from "@/lib/format/money";
import { buildWorkStatusItems } from "@/lib/analytics/payment-work-status";
import WorkStatusBar from "@/components/payment/WorkStatusBar";
import PeriodPicker from "@/components/ui/PeriodPicker";
import {
  customIncomplete,
  periodBounds,
  periodRevenue,
  todayKst,
  type FinancePeriod,
} from "@/util/finance-period";

interface Props {
  /** 매출·계약 건수 집계 대상 — 숨김·해지·이월 구분 없이 모든 계약(대시보드와 같은 정의, ADR-0034). */
  rows: ContractPayment[];
  /** 진행 현황 막대 대상 — 숨김·해지 제외(activeWorkContracts). */
  workRows: ContractPayment[];
  todos: Todo[];
  onNavigate: (row: number | null, slot: 1 | 2 | 3) => void;
}

export default function PaymentPerformanceSummary({ rows, workRows, todos, onNavigate }: Props) {
  const [period, setPeriod] = useState<FinancePeriod>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const today = todayKst();
  const range = periodBounds(period, from, to, today);
  // 매출 = 수임비(계약일) + 수납액(수납일) − 반환액(해지일). 대시보드와 같은 함수.
  const summary = periodRevenue(rows, range);
  const items = useMemo(() => buildWorkStatusItems(workRows, todos, today), [workRows, todos, today]);
  const periodLabel = range ? (period === "month" ? "이번 달" : period === "week" ? "이번 주" : "직접 설정") : "전체";

  return (
    <section data-payment-summary className="relative z-50 mb-3 overflow-visible rounded-2xl border border-white/70 bg-white/80 px-3 py-2 shadow-[0_8px_28px_rgba(15,23,42,.08)] backdrop-blur-xl min-[1280px]:z-[35]" aria-label="실무 수납 성과 요약">
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-stretch gap-x-2 gap-y-2 min-[1280px]:grid-cols-[auto_auto_minmax(0,1fr)] min-[1280px]:gap-x-4">
        <div className="col-span-2 flex flex-wrap items-center gap-1.5 min-[1280px]:col-span-1">
          <strong className="mr-1 whitespace-nowrap text-sm text-slate-900">성과 요약</strong>
          <PeriodPicker period={period} from={from} to={to} onPeriod={setPeriod} onFrom={setFrom} onTo={setTo} incomplete={customIncomplete(period, range)} />
        </div>
        <div className="flex min-w-0 flex-col justify-center gap-1 rounded-xl bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/60 px-2 py-1 min-[640px]:flex-row min-[640px]:items-center min-[640px]:gap-3 min-[1280px]:gap-4 min-[1280px]:px-3">
          <div className="flex min-w-0 flex-col min-[1280px]:flex-row min-[1280px]:items-baseline min-[1280px]:gap-1.5"><span className="whitespace-nowrap text-px-11 font-medium text-slate-500">{periodLabel} 계약</span><span className="text-lg font-black tabular-nums text-slate-950 min-[1280px]:text-2xl">{summary.contracts}<span className="ml-0.5 text-sm font-bold">건</span></span></div>
          <div className="flex min-w-0 flex-col min-[1280px]:flex-row min-[1280px]:items-baseline min-[1280px]:gap-1.5"><span className="whitespace-nowrap text-px-11 font-medium text-slate-500">{range ? "기간 매출" : "총 매출"}</span><span className="break-all text-[clamp(12px,3.8vw,16px)] font-extrabold tabular-nums leading-tight text-slate-950 min-[1280px]:text-xl">₩{formatMoney(summary.revenue)}</span></div>
        </div>
        <WorkStatusBar items={items} onNavigate={onNavigate} />
      </div>
    </section>
  );
}
