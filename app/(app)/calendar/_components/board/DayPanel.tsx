"use client";
/**
 * 한 달 보드 왼쪽 「선택한 날」 판 — 그 날 메모(주간 보드 일별 메모와 같은 기록) + 일정 줄(시간순) + 「+ 일정」.
 * 줄을 누르면 주간 보드와 같은 창이 뜬다. 구글 캘린더에 연결돼 있으면 줄 끝에 담기/빼기.
 */
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { needsResult } from "../../../schedule/_lib/board";
import { dayLabelKO, parseISO } from "../../../schedule/_lib/week";
import { CH_DOT } from "../../../schedule/_components/board/board-style";
import GcalItemToggle from "../GcalItemToggle";
import { todoCompany, type DayItem } from "./MonthGrid";

const ST_TEXT = { 예약: "text-amber-800", 계약: "text-green-800", 완료: "text-orange-800", 변경: "text-purple-800", 취소: "text-red-700" } as const;
export interface GcalBridge { connected: boolean; states: Record<string, boolean>; onChange: (id: string, on: boolean) => void; onToast: (msg: string) => void }

export default function DayPanel({ date, todayISO, items, now, memo, memoReady, onMemo, openId, onOpen, onAdd, gcal }: {
  date: string; todayISO: string; items: DayItem[]; now: Date; memo: string; memoReady: boolean; onMemo: (date: string, text: string) => void;
  openId: string | null; onOpen: (item: DayItem, rect: DOMRect) => void; onAdd: (rect: DOMRect) => void; gcal: GcalBridge;
}) {
  const d = parseISO(date);
  const rect = (e: MouseEvent<HTMLElement>) => e.currentTarget.getBoundingClientRect();
  return (
    <section aria-label="선택한 날" className="flex min-h-0 flex-1 flex-col">
      <h2 className="flex shrink-0 items-center gap-2 px-3.5 pb-2 pt-3 text-sm font-extrabold text-slate-900">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-sky-700" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
        <span className="tabular-nums">{d.getMonth() + 1}/{d.getDate()} ({dayLabelKO(d)})</span>
        {date === todayISO && <span className="rounded-full bg-sky-700 px-2 py-0.5 text-px-11 font-extrabold text-white">오늘</span>}
        <span className="ml-auto text-px-11 font-bold tabular-nums text-slate-500">{items.length ? `${items.length}건` : ""}</span>
      </h2>
      <div className="wb-mscroll min-h-0 flex-1 overflow-y-auto px-3.5 pb-3.5">
        <label className="flex items-start gap-1.5 rounded-[10px] bg-amber-500/[0.09] px-2 py-1.5">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-800" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
          <DayMemo key={date} date={date} value={memo} ready={memoReady} onSave={onMemo} />
        </label>
        {items.length === 0 ? <p className="mb-1 mt-3 text-center text-xs text-slate-500">이 날은 일정이 없어요</p> : (
          <ul className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-1">
            {items.map((it) => {
              const on = openId === it.id;
              const m = it.kind === "m" ? it.m : null, t = it.kind === "m" ? null : it.t;
              const gone = m ? m.상태 === "취소" || m.상태 === "변경" : it.kind === "t" && !!t?.완료여부;
              const name = m ? m.업체명 : it.kind === "e" ? t!.제목 : `${todoCompany(t!) ? `${todoCompany(t!)} · ` : ""}${t!.제목}`;
              const badge = m ? (needsResult(m, now) ? "입력" : m.상태) : it.kind === "e" ? "일반" : t!.완료여부 ? "완료" : "투두";
              const tone = m ? ST_TEXT[m.상태] : it.kind === "e" ? "text-teal-800" : "text-slate-500";
              return (
                <li key={it.id} className={`flex min-w-0 items-center gap-0.5 rounded-[9px] border ${on ? "border-sky-500/50 bg-sky-500/10" : "border-slate-900/[0.07] bg-white/45 hover:border-sky-500/45 hover:bg-sky-500/10"}`}>
                  <button type="button" onClick={(e) => onOpen(it, rect(e))} aria-expanded={on} className="flex h-9 min-w-0 flex-1 items-center gap-1.5 pl-2 pr-1 text-left">
                    <span className="w-9 shrink-0 text-px-11 font-extrabold tabular-nums text-slate-900">{it.time || (it.kind === "e" ? "종일" : "—")}</span>
                    <i className={`h-2 w-2 shrink-0 ${m ? `rounded-sm ${CH_DOT[m.channel]}` : `rounded-full ${it.kind === "e" ? "bg-teal-600" : "bg-slate-700"}`}`} />
                    <span className={`min-w-0 flex-1 truncate text-px-13 font-bold ${gone ? "text-slate-500 line-through" : "text-slate-900"}`}>{name}</span>
                    <span className={`shrink-0 text-px-11 font-extrabold ${tone}`}>{badge}</span>
                  </button>
                  {gcal.connected && <GcalItemToggle kind={m ? "meeting" : "todo"} id={it.id} on={gcal.states[it.id] ?? true} onChange={gcal.onChange} onToast={gcal.onToast} />}
                </li>
              );
            })}
          </ul>
        )}
        <button type="button" onClick={(e) => onAdd(rect(e))} className="mt-1.5 flex h-[34px] w-full items-center justify-center gap-1 rounded-[10px] border border-dashed border-teal-600/55 text-xs font-extrabold text-teal-700 hover:bg-teal-600/[0.08]">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>일정
        </button>
      </div>
    </section>
  );
}

/** 메모 — 0.8초 뒤·칸을 떠날 때 저장(주간 보드 메모 칸과 같은 방식). */
export function DayMemo({ date, value, ready, onSave }: { date: string; value: string; ready: boolean; onSave: (date: string, text: string) => void }) {
  const [text, setText] = useState(value);
  const saved = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const el = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (document.activeElement !== el.current) { setText(value); saved.current = value; } }, [value]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const flush = (t: string) => { clearTimeout(timer.current); if (t !== saved.current) { saved.current = t; onSave(date, t); } };
  return (
    <textarea ref={el} value={text} disabled={!ready} maxLength={2000} rows={2} aria-label="선택한 날 메모" placeholder="이 날 메모 — 주간 보드 메모와 같은 내용"
      title={ready ? undefined : "메모 저장소 준비 중 — 잠시 뒤 다시 열어 주세요"} onBlur={() => flush(text)}
      onChange={(e) => { const t = e.target.value; setText(t); clearTimeout(timer.current); timer.current = setTimeout(() => flush(t), 800); }}
      className="min-h-[38px] min-w-0 flex-1 resize-none bg-transparent text-xs leading-normal text-slate-700 outline-none placeholder:text-slate-500 disabled:opacity-60" />
  );
}
