"use client";
/**
 * 한 달 보드 달력(PC) — 줄 하나 = 한 주(금~목이면 수강 한 주), 줄 머리 = 수강 주차·그 주 미팅 수.
 * 칸: 날짜 + 일정 줄(미팅 = 상태색 + 채널 점, 투두 = 진회색, 일반 = 청록) + 넘치면 「+N」. 시안 v2: docs/design/prototypes/calendar-month-board.html
 */
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import type { Meeting, Todo } from "@/types";
import { needsResult, type DayOrder } from "../../../schedule/_lib/board";
import { TodoTypeGlyph } from "../../../schedule/_components/board/glyphs";
import { CH_DOT, ST_BLOCK } from "../../../schedule/_components/board/board-style";

export type DayItem =
  | { kind: "m"; id: string; time: string; m: Meeting }
  | { kind: "t" | "e"; id: string; time: string; t: Todo };
export interface MonthCell { date: string; day: number; month: number; dow: number; out: boolean; items: DayItem[]; count: number; memo: boolean }
export interface MonthRow { start: string; label: string; course: boolean; stats: string; current: boolean; cells: MonthCell[] }

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const HEAD_H = 38, CELL_PAD = 33, PILL_H = 21;
const LINE = "border-slate-900/[0.07]";
const PILL = "flex h-[19px] min-w-0 shrink-0 items-center gap-1 overflow-hidden whitespace-nowrap rounded-md border px-[5px] text-left text-px-11 font-bold transition-opacity";

/** 투두의 업체 이름 — 오래된 진행건은 업체명 칸이 비어도 계약 ref 에 남아 있다(기존 캘린더와 같은 규칙). */
export const todoCompany = (t: Todo) => t.업체명.trim() || (t.contractRef ? t.contractRef.split("|").slice(1).join("|").trim() : "");

