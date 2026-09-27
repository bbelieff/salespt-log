"use client";

import { useState } from "react";
import type { WorkStatusItem, WorkStatusKey } from "@/lib/analytics/payment-work-status";

const STATUS: Array<{ key: WorkStatusKey; label: string; color: string }> = [
  { key: "waiting", label: "진행대기", color: "bg-slate-300" },
  { key: "progress", label: "진행", color: "bg-gradient-to-r from-sky-400 to-blue-500" },
  { key: "approved", label: "승인", color: "bg-gradient-to-r from-violet-400 to-fuchsia-400" },
  { key: "collection-waiting", label: "수납대기", color: "bg-gradient-to-r from-amber-300 to-orange-400" },
  { key: "collected", label: "수납완료", color: "bg-gradient-to-r from-emerald-400 to-teal-400" },
];

interface Props {
  items: WorkStatusItem[];
  onNavigate: (row: number | null, slot: 1 | 2 | 3) => void;
  popoverPlacement?: "top" | "bottom";
}

export default function WorkStatusBar({ items, onNavigate, popoverPlacement = "bottom" }: Props) {
  const [open, setOpen] = useState<WorkStatusKey | null>(null);
  const active = open ? items.filter((item) => item.status === open) : [];

  return (
    <div className="relative min-w-0 self-center" data-work-status-bar>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <strong className="whitespace-nowrap text-xs text-slate-800">전체 진행건</strong>
        <b className="whitespace-nowrap text-base tabular-nums text-slate-950">{items.length}건</b>
        <div className="flex h-4 w-full min-w-12 overflow-hidden rounded-full border border-white/80 bg-slate-100 p-[2px] shadow-inner min-[1280px]:w-auto min-[1280px]:flex-1" role="group" aria-label="업무 상태">
          {STATUS.map((status) => {
            const count = items.filter((item) => item.status === status.key).length;
            return count > 0 ? <button key={status.key} type="button" onClick={() => setOpen(status.key)} onMouseEnter={() => setOpen(status.key)} className={`${status.color} h-full min-w-[8px] rounded-full transition-[filter] hover:brightness-105`} style={{ width: `${count / items.length * 100}%` }} aria-label={`${status.label} ${count}건`} /> : null;
          })}
        </div>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
        {STATUS.map((status) => <button type="button" key={status.key} onClick={() => setOpen(status.key)} className="inline-flex items-center gap-1 hover:text-slate-900"><span className={`h-2 w-2 rounded-full ${status.color}`}/>{status.label} <b className="tabular-nums text-slate-700">{items.filter((item) => item.status === status.key).length}</b></button>)}
      </div>
      {open && <div className={`absolute right-0 z-[500] max-h-64 w-[min(360px,90vw)] overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-2xl ${popoverPlacement === "top" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]"}`} onMouseLeave={() => setOpen(null)}>
        <div className="mb-1 flex items-center justify-between px-1 text-xs font-bold text-slate-800"><span>{STATUS.find((status) => status.key === open)?.label} {active.length}건</span><button type="button" onClick={() => setOpen(null)} className="p-1 text-slate-400" aria-label="닫기">×</button></div>
        {active.map((item) => <button type="button" key={item.key} onClick={() => { onNavigate(item.row, item.slot); setOpen(null); }} className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-blue-50"><span className="block truncate text-xs font-semibold text-slate-800">{item.company} · 진행 {item.slot} · {item.product || "상품 미정"}</span><span className="block truncate text-[11px] text-slate-400">{item.institution || "기관 미정"}</span></button>)}
      </div>}
    </div>
  );
}
