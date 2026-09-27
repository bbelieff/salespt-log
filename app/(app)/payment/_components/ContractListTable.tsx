/** 업체 보기 목록. PC와 모바일 모두 진행건 단위이며 진행이 없는 계약만 업체 단위다. */
"use client";

import type { ReactNode } from "react";
import { isCarryoverContract, isTerminatedContract } from "@/types";
import { formatMoney } from "@/lib/format/money";
import { progressPct } from "../_lib/payment-progress";
import type { CompanyWorkItem } from "../_lib/company-work-view";
import { fmtDate, renderNameWithHighlight } from "./nameHighlight";
import WorkActivityBadge, { type ActivityLoadState } from "./WorkActivityBadge";
import { isManualContractLink } from "@/util/contract-link";

interface Props {
  items: CompanyWorkItem[];
  selectedKey: string | null;
  onSelect: (item: CompanyWorkItem) => void;
  highlight?: string;
  courseStartISO?: string;
  activityState?: ActivityLoadState;
  renderDetail?: (item: CompanyWorkItem) => ReactNode;
  detailExpanded?: boolean;
  onToggleDetail?: () => void;
}

export default function ContractListTable({ items, selectedKey, onSelect, highlight, courseStartISO, activityState, renderDetail, detailExpanded = true, onToggleDetail }: Props) {
  return (
    <div className="space-y-1.5 p-2" aria-label="계약 목록" role={renderDetail ? "group" : "listbox"}>
      {items.map((item, index) => {
        const { cp, work, hasProgress } = item;
        const selected = item.key === selectedKey;
        const slot = cp[`수납${work.slot}`];
        const pct = hasProgress ? progressPct(slot.진행률) : 0;
        const muted = isCarryoverContract(cp, courseStartISO ?? "") || isTerminatedContract(cp);
        const inlineOpen = Boolean(renderDetail && selected && detailExpanded);
        return (
          <div key={item.key}>
            <button type="button" role={renderDetail ? undefined : "option"} aria-selected={renderDetail ? undefined : selected}
              aria-current={renderDetail && selected ? "true" : undefined} aria-expanded={renderDetail ? inlineOpen : undefined}
              aria-controls={inlineOpen ? `payment-company-detail-${item.key}` : undefined}
              data-row={cp.row ?? undefined} data-work-key={item.key}
              onClick={() => selected && renderDetail ? onToggleDetail?.() : !selected ? onSelect(item) : undefined}
              className={`relative w-full border px-3 py-2.5 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${selected ? `z-10 border-blue-400 bg-gradient-to-r from-blue-100 via-blue-50 to-white shadow-[0_8px_24px_rgba(37,99,235,.12)] ${inlineOpen ? "rounded-t-xl border-b-blue-100" : renderDetail ? "rounded-xl" : "rounded-l-xl"} pc:rounded-r-none pc:border-r-0` : "rounded-xl border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"} ${muted && !selected ? "opacity-60" : ""}`}>
              <span className="flex min-w-0 items-center gap-2">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${selected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>{index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-extrabold text-slate-900">{renderNameWithHighlight(cp.업체명, highlight)}</span>
                {isManualContractLink(cp.linkedMeetingId) && <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">영업기록 없음</span>}
                {hasProgress ? <WorkActivityBadge activity={work} state={activityState} /> : <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">진행 없음</span>}
                {selected && <span className="shrink-0 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">조회 중</span>}
              </span>
              <span className="mt-1 block truncate pl-7 text-[11px] font-semibold text-blue-700">
                {hasProgress ? `진행 ${work.slot} · ${work.institution || "기관 미입력"}${work.product ? ` · ${work.product}` : ""}` : "진행건 미등록"}
              </span>
              <span className="mt-0.5 grid grid-cols-[1fr_auto] gap-x-2 pl-7 text-[11px] tabular-nums">
                <span className="truncate text-slate-500">{fmtDate(cp.계약일)} · 수임비 ₩{formatMoney(cp.수임비)}</span>
                <span className="font-semibold text-emerald-600">수수료 ₩{formatMoney(hasProgress ? slot.수납액 : 0)}</span>
                <span className="col-span-2 mt-1 flex items-center gap-2 text-blue-600"><span>진행 {pct}%</span><span className="h-1 flex-1 overflow-hidden rounded-full bg-slate-200"><span className="block h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-600" style={{ width: `${pct}%` }}/></span></span>
              </span>
            </button>
            {renderDetail && selected && <div id={`payment-company-detail-${item.key}`} hidden={!detailExpanded} className="rounded-b-xl border border-t-0 border-blue-400 bg-white">{renderDetail(item)}</div>}
          </div>
        );
      })}
    </div>
  );
}