export default function MonthGrid({ rows, order, todayISO, selected, openId, now, onSelect, onOpen, onWeek }: {
  rows: MonthRow[]; order: DayOrder; todayISO: string; selected: string; openId: string | null; now: Date;
  onSelect: (date: string, out: boolean) => void; onOpen: (item: DayItem, rect: DOMRect) => void; onWeek: (start: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [cap, setCap] = useState(3);
  // 칸 높이에 들어가는 만큼만 그리고 나머지는 「+N」 — 창 크기가 바뀌면 다시 센다.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setCap(Math.max(1, Math.floor(((el.clientHeight - HEAD_H) / rows.length - CELL_PAD) / PILL_H)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [rows.length]);

  const sep = (i: number, dow: number) => (order === "mon" && dow === 5 ? " border-l-2 border-l-sky-500/60" : order === "fri" && i === 3 ? " border-l-2 border-l-slate-900/[0.12]" : ` border-l ${LINE}`);
  const dim = (id: string) => (openId && openId !== id ? " opacity-35 saturate-[.25]" : "");
  const open = (it: DayItem) => (e: MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); onOpen(it, e.currentTarget.getBoundingClientRect()); };

  const pill = (it: DayItem, out: boolean) => {
    const common = { type: "button" as const, "data-item": it.id, "aria-expanded": openId === it.id, tabIndex: out ? -1 : 0, onClick: open(it) };
    const ring = openId === it.id ? " ring-2 ring-sky-600 ring-offset-1" : "";
    const off = out ? " pointer-events-none" : "";
    if (it.kind === "m") {
      const m = it.m, need = needsResult(m, now), st = ST_BLOCK[m.상태];
      return (
        <button key={it.id} {...common} title={`${m.미팅시간} ${m.업체명} · ${m.상태}${need ? " · 결과 입력 필요" : ""}`} className={`${PILL} text-slate-900 ${st.box}${ring}${dim(it.id)}${off}`}>
          <i className={`h-[7px] w-[7px] shrink-0 rounded-sm ${CH_DOT[m.channel]}`} />
          <span className={`shrink-0 font-extrabold tabular-nums ${st.text}`}>{m.미팅시간}</span>
          <span className="min-w-0 truncate">{m.업체명}</span>
          {need && <i aria-hidden="true" className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500 ring-2 ring-amber-500/30" />}
        </button>
      );
    }
    const t = it.t;
    if (it.kind === "e") {
      return (
        <button key={it.id} {...common} title={`${t.예정시각 || "종일"} ${t.제목}`} className={`${PILL} border-teal-600/45 border-l-[3px] border-l-teal-600 bg-teal-50/70 text-slate-900${ring}${dim(it.id)}${off}`}>
          {t.예정시각 && <span className="shrink-0 font-extrabold tabular-nums text-teal-800">{t.예정시각}</span>}
          <span className="min-w-0 truncate">{t.제목}</span>
        </button>
      );
    }
    const co = todoCompany(t);
    return (
      <button key={it.id} {...common} title={`${t.예정시각 || "시간 미정"} ${co ? `${co} · ` : ""}${t.제목}`} className={`${PILL} border-transparent bg-slate-700/90 text-white${t.완료여부 ? " opacity-50" : ""}${ring}${dim(it.id)}${off}`}>
        <TodoTypeGlyph type={t.type} className="h-2.5 w-2.5 shrink-0" />
        {t.예정시각 && <span className="shrink-0 tabular-nums text-white/80">{t.예정시각}</span>}
        <span className={`min-w-0 truncate ${t.완료여부 ? "line-through" : ""}`}>{co && <b className="font-extrabold">{co} · </b>}{t.제목}</span>
      </button>
    );
  };

  return (
    <div ref={ref} className="grid h-full min-h-0 min-w-0 overflow-hidden pr-2" style={{ gridTemplateColumns: "84px repeat(7, minmax(0, 1fr))", gridTemplateRows: `${HEAD_H}px`, gridAutoRows: "minmax(0, 1fr)" }}>
      <div aria-hidden="true" className="border-b border-slate-900/[0.12]" />
      {rows[0]?.cells.map((c, i) => (
        <div key={c.dow} className={`flex items-center justify-center border-b border-b-slate-900/[0.12] text-xs font-bold ${c.dow === 0 ? "text-red-700" : c.dow === 6 ? "text-blue-700" : "text-slate-500"}${sep(i, c.dow)}`}>{DOW[c.dow]}</div>
      ))}
      {rows.map((r) => (
        <div key={r.start} className="contents">
          <button type="button" onClick={() => onWeek(r.start)} title="이 주의 주간 보드로" className={`flex min-w-0 flex-col items-center justify-center gap-0.5 border-b ${LINE} px-0.5 hover:bg-sky-500/10`}>
            <b className={`whitespace-nowrap text-px-11 font-extrabold tracking-tight ${r.current ? "rounded-full bg-sky-700 px-1.5 py-0.5 text-white" : r.course ? "text-sky-800" : "text-slate-500"}`}>{r.label}</b>
            {r.stats && <small className="whitespace-nowrap text-px-10 font-semibold tabular-nums text-slate-500">{r.stats}</small>}
          </button>
          {r.cells.map((c, i) => {
            const show = c.items.length > cap ? c.items.slice(0, Math.max(cap - 1, 0)) : c.items;
            const more = c.items.length - show.length;
            const today = c.date === todayISO, sel = c.date === selected;
            const key = (e: KeyboardEvent<HTMLDivElement>) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onSelect(c.date, c.out); } };
            return (
              <div key={c.date} role="button" tabIndex={0} aria-pressed={sel} aria-label={`${c.month}월 ${c.day}일 ${DOW[c.dow]}요일, 일정 ${c.count}건${c.memo ? ", 메모 있음" : ""}`}
                onClick={() => onSelect(c.date, c.out)} onKeyDown={key}
                className={`flex min-h-0 min-w-0 cursor-pointer flex-col gap-0.5 overflow-hidden border-b ${LINE} px-1 pb-[3px] pt-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-600${sep(i, c.dow)} ${sel ? "bg-sky-500/[0.09] shadow-[inset_0_0_0_2px_rgb(2_132_199/0.62)]" : today ? "bg-sky-500/[0.05]" : c.out ? "bg-slate-900/[0.025]" : "hover:bg-sky-500/[0.04]"}`}>
                <div className="flex h-6 shrink-0 items-center gap-1">
                  <b className={`grid h-6 min-w-6 place-items-center rounded-full px-1 text-px-13 font-bold tabular-nums ${today ? "bg-sky-700 text-white shadow-sm" : c.out ? "text-slate-400" : c.dow === 0 ? "text-red-700" : c.dow === 6 ? "text-blue-700" : "text-slate-900"}`}>{c.day}</b>
                  {c.day === 1 && <span className="text-px-11 font-bold text-slate-500">{c.month}월</span>}
                  {c.memo && <svg aria-hidden="true" viewBox="0 0 24 24" className="ml-auto h-3 w-3 shrink-0 text-amber-800" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>}
                </div>
                {show.map((it) => pill(it, c.out))}
                {more > 0 && <span className="h-[15px] shrink-0 pl-1 text-px-11 font-extrabold leading-[15px] text-slate-500">+{more}</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
