"use client";
/**
 * 캘린더 탭 PC 한 달 보드(1280px 이상) — 일정·계약 주간 보드와 같은 틀·부품, 테마색만 하늘.
 * 왼쪽: 제목 칸(「주 | 월」) · 선택한 날 · 이번 달 미팅 결과 · 구글 캘린더 / 오른쪽: 달력(줄 머리 = 수강 주차).
 * 미팅·투두·일정 창과 저장 함수는 주간 보드 것을 그대로 쓴다. 시안 v2: docs/design/prototypes/calendar-month-board.html
 */
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Meeting, Todo } from "@/types";
import AppToast from "@/components/ui/AppToast";
import { useMeetingDeleteConfirm } from "@/components/meeting-safety/use-meeting-delete-confirm";
import { useMonthMeetings, useWeekMeetings } from "@/query/contact-hooks";
import { useSaveScheduleNote, useScheduleNotes } from "@/query/schedule-notes-hooks";
import { formatWon } from "@/lib/format/money";
import type { DayOrder } from "../../../schedule/_lib/board";
import { addDays, fmtISO, friOf, parseISO, weekIndexOf } from "../../../schedule/_lib/week";
import { useManualLinkPrompt } from "../../../schedule/_lib/use-manual-link-prompt";
import { useMeetingActions } from "../../../schedule/_lib/useMeetingActions";
import { useMeetingPatch } from "../../../schedule/_lib/useMeetingPatch";
import BoardMeetingPop from "../../../schedule/_components/board/BoardMeetingPop";
import BoardPopover from "../../../schedule/_components/board/BoardPopover";
import BoardTitle from "../../../schedule/_components/board/BoardTitle";
import EventPopover from "../../../schedule/_components/board/EventPopover";
import MeetingPopHead from "../../../schedule/_components/board/MeetingPopHead";
import { ResultPanel } from "../../../schedule/_components/board/SidePanels";
import TodoPopover from "../../../schedule/_components/board/TodoPopover";
import type { LayerKey, Layers } from "../../../schedule/_components/board/board-style";
import "../../../schedule/_components/board/week-board.css";
import { shiftMonth } from "../../_lib/month";
import GcalConnectCard from "../GcalConnectCard";
import DayPanel, { type GcalBridge } from "./DayPanel";
import EventViewPopover from "./EventViewPopover";
import MonthGrid, { type DayItem, type MonthCell, type MonthRow } from "./MonthGrid";
import "./month-board.css";

type Opened = { id: string; rect: DOMRect } | { id: "new"; rect: DOMRect };
const md = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

