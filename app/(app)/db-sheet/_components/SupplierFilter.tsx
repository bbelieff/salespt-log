"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

type Props = { options: readonly string[]; selected: readonly string[]; onChange: (value: string[]) => void };
const label = (value: string) => value || "공급처 미입력";

/** Pure view filter: selection has no persistence or data-service side effects. */
export default function SupplierFilter({ options, selected, onChange }: Props) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState("");
  const trigger = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const values = [...new Set(options)];
  const [position, setPosition] = useState({ left: 12, top: 12, width: 320, maxHeight: 420 });
  function close(restore = false) { setOpen(false); if (restore) trigger.current?.focus(); }
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect(); if (!rect) return;
      const width = Math.min(320, window.innerWidth - 24);
      const nav=document.querySelector('[aria-label="업무 단계 내비게이션"]')?.getBoundingClientRect(),bottom=nav&&nav.height>0?Math.min(window.innerHeight,nav.top):window.innerHeight;
      const height=Math.min(panel.current?.scrollHeight||180,420,bottom-24),top=Math.max(12,Math.min(rect.bottom+7,bottom-height-8));
      const next = { left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top, width, maxHeight: bottom-top-8 };
      setPosition(old => Object.keys(next).every(key => old[key as keyof typeof next] === next[key as keyof typeof next]) ? old : next);
    };
    place(); window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open,query,values.length,selected.length]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !trigger.current?.contains(event.target) && !panel.current?.contains(event.target)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <>
    <button ref={trigger} type="button" className="sheet-status-chip sheet-supplier-filter" aria-pressed={selected.length > 0} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} title={selected.map(label).join(" · ")} onClick={() => { setQuery(""); setOpen(!open); }}>
      <span>{selected.length ? `공급처 ${selected.length}곳` : "전체 공급처"}</span><ChevronDown size={14} className="sheet-supplier-chevron shrink-0" aria-hidden="true" focusable="false"/>
    </button>
    {open && createPortal(<div ref={panel} id={id} className="sheet-filter-popover sheet-supplier-popover" role="dialog" aria-label="공급처 다중선택" style={position}>
      <header><strong>공급처 선택</strong><button type="button" aria-label="공급처 선택 닫기" onClick={() => close(true)}>✕</button></header>
      <input autoFocus className="sheet-input" type="search" aria-label="공급처 이름 검색" placeholder="공급처 검색" value={query} onChange={event => setQuery(event.target.value)}/>
      <div className="sheet-supplier-actions"><button type="button" onClick={() => onChange([...values])}>모두 선택 ({values.length}곳)</button><button type="button" onClick={() => onChange([])}>선택 해제</button></div>
      <div className="sheet-supplier-options">{values.filter(value => label(value).includes(query)).map(value => <label key={value}><input type="checkbox" checked={selected.includes(value)} onChange={() => onChange(selected.includes(value) ? selected.filter(current => current !== value) : [...selected, value])}/><span>{label(value)}</span></label>)}{!values.some(value => label(value).includes(query)) && <p>일치하는 공급처가 없습니다.</p>}</div>
      <footer>선택 없음 = 전체 공급처 · 여러 선택은 합쳐서 표시</footer>
    </div>, document.body)}
  </>;
}
