/** 진행기관을 1뎁스로, 해당 기관의 업체별 진행건을 상품명순으로 표시한다. */
"use client";

import { useEffect, useState } from "react";
import type { InstitutionGroup, InstitutionWorkItem } from "../_lib/institution-view";

interface Props {
  groups: InstitutionGroup[];
  selectedKey: string | null;
  onSelect: (item: InstitutionWorkItem) => void;
}

export default function InstitutionWorkList({ groups, selectedKey, onSelect }: Props) {
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
        const open = openInstitutions.has(group.institution);
        return (
          <section key={group.institution || "no-institution"} className="rounded-xl border border-slate-200 bg-white">
            <button type="button" aria-expanded={open} onClick={() => setOpenInstitutions((current) => {
              const next = new Set(current);
              if (next.has(group.institution)) next.delete(group.institution);
              else next.add(group.institution);
              return next;
            })}
              className={`flex min-h-9 w-full items-center gap-2 px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${open ? "bg-blue-50 text-blue-900" : "text-slate-800 hover:bg-slate-50"}`}>
              <span className="min-w-0 flex-1 truncate font-bold">{group.institution || "기관 미입력"}</span>
              <span className="shrink-0 rounded-full bg-white/80 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">{group.count}건</span>
              <span className="shrink-0 text-xs text-slate-400" aria-hidden>{open ? "⌃" : "⌄"}</span>
            </button>
            {open && (
              <div className="space-y-1 border-t border-slate-100 p-1.5" role="listbox" aria-label={`${group.institution || "기관 미입력"} 진행건`}>
                {group.items.map((item) => {
                  const selected = item.key === selectedKey;
                  return (
                    <button key={item.key} type="button" role="option" aria-selected={selected} data-work-key={item.key}
                      onClick={() => onSelect(item)}
                      className={`relative w-full rounded-lg border px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${selected ? "payment-selected-bridge payment-selected-bridge--institution z-10 border-blue-400 bg-gradient-to-r from-blue-100 via-blue-50 to-white shadow-sm" : "border-transparent hover:border-blue-100 hover:bg-slate-50"} ${item.muted ? "opacity-60" : ""}`}>
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-900">{item.company}</span>
                        <span className="shrink-0 text-[11px] font-semibold text-blue-700">진행 {item.slot}</span>
                      </span>
                      <span className="mt-0.5 flex min-w-0 items-center gap-2 text-[11px] text-slate-500">
                        <span className="min-w-0 flex-1 truncate">{item.product || "상품 미입력"}</span>
                        <span className="shrink-0 tabular-nums">{item.progress}%</span>
                      </span>
                    </button>
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
