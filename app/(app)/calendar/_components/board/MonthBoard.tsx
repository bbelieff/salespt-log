"use client";
/**
 * 캘린더 탭 PC 한 달 보드(1280px 이상) — 일정·계약 주간 보드와 같은 틀·부품, 테마색만 하늘.
 * 왼쪽: 제목 칸(「주 | 월」) · 선택한 날 · 이번 달 미팅 결과 · 구글 캘린더 / 오른쪽: 달력(줄 머리 = 수강 주차).
 * 데이터·저장은 useMonthData(폰 월 보기와 공용), 미팅·투두 창은 주간 보드 것을 그대로 쓴다. 시안: docs/design/prototypes/calendar-month-board.html
 */
import { useState } from "react";
import AppToast from "@/components/ui/AppToast";
import { formatWon } from "@/lib/format/money";
import type { DayOrder } from "../../../schedule/_lib/board";
import BoardMeetingPop from "../../../schedule/_components/board/BoardMeetingPop";
import BoardPopover from "../../../schedule/_components/board/BoardPopover";
import BoardTitle from "../../../schedule/_components/board/BoardTitle";
import MeetingPopHead from "../../../schedule/_components/board/MeetingPopHead";
import { ResultPanel } from "../../../schedule/_components/board/SidePanels";
import TodoPopover from "../../../schedule/_components/board/TodoPopover";
import "../../../schedule/_components/board/week-board.css";
import GcalConnectCard from "../GcalConnectCard";
import GeneralEventModal from "../GeneralEventModal";
import DayPanel from "./DayPanel";
import EventViewPopover from "./EventViewPopover";
import MonthGrid, { type DayItem } from "./MonthGrid";
import { useMonthData } from "./useMonthData";
import "./month-board.css";

export default function MonthBoard({ yyyyMM, selected, todayISO, order, onOrder, onMove, onThisMonth, onSelect, onWeek }: {
  yyyyMM: string; selected: string; todayISO: string; order: DayOrder; onOrder: (o: DayOrder) => void;
  onMove: (delta: number) => void; onThisMonth: () => void;
  /** out = 이웃 달의 흐린 칸 — 페이지가 그 달로 옮긴다. */
  onSelect: (date: string, out: boolean) => void;
  /** 「주」·줄 머리 — 그 날짜가 든 주의 주간 보드(일정·계약 탭)로. */
  onWeek: (date: string) => void;
}) {
  const d = useMonthData({ yyyyMM, selected, todayISO, order });
  const now = new Date();
  const [opened, setOpened] = useState<{ id: string; rect: DOMRect } | null>(null);
  const [adding, setAdding] = useState(false);

  const openItem = (it: DayItem, rect: DOMRect) => {
    const date = it.kind === "m" ? it.m.미팅날짜 : it.t.예정일자;
    if (date !== selected) onSelect(date, false);
    // 선택한 날 판에서 눌러도 창은 달력의 그 일정 옆에 띄운다(달력에 안 보이면 누른 줄 옆).
    const el = document.querySelector(`[data-item="${CSS.escape(it.id)}"]`);
    setOpened((o) => (o?.id === it.id ? null : { id: it.id, rect: el?.getBoundingClientRect() ?? rect }));
  };
  const openMeeting = opened ? d.findMeeting(opened.id) : undefined;
  const openTodo = opened && !openMeeting ? d.findTodo(opened.id) : undefined;
  const close = () => setOpened(null);

  return (
    <div className="wb-root wb-sky grid h-[calc(100dvh-var(--app-header-height)-3rem-24px)] min-h-[620px] grid-cols-[272px_minmax(0,1fr)] gap-3 px-4 py-3">
      {d.elements}
      <div aria-hidden="true" className="wb-backdrop"><i /><i /><i /></div>
      <div className="flex min-h-0 flex-col gap-3">
        <BoardTitle className="shrink-0 gap-2.5" unit="달" tone="sky" view="month" onView={() => onWeek(selected)} title={`${d.mon}월`} range={String(d.y)} course={d.course}
          order={order} layers={d.layers} onPrev={() => { close(); onMove(-1); }} onNext={() => { close(); onMove(1); }} onToday={() => { close(); onThisMonth(); }} onOrder={onOrder} onLayer={d.toggleLayer} />
        {/* 화면이 낮으면 왼쪽 판들만 따로 스크롤(주간 보드와 같은 방식) */}
        <aside aria-label="선택한 날, 이번 달 미팅 결과, 구글 캘린더" className="wb-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden p-1">
          <div className="wb-glass flex min-h-[220px] flex-1 flex-col overflow-hidden">
            <DayPanel date={selected} todayISO={todayISO} items={d.dayItems} now={now} memo={d.memos[selected] ?? ""} memoReady={d.notesReady} onMemo={d.saveMemo}
              openId={opened?.id ?? null} onOpen={openItem} onAdd={() => { close(); setAdding(true); }} gcal={d.gcal} />
          </div>
          <div className="wb-glass shrink-0 overflow-hidden">
            <ResultPanel title={d.thisMonth ? "이번 달 미팅 결과" : `${d.mon}월 미팅 결과`} iconTone="text-sky-700" meetings={d.monthMeetings} now={now} max={3} when={(m) => `${m.미팅날짜.slice(5).replace("-", "/")} ${m.미팅시간}`}
              onPending={(m) => openItem({ kind: "m", id: m.id, time: m.미팅시간, m }, new DOMRect(300, 140, 0, 0))}
              extra={<p className="mt-2.5 flex items-baseline justify-between border-t border-slate-900/[0.07] pt-2 text-px-11 font-bold text-slate-500">계약 수임비<b className="text-sm font-extrabold tabular-nums text-green-800">{formatWon(d.fee)}</b></p>} />
          </div>
          <div className="wb-gcal shrink-0"><GcalConnectCard collapsed /></div>
        </aside>
      </div>
      <div className="wb-glass min-h-0 min-w-0 overflow-hidden">
        {d.isError ? <p role="alert" className="p-6 text-sm text-red-700">불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
          : <MonthGrid rows={d.rows} order={order} todayISO={todayISO} selected={selected} openId={opened?.id ?? null} now={now} onSelect={(date, out) => { close(); onSelect(date, out); }} onOpen={openItem} onWeek={onWeek} />}
      </div>

      {openMeeting && opened && (
        <BoardPopover glass width={320} anchor={opened.rect} onClose={close} label={`${openMeeting.업체명} 미팅 결과`} title={<MeetingPopHead meeting={openMeeting} now={now} />}>
          <BoardMeetingPop key={openMeeting.id} {...d.meetingProps(openMeeting)} />
        </BoardPopover>
      )}
      {openTodo && opened && (openTodo.type === "일반"
        ? <EventViewPopover todo={openTodo} anchor={opened.rect} onClose={close} onSaved={d.showToast} />
        : <TodoPopover todo={openTodo} anchor={opened.rect} onClose={close} onSaved={d.showToast} />)}
      {/* 「+ 일정」 = 기존 캘린더의 일반 일정 만들기 그대로(분류·업체명·시간·첫 안내) */}
      {adding && <GeneralEventModal defaultDate={selected} onClose={() => setAdding(false)} onCreated={d.refreshAfterCreate} />}
      {d.toast && <AppToast>{d.toast}</AppToast>}
    </div>
  );
}
