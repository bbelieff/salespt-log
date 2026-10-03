"use client";

import { useRef, useState, type MouseEvent } from "react";
import type { WorkStatusItem, WorkStatusKey } from "@/lib/analytics/payment-work-status";

const STATUS: Array<{ key: WorkStatusKey; label: string; color: string; text: string }> = [
  { key: "waiting", label: "진행대기", color: "bg-slate-300", text: "text-slate-800" },
  { key: "progress", label: "진행", color: "bg-gradient-to-r from-sky-400 to-blue-500", text: "text-white" },
  { key: "approved", label: "승인", color: "bg-gradient-to-r from-violet-400 to-fuchsia-400", text: "text-white" },
  { key: "collection-waiting", label: "수납대기", color: "bg-gradient-to-r from-amber-300 to-orange-400", text: "text-amber-950" },
  { key: "collected", label: "수납완료", color: "bg-gradient-to-r from-emerald-400 to-teal-400", text: "text-white" },
];

/** 팝업 폭(px) — 마우스 지점에 띄울 때 좌우로 넘치지 않게 계산하는 기준. */
const POPOVER_WIDTH = 360;

interface Props {
  items: WorkStatusItem[];
  onNavigate: (row: number | null, slot: 1 | 2 | 3) => void;
  popoverPlacement?: "top" | "bottom";
}

export default function WorkStatusBar({ items, onNavigate, popoverPlacement = "bottom" }: Props) {
  const [open, setOpen] = useState<WorkStatusKey | null>(null);
  // 팝업은 마우스(또는 누른 버튼)가 있는 가로 위치에서 뜬다 — 막대 오른쪽 끝에 고정되지 않게(belie 2026-09-29).
  const [anchorX, setAnchorX] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = open ? items.filter((item) => item.status === open) : [];
  const status = STATUS.find((s) => s.key === open);

  const openAt = (key: WorkStatusKey, e: MouseEvent<HTMLElement>) => {
    const root = rootRef.current?.getBoundingClientRect();
    // 키보드로 누르면 clientX 가 0 — 그땐 버튼 가운데를 기준으로 삼는다.
    const target = e.currentTarget.getBoundingClientRect();
    const x = e.clientX > 0 ? e.clientX : target.left + target.width / 2;
    setAnchorX(root ? x - root.left : null);
    setOpen(key);
  };

  const rootWidth = rootRef.current?.getBoundingClientRect().width ?? 0;
  const popoverWidth = Math.min(POPOVER_WIDTH, typeof window === "undefined" ? POPOVER_WIDTH : window.innerWidth * 0.9);
  // 포인터 지점이 팝업 왼쪽 위 모서리 근처에 오도록 두되, 작업판 밖으로 나가면 안쪽으로 당긴다.
  const left = anchorX === null ? null : Math.max(0, Math.min(anchorX - 16, rootWidth - popoverWidth));

  return (
    <div ref={rootRef} className="relative min-w-0 self-center" data-work-status-bar>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <strong className="whitespace-nowrap text-xs text-slate-800">전체 진행건</strong>
        <b className="whitespace-nowrap text-base tabular-nums text-slate-950">{items.length}건</b>
        <div className="flex h-4 w-full min-w-12 overflow-hidden rounded-full border border-white/80 bg-slate-100 p-[2px] shadow-inner min-[1280px]:w-auto min-[1280px]:flex-1" role="group" aria-label="업무 상태">
          {STATUS.map((s) => {
            const count = items.filter((item) => item.status === s.key).length;
            return count > 0 ? <button key={s.key} type="button" onClick={(e) => openAt(s.key, e)} onMouseEnter={(e) => openAt(s.key, e)} className={`${s.color} h-full min-w-[8px] rounded-full transition-[filter] hover:brightness-105`} style={{ width: `${count / items.length * 100}%` }} aria-label={`${s.label} ${count}건`} /> : null;
          })}
        </div>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-px-11 text-slate-500">
        {STATUS.map((s) => <button type="button" key={s.key} onClick={(e) => openAt(s.key, e)} className="inline-flex items-center gap-1 hover:text-slate-900"><span className={`h-2 w-2 rounded-full ${s.color}`}/>{s.label} <b className="tabular-nums text-slate-700">{items.filter((item) => item.status === s.key).length}</b></button>)}
      </div>
      {open && status && <div data-work-status-popover className={`absolute z-[500] max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-2xl ${left === null ? "right-0" : ""} ${popoverPlacement === "top" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]"}`} style={{ width: popoverWidth, ...(left === null ? {} : { left }) }} onMouseLeave={() => setOpen(null)}>
        {/* 제목줄을 해당 상태의 막대 색으로 채워 어떤 상태 목록인지 바로 알아보게. */}
        <div data-work-status-banner className={`mb-1 flex items-center justify-between rounded-lg px-2 py-1.5 text-xs font-bold ${status.color} ${status.text}`}><span>{status.label} {active.length}건</span><button type="button" onClick={() => setOpen(null)} className="rounded p-0.5 leading-none opacity-80 hover:opacity-100" aria-label="닫기">×</button></div>
        {active.map((item) => <button type="button" key={item.key} onClick={() => { onNavigate(item.row, item.slot); setOpen(null); }} className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-blue-50"><span className="block truncate text-xs font-semibold text-slate-800">{item.company} · 진행 {item.slot} · {item.product || "상품 미정"}</span><span className="block truncate text-px-11 text-slate-400">{item.institution || "기관 미정"}</span></button>)}
      </div>}
    </div>
  );
}
