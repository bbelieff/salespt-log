/** 업체 보기 목록. PC와 모바일 모두 진행건 단위이며 진행이 없는 계약만 업체 단위다. */
"use client";

import { useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { isCarryoverContract, isTerminatedContract } from "@/types";
import { formatMoney } from "@/lib/format/money";
import { progressPct } from "../_lib/payment-progress";
import type { CompanyWorkItem } from "../_lib/company-work-view";
import { fmtDate, renderNameWithHighlight } from "./nameHighlight";
import WorkActivityBadge, { type ActivityLoadState } from "./WorkActivityBadge";
import { isManualContractLink } from "@/util/contract-link";
import MeetingLinkPicker from "./MeetingLinkPicker";

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
  // 「영업기록 없음」 을 누르면 미팅 고르기 → 연결(belie 2026-09-29). 행 선택 버튼 안이라 클릭을 행으로 넘기지 않는다.
  const [linking, setLinking] = useState<{ row: number; 업체명: string } | null>(null);
  const openLink = (row: number | undefined, 업체명: string) => (e: MouseEvent | KeyboardEvent) => {
    if ("key" in e && e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    e.stopPropagation();
    if (row) setLinking({ row, 업체명 });
  };
  return (<>
    {linking && <MeetingLinkPicker row={linking.row} 업체명={linking.업체명} onClose={() => setLinking(null)}
      onLinked={(failures) => { setLinking(null); if (failures.length) window.alert(`연결했어요. 다만 ${failures.join("·")} 옮기기에 실패했어요. 새로고침 후 확인해 주세요.`); }} />}
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
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-px-11 font-bold ${selected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>{index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-extrabold text-slate-900">{renderNameWithHighlight(cp.업체명, highlight)}</span>
                {isManualContractLink(cp.linkedMeetingId) && <span role="button" tabIndex={0} title="눌러서 영업기록(미팅)과 연결" aria-label={`${cp.업체명} 영업기록과 연결`}
                  onClick={openLink(cp.row, cp.업체명)} onKeyDown={openLink(cp.row, cp.업체명)}
                  className="shrink-0 rounded border border-dashed border-slate-300 bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700">영업기록 없음 ＋</span>}
                {hasProgress ? <WorkActivityBadge activity={work} state={activityState} /> : <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-px-11 font-semibold text-slate-600">진행 없음</span>}
                {selected && <span className="shrink-0 rounded-full bg-blue-600 px-1.5 py-0.5 text-px-10 font-bold text-white">조회 중</span>}
              </span>
              <span className="mt-1 block truncate pl-7 text-px-11 font-semibold text-blue-700">
                {hasProgress ? `진행 ${work.slot} · ${work.institution || "기관 미입력"}${work.product ? ` · ${work.product}` : ""}` : "진행건 미등록"}
              </span>
              <span className="mt-0.5 grid grid-cols-[1fr_auto] gap-x-2 pl-7 text-px-11 tabular-nums">
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
  </>);
}
