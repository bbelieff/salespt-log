"use client";

import { useMemo, useState } from "react";
import type { ContractPayment, Todo } from "@/types";
import { formatMoney } from "@/lib/format/money";
import { buildWorkStatusItems, type WorkStatusKey } from "../_lib/work-status";

type Period = "all" | "month" | "week" | "custom";
const STATUS: Array<{ key: WorkStatusKey; label: string; color: string }> = [
  { key: "waiting", label: "진행대기", color: "bg-slate-300" },
  { key: "progress", label: "진행", color: "bg-gradient-to-r from-sky-400 to-blue-500" },
  { key: "approved", label: "승인", color: "bg-gradient-to-r from-violet-400 to-fuchsia-400" },
  { key: "collection-waiting", label: "수납대기", color: "bg-gradient-to-r from-amber-300 to-orange-400" },
  { key: "collected", label: "수납완료", color: "bg-gradient-to-r from-emerald-400 to-teal-400" },
];

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
  const [open, setOpen] = useState<WorkStatusKey | null>(null);
  const range = bounds(period, from, to);
  const filtered = range ? rows.filter((r) => r.계약일 >= range[0] && r.계약일 <= range[1]) : rows;
  const contractRevenue = filtered.reduce((sum, r) => sum + r.수임비, 0);
  const received = rows.reduce((sum, r) => sum + [r.수납1, r.수납2, r.수납3]
    .filter((s) => !range || (s.수납일 && s.수납일 >= range[0] && s.수납일 <= range[1]))
    .reduce((s, slot) => s + slot.수납액, 0), 0);
  const items = useMemo(() => buildWorkStatusItems(rows, todos, isoToday()), [rows, todos]);
  const active = open ? items.filter((i) => i.status === open) : [];
  const periodLabel = period === "all" ? "전체" : period === "month" ? "이번 달" : period === "week" ? "이번 주" : "직접 설정";

  return (
    <section className="relative z-50 mb-3 overflow-visible rounded-2xl border border-white/70 bg-white/80 p-3 shadow-[0_8px_28px_rgba(15,23,42,.08)] backdrop-blur-xl" aria-label="실무 수납 성과 요약">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <strong className="mr-1 text-sm text-slate-900">성과 요약</strong>
        {(["all", "month", "week", "custom"] as Period[]).map((p) => (
          <button key={p} type="button" onClick={() => setPeriod(p)} className={`h-7 rounded-full border px-2.5 text-xs font-semibold ${period === p ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-500"}`}>
            {p === "all" ? "전체" : p === "month" ? "이번 달" : p === "week" ? "이번 주" : "직접 설정"}
          </button>
        ))}
        {period === "custom" && <><input aria-label="조회 시작일" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-7 rounded-md border border-slate-200 px-1.5 text-xs"/><span className="text-slate-300">–</span><input aria-label="조회 종료일" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-7 rounded-md border border-slate-200 px-1.5 text-xs"/></>}
      </div>
      <div className="grid gap-3 min-[1100px]:grid-cols-[minmax(260px,.75fr)_minmax(440px,1.25fr)] min-[1100px]:items-center">
        <div className="flex items-end gap-6 rounded-xl bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/60 px-4 py-3">
          <div><div className="text-[11px] font-medium text-slate-500">{periodLabel} 계약</div><div className="text-2xl font-black tabular-nums text-slate-950">{filtered.length}<span className="ml-0.5 text-sm font-bold">건</span></div></div>
          <div><div className="text-[11px] font-medium text-slate-500">{period === "all" ? "총 매출" : "기간 매출"}</div><div className="text-xl font-extrabold tabular-nums text-slate-950">₩{formatMoney(contractRevenue + received)}</div></div>
        </div>
        <div className="relative min-w-0">
          <div className="mb-1.5 flex items-center gap-2"><strong className="text-xs text-slate-800">전체 진행건</strong><b className="text-base tabular-nums text-slate-950">{items.length}건</b></div>
          <div className="flex h-4 overflow-hidden rounded-full border border-white/80 bg-slate-100 p-[2px] shadow-inner" role="group" aria-label="업무 상태">
            {STATUS.map((s) => { const count = items.filter((i) => i.status === s.key).length; return count > 0 ? <button key={s.key} type="button" onClick={() => setOpen(s.key)} onMouseEnter={() => setOpen(s.key)} className={`${s.color} h-full min-w-[8px] rounded-full transition-[filter] hover:brightness-105`} style={{ width: `${count / items.length * 100}%` }} aria-label={`${s.label} ${count}건`} /> : null; })}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">{STATUS.map((s) => <button type="button" key={s.key} onClick={() => setOpen(s.key)} className="inline-flex items-center gap-1 hover:text-slate-900"><span className={`h-2 w-2 rounded-full ${s.color}`}/>{s.label} <b className="tabular-nums text-slate-700">{items.filter((i) => i.status === s.key).length}</b></button>)}</div>
          {open && <div className="absolute right-0 top-[calc(100%+8px)] z-[500] max-h-64 w-[min(360px,90vw)] overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-2xl" onMouseLeave={() => setOpen(null)}>
            <div className="mb-1 flex items-center justify-between px-1 text-xs font-bold text-slate-800"><span>{STATUS.find((s) => s.key === open)?.label} {active.length}건</span><button type="button" onClick={() => setOpen(null)} className="p-1 text-slate-400" aria-label="닫기">×</button></div>
            {active.map((i) => <button type="button" key={i.key} onClick={() => { onNavigate(i.row, i.slot); setOpen(null); }} className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-blue-50"><span className="block truncate text-xs font-semibold text-slate-800">{i.company} · 진행 {i.slot} · {i.product || "상품 미정"}</span><span className="block truncate text-[11px] text-slate-400">{i.institution || "기관 미정"}</span></button>)}
          </div>}
        </div>
      </div>
    </section>
  );
}
