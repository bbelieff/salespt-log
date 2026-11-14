"use client";
/**
 * 캘린더 탭 폰·태블릿 월 보기(1280px 미만 — 1024~1279px 는 사이드탭 옆에서 같은 달력을 넓게) — 달력이 화면을 꽉 채우고 칸마다 일정 3~4줄(구글 캘린더처럼).
 * 날짜 칸 → 아래에서 올라오는 그 날 창(메모·전체 일정·「+ 일정」) → 일정을 누르면 같은 자리에서 미팅 결과·투두 처리.
 * 데이터·저장은 PC 한 달 보드와 같은 useMonthData. 시안 v2: docs/design/prototypes/calendar-phone.html
 */
import { useLayoutEffect, useRef, useState } from "react";
import type { Meeting, MeetingState } from "@/types";
import AppToast from "@/components/ui/AppToast";
import { formatWon } from "@/lib/format/money";
import { needsResult, type DayOrder } from "../../../schedule/_lib/board";
import { dayLabelKO, parseISO } from "../../../schedule/_lib/week";
import BoardMeetingPop from "../../../schedule/_components/board/BoardMeetingPop";
import BoardPopover from "../../../schedule/_components/board/BoardPopover";
import MeetingPopHead from "../../../schedule/_components/board/MeetingPopHead";
import TodoPopover from "../../../schedule/_components/board/TodoPopover";
import { CH_DOT, CH_EDGE, LAYER_DOT, LAYER_LABEL, type LayerKey } from "../../../schedule/_components/board/board-style";
import "../../../schedule/_components/board/week-board.css";
import GcalConnectCard from "../GcalConnectCard";
import GcalItemToggle from "../GcalItemToggle";
import GeneralEventModal from "../GeneralEventModal";
import { DayMemo } from "../board/DayPanel";
import EventViewPopover from "../board/EventViewPopover";
import { todoCompany, type DayItem, type MonthRow } from "../board/MonthGrid";
import { useMonthData } from "../board/useMonthData";
import "../board/month-board.css";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const STATES: MeetingState[] = ["예약", "계약", "완료", "변경", "취소"];
const ST_BAR: Record<MeetingState, string> = { 예약: "bg-amber-100 text-amber-900", 계약: "bg-green-100 text-green-900", 완료: "bg-orange-100 text-orange-900", 변경: "bg-purple-100 text-purple-900", 취소: "bg-red-100 text-red-900" };
const ST_TEXT: Record<MeetingState, string> = { 예약: "text-amber-800", 계약: "text-green-800", 완료: "text-orange-800", 변경: "text-purple-800", 취소: "text-red-700" };
const HEAD_H = 24, CELL_PAD = 27, BAR_H = 19;

