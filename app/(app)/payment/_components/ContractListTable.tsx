/** PC 계약 목록. 1뎁스는 업체명·계약일/수임비·수수료·진행만 표시한다. */
"use client";

import { isCarryoverContract, isTerminatedContract, type ContractPayment } from "@/types";
import { formatMoney } from "@/lib/format/money";
import { contractProgress } from "../_lib/payment-progress";
import { fmtDate, renderNameWithHighlight } from "./nameHighlight";

interface Props {
  rows: ContractPayment[];
  selectedRow: number | null;
  onSelect: (row: number | null) => void;
  highlight?: string;
  courseStartISO?: string;
}

export default function ContractListTable({ rows, selectedRow, onSelect, highlight, courseStartISO }: Props) {
  return (
    <div className="space-y-1.5 p-2" aria-label="계약 목록" role="listbox">
      {rows.map((cp, index) => {
        const selected = cp.row === selectedRow;
        const received = cp.수납1.수납액 + cp.수납2.수납액 + cp.수납3.수납액;
        const pct = contractProgress(cp);
        const muted = isCarryoverContract(cp, courseStartISO ?? "") || isTerminatedContract(cp);
        return (
          <button key={cp.row} type="button" role="option" aria-selected={selected} data-row={cp.row} onClick={() => { if (!selected) onSelect(cp.row ?? null); }}
            className={`relative w-full rounded-xl border px-3 py-2.5 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${selected ? "z-10 border-blue-400 bg-gradient-to-r from-blue-100 via-blue-50 to-white shadow-[0_8px_24px_rgba(37,99,235,.16)] ring-1 ring-blue-200" : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"} ${muted ? "opacity-60" : ""}`}>
            <div className="flex min-w-0 items-center gap-2">
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${selected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>{index + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-extrabold text-slate-900">{renderNameWithHighlight(cp.업체명, highlight)}</span>
              {selected && <span className="shrink-0 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">조회 중</span>}
            </div>
            <div className="mt-1 grid grid-cols-[1fr_auto] gap-x-2 pl-7 text-[11px] tabular-nums">
              <span className="truncate text-slate-500">{fmtDate(cp.계약일)} · 수임비 ₩{formatMoney(cp.수임비)}</span>
              <span className="font-semibold text-emerald-600">수수료 ₩{formatMoney(received)}</span>
              <span className="col-span-2 mt-1 flex items-center gap-2 text-blue-600"><span>진행 {pct || 0}%</span><span className="h-1 flex-1 overflow-hidden rounded-full bg-slate-200"><span className="block h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-600" style={{ width: `${pct}%` }}/></span></span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
