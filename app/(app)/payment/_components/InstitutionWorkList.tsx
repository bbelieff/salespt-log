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
        const active = group.institution === activeInstitution;
        return (
          <section key={group.institution || "no-institution"} className={`rounded-xl border bg-white ${active ? "border-red-200" : "border-slate-200"}`}>
            <button type="button" aria-expanded={open} data-active-institution={active ? "true" : undefined} onClick={() => setOpenInstitutions((current) => {
              const next = new Set(current);
              if (next.has(group.institution)) next.delete(group.institution);
              else next.add(group.institution);
              return next;
            })}
              className={`flex min-h-9 w-full items-center gap-2 px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${open ? "rounded-t-[11px]" : "rounded-[11px]"} ${open || active ? "bg-red-50 text-red-900" : "text-slate-800 hover:bg-red-50/50"}`}>
              <span className="min-w-0 flex-1 truncate font-bold">{group.institution || "기관 미입력"}</span>
              <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[11px] font-semibold text-red-700">{group.count}건</span>
              <span className="shrink-0 text-xs text-slate-400" aria-hidden>{open ? "⌃" : "⌄"}</span>
            </button>
            {open && (
              <div className="space-y-1 border-t border-red-100 p-1.5" role="listbox" aria-label={`${group.institution || "기관 미입력"} 진행건`}>
                {group.items.map((item) => {
                  const selected = item.key === selectedKey;
                  return (
                    <button key={item.key} type="button" role="option" aria-selected={selected} data-work-key={item.key}
                      onClick={() => onSelect(item)}
                      className={`relative w-full border px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${selected ? "z-10 rounded-lg border-red-400 bg-gradient-to-r from-red-100 via-red-50 to-red-50 shadow-sm min-[1280px]:rounded-r-none min-[1280px]:border-r-0" : "rounded-lg border-transparent hover:border-red-100 hover:bg-red-50/40"} ${item.muted && !selected ? "opacity-60" : ""}`}>
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-900">{item.company}</span>
                        <span className="shrink-0 text-[11px] font-semibold text-red-700">진행 {item.slot}</span>
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
