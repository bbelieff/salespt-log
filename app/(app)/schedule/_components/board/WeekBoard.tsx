"use client";
/**
 * 일정·계약 탭 PC 주간 보드(1280px 이상) — 왼쪽(제목 칸·미팅 결과·주간 이슈·트레이닝 목표) + 오른쪽 주간 격자.
 * 미팅을 누르면 기존 결과 카드(MeetingResultCard)를 그대로 창에 띄워 저장·장부 연결·되돌리기를 같은 코드로 쓴다.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Meeting, ScheduleIssue, Todo } from "@/types";
import { useAllTodos } from "@/query/todos-hooks";
import { useSaveScheduleNote, useScheduleNotes } from "@/query/schedule-notes-hooks";
import { isBoardTodo, monthWeekLabel, type DayOrder } from "../../_lib/board";
import { addDays, dayLabelKO, fmtISO, parseISO, weekIndexOf } from "../../_lib/week";
import BoardTitle from "./BoardTitle";
import WeekGrid, { BOARD_TOP_H } from "./WeekGrid";
import { GoalPanel, IssuesPanel, ResultPanel } from "./SidePanels";
import TodoPopover from "./TodoPopover";
import EventPopover from "./EventPopover";
import BoardPopover from "./BoardPopover";
import type { LayerKey, Layers } from "./board-style";
import "./week-board.css";

type Opened = { kind: "m"; id: string; rect: DOMRect } | { kind: "t"; id: string; rect: DOMRect } | { kind: "new"; date: string; time: string | null; rect: DOMRect };

export default function WeekBoard({ courseWeekFri, viewStart, courseStart, order, meetings, todayISO, focusId, onPrev, onNext, onToday, onOrder, renderMeeting, toast, extra }: {
  courseWeekFri: string; viewStart: string; courseStart: string; order: DayOrder; meetings: Meeting[]; todayISO: string;
  /** 캘린더에서 ?focus=<미팅 id> 로 넘어오면 그 미팅 창을 한 번 연다. */
  focusId?: string | null;
  onPrev: () => void; onNext: () => void; onToday: () => void; onOrder: (o: DayOrder) => void;
  /** 결과 창 안의 카드 — 페이지가 기존 MeetingResultCard 를 같은 저장 함수로 만들어 준다. */
  renderMeeting: (m: Meeting) => ReactNode; toast: (msg: string) => void; extra?: ReactNode;
}) {
  const [layers, setLayers] = useState<Layers>({ meet: true, todo: true, event: true });
  const [opened, setOpened] = useState<Opened | null>(null);
  const focused = useRef(false);
  useEffect(() => {
    if (focused.current || !focusId || !meetings.some((m) => m.id === focusId)) return;
    focused.current = true;
    const el = document.querySelector(`[data-meet="${CSS.escape(focusId)}"]`);
    setOpened({ kind: "m", id: focusId, rect: el?.getBoundingClientRect() ?? new DOMRect(300, 140, 0, 0) });
  }, [focusId, meetings]);
  const now = new Date();
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => fmtISO(addDays(parseISO(viewStart), i))), [viewStart]);

  const todosQuery = useAllTodos();
  const todos = useMemo(() => {
    const set = new Set(days);
    return (todosQuery.data?.todos ?? []).filter((t) => set.has(t.예정일자) && isBoardTodo(t));
  }, [todosQuery.data, days]);

  const notes = useScheduleNotes(viewStart, courseWeekFri);
  const saveNote = useSaveScheduleNote();
  const notesReady = notes.isSuccess;
  const saveMemo = (date: string, text: string) => saveNote.mutate({ kind: "memo", date, text }, { onError: () => toast("메모를 저장하지 못했어요 — 잠시 뒤 다시 적어 주세요.") });
  const saveIssues = (issues: ScheduleIssue[]) => saveNote.mutate({ kind: "issues", weekStart: courseWeekFri, issues }, { onError: () => toast("이슈를 저장하지 못했어요 — 잠시 뒤 다시 시도해 주세요.") });

  const cs = parseISO(courseStart);
  const cw = (d: string) => weekIndexOf(parseISO(d), cs);
  const firstW = cw(days[0]!), lastW = cw(days[6]!);
  const course = lastW < 1 ? "수강 전" : firstW === lastW ? `수강 ${firstW}주` : `수강 ${Math.max(firstW, 1)}·${lastW}주`;
  // 월~일 보기: 수강 주차가 바뀌는 금요일 칸에 경계선과 「수강 N주」, 첫 칸에도 그 주 표시.
  const boundary = order === "mon" ? days.findIndex((d) => parseISO(d).getDay() === 5) : -1;
  const courseTag = (d: string, i: number) => (order === "mon" && (i === boundary || i === 0) && cw(d) >= 1 ? `수강 ${cw(d)}주` : null);
  const md = (d: string) => { const x = parseISO(d); return `${String(x.getMonth() + 1).padStart(2, "0")}.${String(x.getDate()).padStart(2, "0")}`; };

  const openMeeting = opened?.kind === "m" ? meetings.find((m) => m.id === opened.id) : undefined;
  const openTodo = opened?.kind === "t" ? (todosQuery.data?.todos ?? []).find((t: Todo) => t.id === opened.id) : undefined;
  const close = () => setOpened(null);
  const toggleLayer = (k: LayerKey) => setLayers((l) => {
    if (l[k] && Object.values(l).filter(Boolean).length === 1) { toast("적어도 한 가지는 보여야 해요"); return l; }
    return { ...l, [k]: !l[k] };
  });

  return (
    <div className="wb-root grid h-[calc(100dvh-var(--app-header-height)-3rem-24px)] min-h-[620px] grid-cols-[272px_minmax(0,1fr)] gap-3 px-4 py-3">
      <div aria-hidden="true" className="wb-backdrop"><i /><i /><i /></div>
      <div className="flex min-h-0 flex-col gap-3">
        <BoardTitle className="shrink-0" style={{ height: BOARD_TOP_H + 1 }} title={monthWeekLabel(viewStart)} range={`${md(days[0]!)} – ${md(days[6]!)}`} course={course}
          order={order} layers={layers} onPrev={onPrev} onNext={onNext} onToday={onToday} onOrder={onOrder} onLayer={toggleLayer} />
        <aside aria-label="이번 주 미팅 결과, 주간 이슈, 트레이닝 목표" className="wb-scroll -m-1 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden p-1">
          <div className="wb-glass shrink-0 overflow-hidden"><ResultPanel meetings={meetings} now={now} onPending={(m) => setOpened({ kind: "m", id: m.id, rect: new DOMRect(300, 140, 0, 0) })} /></div>
          <div className="wb-glass wb-issues shrink-0 overflow-hidden"><IssuesPanel issues={notes.data?.issues ?? []} ready={notesReady} onChange={saveIssues} /></div>
          <div className="wb-glass shrink-0 overflow-hidden"><GoalPanel courseWeekFri={courseWeekFri} /></div>
        </aside>
        {extra}
      </div>
      <div className="wb-glass min-h-0 min-w-0 overflow-hidden">
        <WeekGrid days={days} meetings={meetings} todos={todos} memos={notes.data?.memos ?? {}} memoReady={notesReady} layers={layers}
          todayISO={todayISO} now={now} openKey={opened && opened.kind !== "new" ? `${opened.kind}:${opened.id}` : null}
          courseTag={courseTag} courseBoundary={boundary} weekSep={order === "fri" ? 3 : -1} onMemo={saveMemo}
          onMeeting={(m, rect) => setOpened({ kind: "m", id: m.id, rect })} onTodo={(t, rect) => setOpened({ kind: "t", id: t.id, rect })}
          onCreate={(date, time, rect) => setOpened({ kind: "new", date, time, rect })} />
      </div>

      {openMeeting && opened?.kind === "m" && (
        <BoardPopover width={460} anchor={opened.rect} onClose={close} label={`${openMeeting.업체명} 미팅`} title={
          <p className="pt-1 text-xs font-semibold tabular-nums text-slate-500">{openMeeting.미팅날짜.slice(5).replace("-", "/")} ({dayLabelKO(parseISO(openMeeting.미팅날짜))}) {openMeeting.미팅시간}</p>
        }>{renderMeeting(openMeeting)}</BoardPopover>
      )}
      {openTodo && opened?.kind === "t" && <TodoPopover todo={openTodo} anchor={opened.rect} onClose={close} onSaved={toast} />}
      {opened?.kind === "new" && <EventPopover key={`${opened.date}${opened.time}`} date={opened.date} time={opened.time} anchor={opened.rect} onClose={close} onSaved={toast} />}
    </div>
  );
}
