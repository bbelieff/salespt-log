"use client";
/**
 * 지방세 발급기관(시·도 + 시·군·구) 검색기(목업). 목록은 기존 정본 lib/util/admin-regions(SIDO·SIGUNGU)를 그대로 쓴다.
 * 지방세는 시·군·자치구가 부과하므로 일반구(수원시 장안구)는 목록에 없다 — 정본과 같은 단위.
 * 「강남」「수원」「경기 성남」처럼 일부만 쳐도 찾는다. 위/아래 화살표 + Enter, Esc 로 닫기.
 */
import { useId, useMemo, useState } from "react";
import { MapPin, X } from "lucide-react";
import { SIDO, SIGUNGU } from "@/util/admin-regions";

const ALL: string[] = SIDO.flatMap(s => (SIGUNGU[s].length ? SIGUNGU[s].map(g => `${s} ${g}`) : [s]));

export default function RegionSearch({ id, value, onChange, invalid }: { id: string; value: string; onChange: (v: string) => void; invalid?: Record<string, unknown> }) {
  const listId = useId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const hits = useMemo(() => {
    const words = q.trim().split(/\s+/).filter(Boolean);
    return words.length ? ALL.filter(r => words.every(w => r.includes(w))).slice(0, 8) : [];
  }, [q]);
  const pick = (r: string) => { onChange(r); setQ(""); setOpen(false); };

  if (value) return (
    <div className="mt-1 flex items-center gap-2 rounded-lg border border-blue-500 bg-blue-50 px-3 py-2 text-base text-blue-800">
      <MapPin className="h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate font-medium">{value}</span>
      <button type="button" onClick={() => onChange("")} aria-label={`${value} 지우고 다시 찾기`} className="rounded p-0.5 text-blue-700 hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"><X className="h-4 w-4" aria-hidden /></button>
    </div>
  );
  return (
    <div className="relative mt-1">
      <input id={id} role="combobox" aria-expanded={open && hits.length > 0} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={open && hits[hi] ? `${listId}-${hi}` : undefined}
        value={q} placeholder="시·군·구 이름 (예: 강남, 수원)" autoComplete="off"
        onChange={e => { setQ(e.target.value); setOpen(true); setHi(0); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={e => {
          if (e.key === "ArrowDown") { e.preventDefault(); setHi(h => Math.min(h + 1, hits.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
          else if (e.key === "Enter" && open && hits[hi]) { e.preventDefault(); pick(hits[hi]); }
          else if (e.key === "Escape") setOpen(false);
        }}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base focus:border-blue-500 focus:outline-none" {...invalid} />
      {open && q.trim() && (
        <ul id={listId} role="listbox" aria-label="시·군·구" className="absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {hits.length === 0 && <li className="px-3 py-2 text-sm text-gray-500">찾는 시·군·구가 없어요</li>}
          {hits.map((r, i) => (
            <li key={r} id={`${listId}-${i}`} role="option" aria-selected={i === hi}
              onMouseDown={e => { e.preventDefault(); pick(r); }} onMouseEnter={() => setHi(i)}
              className={`cursor-pointer px-3 py-2 text-base ${i === hi ? "bg-blue-50 text-blue-800" : "text-gray-800"}`}>
              <span className="text-gray-500">{r.split(" ")[0]}</span> {r.split(" ").slice(1).join(" ")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
