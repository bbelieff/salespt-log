"use client";

import { useMemo, useState } from "react";
import type { ContractPayment, Todo } from "@/types";
import { formatMoney } from "@/lib/format/money";
import { buildWorkStatusItems } from "@/lib/analytics/payment-work-status";
import WorkStatusBar from "@/components/payment/WorkStatusBar";

type Period = "all" | "month" | "week" | "custom";
function isoToday() { return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }); }
function bounds(period: Period, from: string, to: string): [string, string] | null {
  if (period === "all") return null;
  const today = new Date(`${isoToday()}T00:00:00+09:00`);
  if (period === "custom") return from && to && from <= to ? [from, to] : null;
  if (period === "month") {
    const y = today.getFullYear(), m = today.getMonth();
    const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const end = new Date(y, m + 1, 0).toLocaleDateString("sv-SE");
    return [start, end];
  }
  const day = today.getDay() || 7;
  const mon = new Date(today); mon.setDate(today.getDate() - day + 1);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return [mon.toLocaleDateString("sv-SE"), sun.toLocaleDateString("sv-SE")];
}

interface Props {
  rows: ContractPayment[];
  todos: Todo[];
  onNavigate: (row: number | null, slot: 1 | 2 | 3) => void;
}

export default function PaymentPerformanceSummary({ rows, todos, onNavigate }: Props) {
  const [period, setPeriod] = useState<Period>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const range = bounds(period, from, to);
  const filtered = range ? rows.filter((r) => r.계약일 >= range[0] && r.계약일 <= range[1]) : rows;
  const contractRevenue = filtered.reduce((sum, r) => sum + r.수임비, 0);
  const received = rows.reduce((sum, r) => sum + [r.수납1, r.수납2, r.수납3]
    .filter((s) => !range || (s.수납일 && s.수납일 >= range[0] && s.수납일 <= range[1]))
    .reduce((s, slot) => s + slot.수납액, 0), 0);
  const items = useMemo(() => buildWorkStatusItems(rows, todos, isoToday()), [rows, todos]);
  const periodLabel = period === "all" ? "전체" : period === "month" ? "이번 달" : period === "week" ? "이번 주" : "직접 설정";

  return (
    <section data-payment-summary className="relative z-50 mb-3 overflow-visible rounded-2xl border border-white/70 bg-white/80 px-3 py-2 shadow-[0_8px_28px_rgba(15,23,42,.08)] backdrop-blur-xl min-[1280px]:z-[35]" aria-label="실무 수납 성과 요약">
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-stretch gap-x-2 gap-y-2 min-[1280px]:grid-cols-[auto_auto_minmax(0,1fr)] min-[1280px]:gap-x-4">
        <div className="col-span-2 flex flex-wrap items-center gap-1.5 min-[1280px]:col-span-1">
          <strong className="mr-1 whitespace-nowrap text-sm text-slate-900">성과 요약</strong>
          {(["all", "month", "week", "custom"] as Period[]).map((p) => (
            <button key={p} type="button" onClick={() => setPeriod(p)} className={`h-7 whitespace-nowrap rounded-full border px-2.5 text-xs font-semibold ${period === p ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-500"}`}>
              {p === "all" ? "전체" : p === "month" ? "이번 달" : p === "week" ? "이번 주" : "직접 설정"}
            </button>
          ))}
          {period === "custom" && <><input aria-label="조회 시작일" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-7 rounded-md border border-slate-200 px-1.5 text-xs"/><span className="text-slate-300">–</span><input aria-label="조회 종료일" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-7 rounded-md border border-slate-200 px-1.5 text-xs"/></>}
        </div>
        <div className="flex min-w-0 flex-col justify-center gap-1 rounded-xl bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/60 px-2 py-1 min-[640px]:flex-row min-[640px]:items-center min-[640px]:gap-3 min-[1280px]:gap-4 min-[1280px]:px-3">
          <div className="flex min-w-0 flex-col min-[1280px]:flex-row min-[1280px]:items-baseline min-[1280px]:gap-1.5"><span className="whitespace-nowrap text-[11px] font-medium text-slate-500">{periodLabel} 계약</span><span className="text-lg font-black tabular-nums text-slate-950 min-[1280px]:text-2xl">{filtered.length}<span className="ml-0.5 text-sm font-bold">건</span></span></div>
          <div className="flex min-w-0 flex-col min-[1280px]:flex-row min-[1280px]:items-baseline min-[1280px]:gap-1.5"><span className="whitespace-nowrap text-[11px] font-medium text-slate-500">{period === "all" ? "총 매출" : "기간 매출"}</span><span className="break-all text-[clamp(12px,3.8vw,16px)] font-extrabold tabular-nums leading-tight text-slate-950 min-[1280px]:text-xl">₩{formatMoney(contractRevenue + received)}</span></div>
        </div>
        <WorkStatusBar items={items} onNavigate={onNavigate} />
      </div>
    </section>
  );
}