export default function MonthBoard({ yyyyMM, selected, todayISO, order, onOrder, onMove, onThisMonth, onSelect, onWeek, gcal }: {
  yyyyMM: string; selected: string; todayISO: string; order: DayOrder; onOrder: (o: DayOrder) => void;
  onMove: (delta: number) => void; onThisMonth: () => void;
  /** out = 이웃 달의 흐린 칸 — 페이지가 그 달로 옮긴다. */
  onSelect: (date: string, out: boolean) => void;
  /** 「주」·줄 머리 — 그 날짜가 든 주의 주간 보드(일정·계약 탭)로. */
  onWeek: (date: string) => void; gcal: GcalBridge;
}) {
  const qc = useQueryClient();
  const now = new Date();
  const [layers, setLayers] = useState<Layers>({ meet: true, todo: true, event: true });
  const [opened, setOpened] = useState<Opened | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2200); };

  // 달력 줄: 그 달 1일이 든 주부터 말일이 든 주까지(5~6줄). 이웃 달 날짜도 같이 읽어 흐리게 보여 준다.
  const { start, weeks, y, mon } = useMemo(() => {
    const [yy, mm] = yyyyMM.split("-").map(Number) as [number, number];
    const first = new Date(yy, mm - 1, 1), last = new Date(yy, mm, 0);
    const s = addDays(first, -((first.getDay() - (order === "fri" ? 5 : 1) + 7) % 7));
    let n = 0;
    while (addDays(s, n * 7) <= last) n++;
    return { start: s, weeks: n, y: yy, mon: mm };
  }, [yyyyMM, order]);
  const startISO = fmtISO(start), endISO = fmtISO(addDays(start, weeks * 7 - 1));
  const prevYM = shiftMonth(yyyyMM, -1), nextYM = shiftMonth(yyyyMM, 1);
  const cur = useMonthMeetings(yyyyMM);
  const prev = useMonthMeetings(startISO.slice(0, 7) === prevYM ? prevYM : "");
  const next = useMonthMeetings(endISO.slice(0, 7) === nextYM ? nextYM : "");
  const courseStart = useWeekMeetings(fmtISO(friOf(parseISO(todayISO)))).data?.courseStart;
  const notes = useScheduleNotes(startISO, fmtISO(friOf(start)), weeks * 7);
  const saveNote = useSaveScheduleNote();
  const memos = notes.data?.memos ?? {};
  const saveMemo = (date: string, text: string) => saveNote.mutate({ kind: "memo", date, text }, { onError: () => showToast("메모를 저장하지 못했어요 — 잠시 뒤 다시 적어 주세요.") });

  const { meetingsByDate, todosByDate, all } = useMemo(() => {
    const mb = new Map<string, Meeting[]>(), tb = new Map<string, Todo[]>(), flat: Meeting[] = [];
    for (const v of [prev.data, cur.data, next.data]) {
      for (const d of v?.daysByMeetingDate ?? []) { mb.set(d.date, d.meetings); flat.push(...d.meetings); }
      for (const d of v?.daysByTodoDate ?? []) tb.set(d.date, d.todos);
    }
    return { meetingsByDate: mb, todosByDate: tb, all: flat };
  }, [prev.data, cur.data, next.data]);

  /** 그 날 일정 — full = 선택한 날 판(변경·취소 포함), 아니면 달력 칸(변경·취소는 숨김, 기존 캘린더와 같음). */
  const itemsOf = (date: string, full: boolean): DayItem[] => {
    const out: DayItem[] = [];
    if (layers.meet) for (const m of meetingsByDate.get(date) ?? []) if (full || (m.상태 !== "변경" && m.상태 !== "취소")) out.push({ kind: "m", id: m.id, time: m.미팅시간, m });
    for (const t of todosByDate.get(date) ?? []) {
      const ev = t.type === "일반";
      if (ev ? layers.event : layers.todo) out.push({ kind: ev ? "e" : "t", id: t.id, time: t.예정시각, t });
    }
    return out.sort((a, b) => a.time.localeCompare(b.time));
  };

  const cs = courseStart ? parseISO(courseStart) : null;
  const rows: MonthRow[] = Array.from({ length: weeks }, (_, r) => {
    const ws = addDays(start, r * 7), we = addDays(ws, 6);
    const a = cs ? weekIndexOf(ws, cs) : 0, z = cs ? weekIndexOf(we, cs) : 0;
    const course = z >= 1;
    const label = !course ? `${md(fmtISO(ws))}~` : a === z ? `수강 ${a}주` : `수강 ${[a, z].filter((n) => n >= 1).join("·")}주`;
    const cells: MonthCell[] = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(ws, i), date = fmtISO(d), items = itemsOf(date, false);
      return { date, day: d.getDate(), month: d.getMonth() + 1, dow: d.getDay(), out: d.getMonth() + 1 !== mon, items, count: items.length, memo: !!memos[date] };
    });
    const wm = cells.flatMap((c) => meetingsByDate.get(c.date) ?? []).filter((m) => m.상태 !== "변경" && m.상태 !== "취소");
    const con = wm.filter((m) => m.상태 === "계약").length;
    return { start: fmtISO(ws), label, course, stats: wm.length ? `미팅 ${wm.length}${con ? ` · 계약 ${con}` : ""}` : "", current: todayISO >= fmtISO(ws) && todayISO <= fmtISO(we), cells };
  });

  const firstW = cs ? weekIndexOf(new Date(y, mon - 1, 1), cs) : 0, lastW = cs ? weekIndexOf(new Date(y, mon, 0), cs) : 0;
  const course = lastW < 1 ? "" : firstW === lastW ? `수강 ${firstW}주` : `수강 ${Math.max(firstW, 1)}~${lastW}주`;
  const monthMeetings = useMemo(() => (cur.data?.daysByMeetingDate ?? []).flatMap((d) => d.meetings), [cur.data]);
  const fee = monthMeetings.filter((m) => m.상태 === "계약").reduce((s, m) => s + (m.수임비 || 0), 0);
  const followUps = useMemo(() => new Set(all.flatMap((m) => (m.previousMeetingId ? [m.previousMeetingId] : []))), [all]);

  // 저장 — 주간 보드와 같은 함수. 주간 목록은 어느 주가 바뀌었는지 몰라 통째로 다시 읽게 한다.
  const deleteConfirm = useMeetingDeleteConfirm();
  const manualLink = useManualLinkPrompt();
  const refreshWeeks = () => qc.invalidateQueries({ queryKey: ["week"] });
  const after = <A extends unknown[]>(fn: (...a: A) => unknown) => async (...a: A) => { try { await fn(...a); } finally { void refreshWeeks(); } };
  const patch = useMeetingPatch({ weekStart: "", setPendingId, showToast, manualLink, findMeeting: (id) => all.find((m) => m.id === id) });
  const act = useMeetingActions({ weekStart: "", setPendingId, showToast, deleteConfirm });

  const openItem = (it: DayItem, rect: DOMRect) => {
    const date = it.kind === "m" ? it.m.미팅날짜 : it.t.예정일자;
    if (date !== selected) onSelect(date, false);
    // 선택한 날 판에서 눌러도 창은 달력의 그 일정 옆에 띄운다(달력에 안 보이면 누른 줄 옆).
    const el = document.querySelector(`[data-item="${CSS.escape(it.id)}"]`);
    setOpened((o) => (o?.id === it.id ? null : { id: it.id, rect: el?.getBoundingClientRect() ?? rect }));
  };
  const openMeeting = opened ? all.find((m) => m.id === opened.id) : undefined;
  const openTodo = opened && !openMeeting ? [...todosByDate.values()].flat().find((t) => t.id === opened.id) : undefined;
  const close = () => setOpened(null);
  const toggleLayer = (k: LayerKey) => setLayers((l) => {
    if (l[k] && Object.values(l).filter(Boolean).length === 1) { showToast("적어도 한 가지는 보여야 해요"); return l; }
    return { ...l, [k]: !l[k] };
  });
  const thisMonth = yyyyMM === todayISO.slice(0, 7);

  return (
    <div className="wb-root wb-sky grid h-[calc(100dvh-var(--app-header-height)-3rem-24px)] min-h-[620px] grid-cols-[272px_minmax(0,1fr)] gap-3 px-4 py-3">
      {deleteConfirm.element}
      <div aria-hidden="true" className="wb-backdrop"><i /><i /><i /></div>
      <div className="flex min-h-0 flex-col gap-3">
        <BoardTitle className="shrink-0 gap-2.5" unit="달" tone="sky" view="month" onView={() => onWeek(selected)} title={`${mon}월`} range={String(y)} course={course}
          order={order} layers={layers} onPrev={() => { close(); onMove(-1); }} onNext={() => { close(); onMove(1); }} onToday={() => { close(); onThisMonth(); }} onOrder={onOrder} onLayer={toggleLayer} />
        {/* 화면이 낮으면 왼쪽 판들만 따로 스크롤(주간 보드와 같은 방식) */}
        <aside aria-label="선택한 날, 이번 달 미팅 결과, 구글 캘린더" className="wb-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden p-1">
        <div className="wb-glass flex min-h-[220px] flex-1 flex-col overflow-hidden">
          <DayPanel date={selected} todayISO={todayISO} items={itemsOf(selected, true)} now={now} memo={memos[selected] ?? ""} memoReady={notes.isSuccess} onMemo={saveMemo}
            openId={opened?.id ?? null} onOpen={openItem} onAdd={(rect) => setOpened({ id: "new", rect })} gcal={gcal} />
        </div>
        <div className="wb-glass shrink-0 overflow-hidden">
          <ResultPanel title={thisMonth ? "이번 달 미팅 결과" : `${mon}월 미팅 결과`} iconTone="text-sky-700" meetings={monthMeetings} now={now} max={3} when={(m) => `${m.미팅날짜.slice(5).replace("-", "/")} ${m.미팅시간}`}
            onPending={(m) => openItem({ kind: "m", id: m.id, time: m.미팅시간, m }, new DOMRect(300, 140, 0, 0))}
            extra={<p className="mt-2.5 flex items-baseline justify-between border-t border-slate-900/[0.07] pt-2 text-px-11 font-bold text-slate-500">계약 수임비<b className="text-sm font-extrabold tabular-nums text-green-800">{formatWon(fee)}</b></p>} />
        </div>
        <div className="wb-gcal shrink-0"><GcalConnectCard collapsed /></div>
        </aside>
      </div>
      <div className="wb-glass min-h-0 min-w-0 overflow-hidden">
        {cur.isError ? <p role="alert" className="p-6 text-sm text-red-700">불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
          : <MonthGrid rows={rows} order={order} todayISO={todayISO} selected={selected} openId={opened?.id ?? null} now={now} onSelect={(d, out) => { close(); onSelect(d, out); }} onOpen={openItem} onWeek={onWeek} />}
      </div>

      {openMeeting && opened && (
        <BoardPopover glass width={320} anchor={opened.rect} onClose={close} label={`${openMeeting.업체명} 미팅 결과`} title={<MeetingPopHead meeting={openMeeting} now={now} />}>
          <BoardMeetingPop key={openMeeting.id} meeting={openMeeting} pending={pendingId === openMeeting.id}
            onPatch={after((partial, opts) => patch(openMeeting.id, partial, opts))} onReschedule={after((d, t, r) => act.handleReschedule(openMeeting, d, t, r))}
            onRevert={after(() => act.handleRevert(openMeeting.id))} onAddMeeting={after((d, t) => act.handleAddMeeting(openMeeting, d, t))} onDelete={after(() => act.handleDelete(openMeeting))}
            hasFollowUp={followUps.has(openMeeting.id)} onReviveCase={after(() => act.handleReviveCase(openMeeting))} />
        </BoardPopover>
      )}
      {openTodo && opened && (openTodo.type === "일반"
        ? <EventViewPopover todo={openTodo} anchor={opened.rect} onClose={close} onSaved={showToast} />
        : <TodoPopover todo={openTodo} anchor={opened.rect} onClose={close} onSaved={showToast} />)}
      {opened?.id === "new" && <EventPopover key={selected} chooseTime date={selected} time={null} anchor={opened.rect} onClose={close} onSaved={showToast} />}
      {toast && <AppToast>{toast}</AppToast>}
      {manualLink.element}
    </div>
  );
}
