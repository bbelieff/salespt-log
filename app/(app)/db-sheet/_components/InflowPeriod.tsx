"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PeriodPicker from "@/components/ui/PeriodPicker";
import { inflowPeriodBounds, type InflowPeriodId } from "./inflow-period";

type Props = { period: InflowPeriodId; from: string; to: string; onPeriod: (value: InflowPeriodId) => void; onFrom: (value: string) => void; onTo: (value: string) => void };
/** Shared period choices with range fields outside the fixed-height filter row. */
export function InflowPeriod({ period, from, to, onPeriod, onFrom, onTo }: Props) {
  const [open, setOpen] = useState(false), [position, setPosition] = useState({ left: 12, top: 12, width: 304 });
  const group = useRef<HTMLDivElement>(null), panel = useRef<HTMLDivElement>(null), id = useId();
  const incomplete = period === "custom" && !inflowPeriodBounds(period, from, to);
  useLayoutEffect(() => {
    if (!open || period !== "custom") return;
    const place = () => {
      const rect = group.current?.querySelector('[data-period="custom"]')?.getBoundingClientRect(); if (!rect) return;
      const width = Math.min(304, window.innerWidth - 24);
      const next = { left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: Math.max(12, Math.min(rect.bottom + 7, window.innerHeight - 170)), width };
      setPosition(old => old.left === next.left && old.top === next.top && old.width === next.width ? old : next);
    };
    place(); window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open, period]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !group.current?.contains(event.target) && !panel.current?.contains(event.target)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); setOpen(false); group.current?.querySelector<HTMLButtonElement>('[data-period="custom"]')?.focus(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div ref={group} className="sheet-inflow-period" role="group" aria-label="유입일 기간" aria-controls={open && period === "custom" ? id : undefined}>
    <span>유입일</span>
    <button type="button" aria-pressed={period === "today"} onClick={() => { setOpen(false); onPeriod("today"); }} className="h-7 whitespace-nowrap rounded-full border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-500">오늘</button>
    <PeriodPicker period={period} from={from} to={to} onPeriod={value => { onPeriod(value); setOpen(value === "custom" && (period !== "custom" || !open)); }} onFrom={onFrom} onTo={onTo} labels={{ custom: "범위 지정" }} showRangeInputs={false}/>
    {open && period === "custom" && createPortal(<div ref={panel} id={id} className="sheet-filter-popover sheet-range-popover" role="dialog" aria-label="유입일 범위" style={position}>
      <header><strong>유입일 범위</strong><button type="button" aria-label="범위 입력 닫기" onClick={() => { setOpen(false); group.current?.querySelector<HTMLButtonElement>('[data-period="custom"]')?.focus(); }}>✕</button></header>
      <div className="sheet-range-inputs"><label>시작일<input autoFocus className="sheet-input" aria-label="조회 시작일" type="date" value={from} onInput={event => onFrom(event.currentTarget.value)} onChange={event => onFrom(event.target.value)}/></label><span aria-hidden>–</span><label>종료일<input className="sheet-input" aria-label="조회 종료일" type="date" value={to} onInput={event => onTo(event.currentTarget.value)} onChange={event => onTo(event.target.value)}/></label></div>
      {incomplete && <p role="status">시작일·종료일을 확인해 주세요. 현재 전체 기간을 표시합니다.</p>}
    </div>, document.body)}
  </div>;
}
