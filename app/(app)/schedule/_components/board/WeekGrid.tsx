"use client";
/**
 * 주간 격자(PC) — 요일 머리 · 메모 줄 · 종일 줄 · 07~22시 시간 칸.
 * 시안 v43(2026-11-11 belie 「이대로 운영반영」): docs/design/prototypes/schedule-week-board.html
 */
import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { Meeting, Todo } from "@/types";
import { BOARD_END_H, BOARD_START_H, groupTimedTodos, hourPct, layoutLanes, needsResult, toHours } from "../../_lib/board";
import { dayLabelKO, parseISO } from "../../_lib/week";
import { TodoTypeGlyph } from "./glyphs";
import { CH_DOT, LAYER_DOT, ST_BLOCK, type Layers } from "./board-style";

type Open = (rect: DOMRect) => void;
interface Props {
  days: string[]; meetings: Meeting[]; todos: Todo[]; memos: Record<string, string>; memoReady: boolean;
  layers: Layers; todayISO: string; now: Date; openKey: string | null;
  /** 월~일 보기에서 수강 주차가 바뀌는 칸·첫 칸에 붙이는 「수강 N주」(없으면 안 붙임). */
  courseTag: (date: string, index: number) => string | null; courseBoundary: number;
  onMemo: (date: string, text: string) => void;
  onMeeting: (m: Meeting, r: DOMRect) => void; onTodo: (t: Todo, r: DOMRect) => void;
  onCreate: (date: string, time: string | null, r: DOMRect) => void;
}

/** 요일 머리 + 접힌 메모 줄 = 왼쪽 제목 칸 높이(BOARD_TOP_H) — 두 덩어리의 아랫선을 맞춘다. */
export const HEAD_H = 114, MEMO_H = 64, BOARD_TOP_H = HEAD_H + MEMO_H;
const HOURS = Array.from({ length: BOARD_END_H - BOARD_START_H + 1 }, (_, i) => BOARD_START_H + i);
const pad = (n: number) => String(n).padStart(2, "0");
const toHHMM = (h: number) => `${pad(Math.floor(h))}:${pad(Math.round((h % 1) * 60))}`;
const rectOf = (e: MouseEvent<HTMLElement>) => e.currentTarget.getBoundingClientRect();

