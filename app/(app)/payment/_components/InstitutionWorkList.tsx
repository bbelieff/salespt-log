/** 진행기관을 1뎁스로 표시한다. PC는 상품순, 모바일은 활동 우선순위로 정렬한다. */
"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { InstitutionGroup, InstitutionWorkItem } from "../_lib/institution-view";
import WorkActivityBadge from "./WorkActivityBadge";

interface Props {
  groups: InstitutionGroup[];
  selectedKey: string | null;
  onSelect: (item: InstitutionWorkItem) => void;
  /** 모바일에서 선택 행 바로 밑에 같은 계약 편집기를 표시한다. PC 목록은 전달하지 않는다. */
  renderDetail?: (item: InstitutionWorkItem) => ReactNode;
  detailExpanded?: boolean;
  onToggleDetail?: () => void;
  activityState?: "loading" | "ready" | "error";
}

export default function InstitutionWorkList({ groups, selectedKey, onSelect, renderDetail, detailExpanded = true, onToggleDetail, activityState = "ready" }: Props) {
  const activeInstitution = groups.find((group) => group.items.some((item) => item.key === selectedKey))?.institution;
  const [openInstitutions, setOpenInstitutions] = useState<Set<string>>(
    () => new Set(activeInstitution !== undefined ? [activeInstitution] : groups[0] ? [groups[0].institution] : []),
  );
  useEffect(() => {
    if (activeInstitution !== undefined) setOpenInstitutions((current) => {
      if (current.has(activeInstitution)) return current;
      return new Set([...current, activeInstitution]);
    });
  }, [activeInstitution]);

  return (
    <div className="space-y-1.5 p-2" aria-label="진행기관별 진행 목록">
      {groups.map((group) => {
        const active = group.institution === activeInstitution;
        // 선택된 진행건이 든 기관은 늘 펼친다 — 접으면 선택·상세가 숨어 어디를 보고 있는지 잃는다(belie 2026-09-29).
        const open = active || openInstitutions.has(group.institution);
        return (
          <section key={group.institution || "no-institution"} className={`rounded-xl border bg-white ${active ? "border-red-200" : "border-slate-200"}`}>
            <button type="button" aria-expanded={open} aria-disabled={active || undefined} data-active-institution={active ? "true" : undefined} onClick={() => !active && setOpenInstitutions((current) => {
              const next = new Set(current);
              if (next.has(group.institution)) next.delete(group.institution);
              else next.add(group.institution);
              return next;
            })}
              className={`flex min-h-9 w-full items-center gap-2 px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${open ? "rounded-t-[11px]" : "rounded-[11px]"} ${open || active ? "bg-red-50 text-red-900" : "text-slate-800 hover:bg-red-50/50"}`}>
              <span className="min-w-0 flex-1 truncate font-bold">{group.institution || "기관 미입력"}</span>
              <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-px-11 font-semibold text-red-700">{group.count}건</span>
              {!active && <span className="shrink-0 text-xs text-slate-400" aria-hidden>{open ? "⌃" : "⌄"}</span>}
            </button>
            {(open || (renderDetail && active)) && (
              <div hidden={!open} className="space-y-1 border-t border-red-100 p-1.5" role={renderDetail ? "group" : "listbox"} aria-label={`${group.institution || "기관 미입력"} 진행건`}>
                {group.items.map((item) => {
                  const selected = item.key === selectedKey;
                  const inlineOpen = Boolean(renderDetail && selected && detailExpanded);
                  return (
                    <div key={item.key}>
                    <button type="button" role={renderDetail ? undefined : "option"} aria-selected={renderDetail ? undefined : selected} aria-current={renderDetail && selected ? "true" : undefined} aria-expanded={renderDetail ? inlineOpen : undefined} aria-controls={inlineOpen ? `payment-inline-detail-${item.key}` : undefined} data-work-key={item.key}
                      onClick={() => selected && renderDetail ? onToggleDetail?.() : onSelect(item)}
                      className={`scroll-mt-app-content relative w-full border px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${selected ? `z-10 border-red-400 bg-gradient-to-r from-red-100 via-red-50 to-white shadow-sm ${inlineOpen ? "rounded-t-lg border-b-red-100" : "rounded-lg"} min-[1280px]:rounded-r-none min-[1280px]:border-r-0` : "rounded-lg border-transparent hover:border-red-100 hover:bg-red-50/40"} ${item.muted && !selected ? "opacity-60" : ""}`}>
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-900">{item.company}</span>
                        <span className="shrink-0 text-px-11 font-semibold text-red-700">진행 {item.slot}</span>
                      </span>
                      <span className="mt-0.5 flex min-w-0 items-center gap-2 text-px-11 text-slate-500">
                        <span className="min-w-0 flex-1 truncate">{item.product || "상품 미입력"}</span>
                        <span className="shrink-0 tabular-nums">{item.progress}%</span>
                        {renderDetail && <WorkActivityBadge activity={item} state={activityState} />}
                      </span>
                    </button>
                    {renderDetail && selected && <div id={`payment-inline-detail-${item.key}`} hidden={!detailExpanded} className="rounded-b-lg border border-t-0 border-red-400 bg-white">{renderDetail(item)}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