export default function PhoneMonth({ yyyyMM, selected, todayISO, order, onOrder, onSelect }: {
  yyyyMM: string; selected: string; todayISO: string; order: DayOrder; onOrder: (o: DayOrder) => void; onSelect: (date: string) => void;
}) {
  const d = useMonthData({ yyyyMM, selected, todayISO, order });
  const now = new Date();
  const [sheet, setSheet] = useState<"day" | "sum" | "set" | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const closeAll = () => { setItemId(null); setSheet(null); };
  const back = sheet ? () => setItemId(null) : undefined;
  const pending = d.monthMeetings.filter((m) => needsResult(m, now)).sort((a, b) => (a.미팅날짜 + a.미팅시간).localeCompare(b.미팅날짜 + b.미팅시간));
  const openMeeting = itemId ? d.findMeeting(itemId) : undefined;
  const openTodo = itemId && !openMeeting ? d.findTodo(itemId) : undefined;
  const sel = parseISO(selected);

  const row = (it: DayItem, withDate = false) => {
    const m = it.kind === "m" ? it.m : null, t = it.kind === "m" ? null : it.t;
    const gone = m ? m.상태 === "취소" || m.상태 === "변경" : it.kind === "t" && !!t?.완료여부;
    const badge = m ? (needsResult(m, now) ? "결과 입력" : m.상태) : it.kind === "e" ? "일반" : t!.완료여부 ? "완료" : "투두";
    return (
      <li key={it.id} className="flex min-w-0 items-center border-t border-slate-900/[0.08] first:border-t-0">
        <button type="button" onClick={() => setItemId(it.id)} className="flex min-h-[54px] min-w-0 flex-1 items-center gap-2 py-1.5 text-left">
          <span className={`shrink-0 font-extrabold tabular-nums ${withDate ? "text-xs text-slate-500" : "w-11 text-sm text-slate-900"}`}>{withDate && m ? `${m.미팅날짜.slice(5).replace("-", "/")} ${m.미팅시간}` : it.time || (it.kind === "e" ? "종일" : "—")}</span>
          <i className={`h-2.5 w-2.5 shrink-0 ${m ? `rounded-[3px] ${CH_DOT[m.channel]}` : it.kind === "e" ? "rounded-full bg-teal-600" : "rounded-[3px] bg-slate-700"}`} />
          <span className="grid min-w-0 flex-1">
            <span className={`truncate text-px-15 font-extrabold ${gone ? "text-slate-500 line-through" : "text-slate-900"}`}>{m ? m.업체명 : it.kind === "e" ? t!.제목 : todoCompany(t!) || t!.제목}</span>
            <span className="truncate text-xs text-slate-500">{m ? `${m.channel}${m.장소 ? ` · ${m.장소}` : ""}` : it.kind === "e" ? "일반 일정" : t!.제목}</span>
          </span>
          <span className={`shrink-0 rounded-lg bg-slate-900/[0.05] px-2 py-0.5 text-px-11 font-extrabold ${m ? ST_TEXT[m.상태] : it.kind === "e" ? "text-teal-800" : "text-slate-500"}`}>{badge}</span>
        </button>
        {d.gcal.connected && <GcalItemToggle kind={m ? "meeting" : "todo"} id={it.id} on={d.gcal.states[it.id] ?? true} onChange={d.gcal.onChange} onToast={d.gcal.onToast} />}
      </li>
    );
  };

  return (
    <div className="wb-sky flex flex-col bg-white" style={{ height: "calc(100dvh - var(--app-header-height) - 3rem - env(safe-area-inset-bottom, 0px))", minHeight: 420 }}>
      {d.elements}
      <div className="flex h-11 shrink-0 items-center gap-1.5 border-b border-slate-900/[0.08] px-2.5">
        {(Object.keys(LAYER_LABEL) as LayerKey[]).map((k) => (
          <button key={k} type="button" aria-pressed={d.layers[k]} onClick={() => d.toggleLayer(k)}
            className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-px-13 font-bold ${d.layers[k] ? "border-slate-900/[0.14] text-slate-700" : "border-dashed border-slate-900/[0.14] text-slate-500"}`}>
            <i className={`h-2 w-2 rounded-full ${LAYER_DOT[k]} ${d.layers[k] ? "" : "opacity-30"}`} />{LAYER_LABEL[k]}
          </button>
        ))}
        <button type="button" onClick={() => setSheet("sum")} className={`ml-auto flex h-8 shrink-0 items-center rounded-full border px-2.5 text-px-13 font-extrabold ${pending.length ? "border-amber-400 bg-amber-100 text-amber-900" : "border-slate-900/[0.14] text-slate-700"}`}>
          {pending.length ? `대기 ${pending.length}` : `${d.monthMeetings.length}건`}
        </button>
        <button type="button" onClick={() => setSheet("set")} aria-label="캘린더 설정" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-100">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></svg>
        </button>
      </div>

      {d.isError ? <p role="alert" className="px-4 pt-6 text-sm text-red-700 pc:px-6">불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
        : <PhoneGrid rows={d.rows} order={order} todayISO={todayISO} active={sheet === "day" ? selected : null} now={now} onDay={(date) => { onSelect(date); setItemId(null); setSheet("day"); }} />}

      <button type="button" onClick={() => setAdding(true)} aria-label="일정 추가" className="fixed bottom-[calc(18px+env(safe-area-inset-bottom,0px))] right-4 z-30 grid h-14 w-14 place-items-center rounded-[18px] bg-sky-700 text-white shadow-lg shadow-sky-700/40 active:scale-95">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
      </button>

      {!itemId && sheet === "day" && (
        <BoardPopover anchor={null} onClose={closeAll} label={`${sel.getMonth() + 1}월 ${sel.getDate()}일 일정`} title={<>
          <h3 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-slate-900"><span className="tabular-nums">{sel.getMonth() + 1}/{sel.getDate()} ({dayLabelKO(sel)})</span>{selected === todayISO && <span className="rounded-full bg-sky-700 px-2 py-0.5 text-px-11 font-extrabold text-white">오늘</span>}</h3>
          <p className="mt-0.5 text-xs tabular-nums text-slate-500">일정 {d.dayItems.length}건</p>
        </>}>
          <label className="flex items-start gap-1.5 rounded-[11px] bg-amber-100/70 px-2.5 py-2">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-1 h-3.5 w-3.5 shrink-0 text-amber-800" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
            <DayMemo key={selected} date={selected} value={d.memos[selected] ?? ""} ready={d.notesReady} onSave={d.saveMemo} />
          </label>
          {d.dayItems.length ? <ul className="mt-1.5">{d.dayItems.map((it) => row(it))}</ul> : <p className="mb-1 mt-4 text-center text-px-13 text-slate-500">이 날은 일정이 없어요</p>}
          <button type="button" onClick={() => { setSheet(null); setAdding(true); }} className="mt-2 flex h-[46px] w-full items-center justify-center gap-1 rounded-xl border border-dashed border-teal-600/60 text-sm font-extrabold text-teal-700">+ 일정</button>
        </BoardPopover>
      )}
      {!itemId && sheet === "sum" && (
        <BoardPopover anchor={null} onClose={closeAll} label="이번 달 미팅 결과" title={<>
          <h3 className="text-lg font-extrabold tracking-tight text-slate-900">{d.thisMonth ? "이번 달" : `${d.mon}월`} 미팅 결과</h3>
          <p className="mt-0.5 text-xs tabular-nums text-slate-500">미팅 {d.monthMeetings.length}건 · 결과 대기 {pending.length}건</p>
        </>}>
          <div className="grid grid-cols-5 text-center">
            {STATES.map((s) => { const n = d.monthMeetings.filter((m: Meeting) => m.상태 === s).length; return <div key={s} className="text-px-11 text-slate-500"><b className={`block text-lg font-extrabold tabular-nums ${n ? ST_TEXT[s] : "text-slate-400"}`}>{n}</b>{s}</div>; })}
          </div>
          <p className="mt-2.5 flex items-baseline justify-between border-t border-slate-900/[0.08] pt-2.5 text-px-13 font-bold text-slate-500">계약 수임비<b className="text-base font-extrabold tabular-nums text-green-800">{formatWon(d.fee)}</b></p>
          {pending.length ? <><p className="mt-3.5 text-px-13 font-extrabold text-amber-800">결과 입력 대기 {pending.length}건</p><ul>{pending.map((m) => row({ kind: "m", id: m.id, time: m.미팅시간, m }, true))}</ul></>
            : <p className="mt-4 text-center text-px-13 text-slate-500">지난 미팅 결과를 모두 넣었어요</p>}
        </BoardPopover>
      )}
      {sheet === "set" && (
        <BoardPopover anchor={null} onClose={closeAll} label="캘린더 설정" title={<h3 className="text-lg font-extrabold tracking-tight text-slate-900">캘린더 설정</h3>}>
          <div className="flex min-h-[52px] items-center justify-between gap-3 text-px-15 font-bold text-slate-900">요일 순서
            <div role="group" aria-label="요일 순서" className="flex h-9 w-[150px] items-center gap-0.5 rounded-[11px] bg-slate-900/[0.06] p-[3px]">
              {(["fri", "mon"] as const).map((o) => <button key={o} type="button" aria-pressed={order === o} onClick={() => onOrder(o)} className={`h-[30px] flex-1 rounded-lg text-px-13 font-bold ${order === o ? "bg-sky-700 font-extrabold text-white" : "text-slate-600"}`}>{o === "fri" ? "금~목" : "월~일"}</button>)}
            </div>
          </div>
          <div className="mt-1"><GcalConnectCard /></div>
        </BoardPopover>
      )}
      {openMeeting && (
        <BoardPopover anchor={null} onClose={closeAll} onBack={back} label={`${openMeeting.업체명} 미팅 결과`} title={<MeetingPopHead meeting={openMeeting} now={now} />}>
          <BoardMeetingPop key={openMeeting.id} {...d.meetingProps(openMeeting)} />
        </BoardPopover>
      )}
      {openTodo && (openTodo.type === "일반"
        ? <EventViewPopover todo={openTodo} anchor={null} onClose={closeAll} onBack={back} onSaved={d.showToast} />
        : <TodoPopover todo={openTodo} anchor={null} onClose={closeAll} onBack={back} onSaved={d.showToast} />)}
      {adding && <GeneralEventModal defaultDate={selected} onClose={() => setAdding(false)} onCreated={d.refreshAfterCreate} />}
      {d.toast && <AppToast>{d.toast}</AppToast>}
    </div>
  );
}

/** 달력 — 남은 높이를 줄 수로 나눠 쓰고, 칸 높이에 들어가는 만큼(5줄 달 4줄·6줄 달 3줄쯤) 일정 이름을 보여 준다. */
function PhoneGrid({ rows, order, todayISO, active, now, onDay }: { rows: MonthRow[]; order: DayOrder; todayISO: string; active: string | null; now: Date; onDay: (date: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [cap, setCap] = useState(3);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setCap(Math.max(1, Math.floor(((el.clientHeight - HEAD_H) / rows.length - CELL_PAD) / BAR_H)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [rows.length]);
  const BAR = "h-[17px] shrink-0 overflow-hidden whitespace-nowrap rounded border-l-[3px] px-[3px] text-px-11 font-bold leading-[17px]";
  const bar = (it: DayItem) => {
    if (it.kind === "m") return <span key={it.id} className={`${BAR} ${CH_EDGE[it.m.channel]} ${ST_BAR[it.m.상태]}${needsResult(it.m, now) ? " ring-1 ring-inset ring-amber-500" : ""}`}>{it.m.업체명}</span>;
    if (it.kind === "e") return <span key={it.id} className={`${BAR} border-l-teal-600 bg-teal-100 text-teal-900`}>{it.t.제목}</span>;
    return <span key={it.id} className={`${BAR} border-l-slate-700 bg-slate-700 text-white${it.t.완료여부 ? " line-through opacity-50" : ""}`}>{todoCompany(it.t) || it.t.제목}</span>;
  };
  return (
    <div ref={ref} className="grid min-h-0 flex-1 overflow-hidden" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gridTemplateRows: `${HEAD_H}px`, gridAutoRows: "minmax(0, 1fr)" }}>
      {rows[0]?.cells.map((c) => <div key={c.dow} className={`grid place-items-center border-b border-slate-900/[0.08] text-px-11 font-bold ${c.dow === 0 ? "text-red-700" : c.dow === 6 ? "text-blue-700" : "text-slate-500"}`}>{DOW[c.dow]}</div>)}
      {rows.map((r) => r.cells.map((c, i) => {
        const show = c.items.length > cap ? c.items.slice(0, Math.max(cap - 1, 0)) : c.items;
        const more = c.items.length - show.length;
        const today = c.date === todayISO;
        return (
          <button key={c.date} type="button" onClick={() => onDay(c.date)} aria-label={`${c.month}월 ${c.day}일 ${DOW[c.dow]}요일, 일정 ${c.count}건${c.memo ? ", 메모 있음" : ""}`}
            className={`flex min-h-0 min-w-0 flex-col gap-0.5 overflow-hidden border-b border-slate-900/[0.08] px-px pb-0.5 pt-[3px] text-left ${i === 0 ? "" : order === "fri" && i === 3 ? "border-l-2 border-l-slate-900/[0.14]" : "border-l border-l-slate-900/[0.08]"} ${c.date === active ? "bg-sky-500/10" : c.out ? "bg-slate-900/[0.03]" : ""}`}>
            <span className="flex h-[22px] shrink-0 items-center justify-center gap-0.5">
              {c.dow === 5 && c.cw >= 1 && <em className="whitespace-nowrap text-px-10 font-extrabold not-italic text-sky-800">{c.cw}주</em>}
              <b className={`grid h-[22px] min-w-[22px] place-items-center rounded-full text-px-13 font-bold tabular-nums ${today ? "bg-sky-700 text-white" : c.out ? "text-slate-400" : c.dow === 0 ? "text-red-700" : c.dow === 6 ? "text-blue-700" : "text-slate-900"}`}>{c.day}</b>
              {c.memo && <i aria-hidden="true" className="h-[5px] w-[5px] rounded-full bg-amber-500" />}
            </span>
            {show.map(bar)}
            {more > 0 && <span className="shrink-0 pl-1 text-px-10 font-extrabold leading-[14px] text-slate-500">+{more}</span>}
          </button>
        );
      }))}
    </div>
  );
}