export default function WeekGrid(p: Props) {
  const [memoOpen, setMemoOpen] = useState(false);
  const sepAt = (i: number) => (i === p.courseBoundary ? " border-l-2 border-l-violet-300" : " border-l border-l-slate-200/80");
  const todayCls = (d: string) => (d === p.todayISO ? " bg-violet-500/[0.05]" : "");
  // 늘어난 메모 줄은 메모 칸·「메모」 버튼 밖을 누르면 3줄로 돌아간다.
  useEffect(() => {
    if (!memoOpen) return;
    const down = (e: PointerEvent) => { if (!(e.target as Element | null)?.closest("[data-memo],[data-memo-toggle]")) setMemoOpen(false); };
    window.addEventListener("pointerdown", down);
    return () => window.removeEventListener("pointerdown", down);
  }, [memoOpen]);

  return (
    <div className="grid h-full min-h-0 min-w-0 pr-2" style={{ gridTemplateColumns: "52px repeat(7, minmax(0, 1fr))", gridTemplateRows: `${HEAD_H}px ${memoOpen ? 196 : MEMO_H}px auto minmax(0, 1fr)`, transition: "grid-template-rows .26s cubic-bezier(.2,.9,.25,1)" }}>
      {/* 요일 머리 */}
      <div />
      {p.days.map((d, i) => {
        const dd = parseISO(d), dow = dd.getDay(), today = d === p.todayISO;
        const counts = [
          ["meet", p.meetings.filter((m) => m.미팅날짜 === d && m.상태 !== "변경").length],
          ["todo", p.todos.filter((t) => t.예정일자 === d && t.type !== "일반").length],
          ["event", p.todos.filter((t) => t.예정일자 === d && t.type === "일반").length],
        ] as const;
        const tag = p.courseTag(d, i);
        return (
          <div key={d} className={`relative flex flex-col items-center justify-center gap-0.5 border-b border-slate-200 pt-2${sepAt(i)}${todayCls(d)}`}>
            {tag && <span className="absolute left-1.5 top-1.5 rounded-full bg-violet-100 px-1.5 text-px-10 font-extrabold text-violet-700">{tag}</span>}
            <span className={`text-xs font-bold ${today ? "text-violet-700" : dow === 0 ? "text-red-600" : dow === 6 ? "text-blue-700" : "text-slate-500"}`}>{dayLabelKO(dd)}</span>
            <span className={`grid h-9 w-9 place-items-center rounded-full text-lg font-bold tabular-nums ${today ? "bg-violet-600 text-white shadow-md shadow-violet-300" : "text-slate-900"}`}>{dd.getDate()}</span>
            <span className="flex h-[23px] items-center justify-center gap-2.5" aria-label={`미팅 ${counts[0][1]}건, 실무 ${counts[1][1]}건, 일반 ${counts[2][1]}건`}>
              {counts.filter(([k, n]) => n && p.layers[k]).map(([k, n]) => (
                <span key={k} className="inline-flex items-center gap-1 text-px-11 font-bold tabular-nums text-slate-500"><i className={`h-1.5 w-1.5 rounded-full ${LAYER_DOT[k]}`} />{n}</span>
              ))}
            </span>
          </div>
        );
      })}

      {/* 메모 줄 — 누르면 10줄 안팎으로, 「메모」 버튼·바깥을 누르면 3줄로 */}
      <div className="flex items-center justify-center border-b border-slate-200 bg-amber-500/[0.06] p-1">
        <button type="button" data-memo-toggle onClick={() => setMemoOpen((v) => !v)} aria-expanded={memoOpen} aria-label={memoOpen ? "메모 칸 줄이기" : "메모 칸 늘리기"}
          className="flex w-[42px] flex-col items-center gap-px rounded-xl border border-amber-300/70 bg-amber-50 px-0 pb-0.5 pt-1.5 text-px-11 font-extrabold text-amber-800 hover:bg-amber-100">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>메모
          <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-3 w-3 transition-transform ${memoOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
        </button>
      </div>
      {p.days.map((d, i) => (
        <div key={d} className={`flex min-w-0 border-b border-slate-200 bg-amber-500/[0.06] p-1${sepAt(i)}${todayCls(d)}`}>
          <MemoCell date={d} value={p.memos[d] ?? ""} ready={p.memoReady} onSave={p.onMemo} onFocus={() => setMemoOpen(true)} />
        </div>
      ))}

      {/* 종일 줄 — 빈 곳을 누르면 종일 일정 만들기 */}
      <div className="flex items-center justify-center border-b border-slate-300 px-1 text-px-11 text-slate-400">종일</div>
      {p.days.map((d, i) => {
        const allDay = p.todos.filter((t) => t.예정일자 === d && !t.예정시각 && (t.type === "일반" ? p.layers.event : p.layers.todo));
        return (
          <div key={d} title="빈 곳을 눌러 종일 일정 만들기" onClick={(e) => { if (e.target === e.currentTarget) p.onCreate(d, null, rectOf(e)); }}
            className={`flex min-w-0 cursor-cell flex-col gap-0.5 border-b border-slate-300 p-1 hover:bg-teal-500/[0.05]${sepAt(i)}${todayCls(d)}`}>
            {allDay.map((t) => (
              <button key={t.id} type="button" onClick={(e) => t.type === "일반" ? undefined : p.onTodo(t, rectOf(e))} title={t.type === "일반" ? t.제목 : `${t.업체명} · ${t.제목}`}
                className={`flex h-5 min-w-0 items-center gap-1 rounded-md px-1.5 text-left text-px-12 font-semibold text-white ${t.type === "일반" ? "cursor-default bg-teal-600" : "bg-slate-700"} ${t.완료여부 ? "opacity-50 line-through" : ""}`}>
                <TodoTypeGlyph type={t.type} className="h-3 w-3 shrink-0" /><span className="truncate">{t.type === "일반" ? t.제목 : <><b className="font-extrabold">{t.업체명}</b> {t.제목}</>}</span>
              </button>
            ))}
          </div>
        );
      })}

      {/* 시간 칸 */}
      <div className="relative">
        {HOURS.map((h, i) => (
          <span key={h} className="absolute right-2 text-px-11 tabular-nums text-slate-400" style={i === 0 ? { top: 0 } : i === HOURS.length - 1 ? { bottom: 0 } : { top: `${hourPct(h)}%`, transform: "translateY(-50%)" }}>{pad(h)}:00</span>
        ))}
      </div>
      {p.days.map((d, i) => <DayColumn key={d} date={d} index={i} p={p} sep={sepAt(i)} today={todayCls(d)} />)}
    </div>
  );
}

type Item = { kind: "m"; m: Meeting } | { kind: "e"; t: Todo } | { kind: "g"; g: Todo[] };

function DayColumn({ date, p, sep, today }: { date: string; index: number; p: Props; sep: string; today: string }) {
  const items: { item: Item; start: number; end: number }[] = [
    ...(p.layers.meet ? p.meetings.filter((m) => m.미팅날짜 === date).map((m) => ({ item: { kind: "m" as const, m }, start: toHours(m.미팅시간), end: toHours(m.미팅시간) + 1 })) : []),
    ...(p.layers.event ? p.todos.filter((t) => t.예정일자 === date && t.type === "일반" && t.예정시각).map((t) => ({ item: { kind: "e" as const, t }, start: toHours(t.예정시각), end: toHours(t.예정시각) + 1 })) : []),
    ...(p.layers.todo ? groupTimedTodos(p.todos.filter((t) => t.예정일자 === date && t.type !== "일반" && t.예정시각)).map((g) => ({ item: { kind: "g" as const, g: g.todos }, start: g.start, end: g.end })) : []),
  ];
  const nowH = p.now.getHours() + p.now.getMinutes() / 60;
  const click = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const r = e.currentTarget.getBoundingClientRect();
    let h = BOARD_START_H + ((e.clientY - r.top) / r.height) * (BOARD_END_H - BOARD_START_H);
    h = Math.max(BOARD_START_H, Math.min(BOARD_END_H - 1, Math.floor(h * 2) / 2));
    p.onCreate(date, toHHMM(h), new DOMRect(r.left, e.clientY - 10, r.width, 20));
  };
  return (
    <div onClick={click} className={`relative min-w-0 cursor-cell${sep}${today}`}
      style={{ backgroundImage: "linear-gradient(to top, rgb(15 23 42 / 0.07) 1px, transparent 1px)", backgroundSize: `100% calc(100% / ${BOARD_END_H - BOARD_START_H})` }}>
      {layoutLanes(items).map(({ item, start, end, lane, lanes }) => {
        const top = hourPct(start), h = hourPct(end) - top, w = 100 / lanes;
        const style = { top: `calc(${top}% + 1px)`, height: `calc(${h}% - 2px)`, left: `calc(${lane * w}% + 3px)`, width: `calc(${w}% - 6px)` };
        if (item.kind === "m") {
          const m = item.m, s = ST_BLOCK[m.상태], need = needsResult(m, p.now), active = p.openKey === `m:${m.id}`;
          return (
            <button key={m.id} type="button" data-meet={m.id} style={style} onClick={(e) => p.onMeeting(m, rectOf(e))} aria-label={`${m.업체명} ${m.미팅시간} ${m.상태}${need ? ", 결과 입력 필요" : ""}`}
              className={`absolute z-[2] overflow-hidden rounded-lg border px-1.5 py-1 text-left shadow-sm transition-opacity ${s.box} ${active ? "ring-2 ring-violet-500" : ""} ${p.openKey && !active ? "opacity-40 saturate-50" : ""}`}>
              {need && <i aria-hidden="true" className="absolute right-1 top-1 h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />}
              <span className="flex min-w-0 items-center gap-1 text-px-12 font-bold text-slate-900"><i className={`h-1.5 w-1.5 shrink-0 rounded-full ${CH_DOT[m.channel]}`} /><span className={`truncate ${m.상태 === "취소" ? "line-through" : ""}`}>{m.업체명}</span></span>
              <span className={`block truncate text-px-11 font-semibold tabular-nums ${s.text}`}>{m.상태 === "계약" && m.수임비 ? `${m.수임비.toLocaleString("ko-KR")}원` : `${m.미팅시간} · ${m.상태}`}</span>
            </button>
          );
        }
        if (item.kind === "e") {
          const t = item.t;
          return (
            <div key={t.id} style={style} title={t.제목} className={`absolute z-[2] overflow-hidden rounded-lg border border-teal-300 bg-teal-50 px-1.5 py-1 ${p.openKey ? "opacity-40" : ""}`}>
              <span className="block truncate text-px-12 font-bold text-slate-900">{t.제목}</span>
              <span className="block text-px-11 tabular-nums text-teal-800">{t.예정시각}</span>
            </div>
          );
        }
        return (
          <div key={item.g[0]!.id} style={style} role="group" aria-label={`실무 투두 ${item.g.length}건`} className="absolute z-[2] flex flex-col gap-px overflow-hidden rounded-lg bg-slate-700/95 p-[3px] shadow-sm">
            {item.g.map((t) => {
              const active = p.openKey === `t:${t.id}`;
              return (
                <button key={t.id} type="button" onClick={(e) => p.onTodo(t, rectOf(e))} title={`${t.예정시각} ${t.업체명} · ${t.제목}${t.result ? ` — 결과: ${t.result}` : ""}`}
                  className={`flex min-h-[17px] min-w-0 flex-1 items-center gap-1 rounded px-1 text-left text-px-11 font-semibold text-white hover:bg-white/15 ${active ? "bg-white/25" : ""} ${t.완료여부 ? "opacity-50" : ""} ${p.openKey && !active ? "opacity-40" : ""}`}>
                  <TodoTypeGlyph type={t.type} className="h-3 w-3 shrink-0" />
                  {item.g.length > 1 && <span className="shrink-0 text-px-10 tabular-nums opacity-75">{t.예정시각}</span>}
                  <span className={`truncate ${t.완료여부 ? "line-through" : ""}`}><b className="font-extrabold">{t.업체명}</b> {t.제목}</span>
                  {item.g.length === 1 && <span className="ml-auto shrink-0 text-px-10 tabular-nums opacity-75">{t.예정시각}</span>}
                </button>
              );
            })}
          </div>
        );
      })}
      {date === p.todayISO && nowH >= BOARD_START_H && nowH <= BOARD_END_H && (
        <div aria-hidden="true" className="pointer-events-none absolute -left-px right-0 z-[4] h-0.5 bg-red-500" style={{ top: `${hourPct(nowH)}%` }}>
          <i className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500" />
        </div>
      )}
    </div>
  );
}

/** 메모 칸 — 입력을 멈추고 0.8초 뒤, 또는 칸을 벗어나면 저장. 저장소가 없으면(표 미적용) 잠근다. */
function MemoCell({ date, value, ready, onSave, onFocus }: { date: string; value: string; ready: boolean; onSave: (d: string, t: string) => void; onFocus: () => void }) {
  const [text, setText] = useState(value);
  const saved = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => { if (document.activeElement?.getAttribute("data-memo") !== date) { setText(value); saved.current = value; } }, [value, date]);
  const flush = (t: string) => { clearTimeout(timer.current); if (t !== saved.current) { saved.current = t; onSave(date, t); } };
  return (
    <textarea data-memo={date} value={text} disabled={!ready} maxLength={2000} aria-label={`${parseISO(date).getMonth() + 1}월 ${parseISO(date).getDate()}일 메모`}
      title={ready ? undefined : "메모 저장소 준비 중 — 잠시 뒤 다시 열어 주세요"}
      onFocus={onFocus} onBlur={() => flush(text)}
      onChange={(e) => { const t = e.target.value; setText(t); clearTimeout(timer.current); timer.current = setTimeout(() => flush(t), 800); }}
      className="min-w-0 flex-1 resize-none rounded-lg border border-transparent bg-white/50 px-2 py-1 text-xs leading-snug text-slate-700 outline-none hover:border-slate-200 focus:border-violet-400 focus:bg-white disabled:opacity-60" />
  );
}
