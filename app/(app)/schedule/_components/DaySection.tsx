/**
 * DaySection — 1일 박스 (요일/날짜 헤더 + 그 날의 미팅 줄 목록).
 * 정본: docs/design/prototypes/schedule-weekly.html `.day-section`
 * 미팅 줄을 누르면 카드가 펼쳐지는 대신 아래에서 미팅 창이 올라온다(2026-11-15 — 주간 보드·캘린더와 같은 창).
 */
"use client";

import type { ReactNode } from "react";
import type { Meeting } from "@/types";
import CarryoverBadge from "@/components/CarryoverBadge";
import { formatWon } from "@/lib/format/money";
import { useFocusScroll } from "@/lib/hooks/useFocusScroll";
import { CHANNEL_BADGE } from "../_lib/badges";
import { CARD_ICON, ROW_CLS, TIME_TEXT_CLS, meetingStateToCardState } from "../_lib/state-map";
import { dayLabelKO, fmtMD, parseISO } from "../_lib/week";

interface Props {
  date: string; // YYYY-MM-DD
  meetings: Meeting[];
  todayISO: string;
  /** 다른 화면에서 넘어온 포커스 대상 미팅 id — 스크롤+하이라이트. */
  focusId?: string | null;
  /** 미팅 줄을 누르면 — 페이지가 아래에서 올라오는 미팅 창을 연다(주간 보드·캘린더와 같은 창). */
  onOpen: (meeting: Meeting) => void;
  /** 폰·태블릿: 미팅 줄 아래 메모·실무 투두·일반 일정(주간 보드 2026-11-11). */
  extra?: ReactNode;
}

/** 미팅 한 줄 — 상태 아이콘·시간·채널·업체명·장소(·수임비). 결과 입력·고치기는 누르면 뜨는 창에서. */
function MeetingRow({ meeting, focus, onOpen }: { meeting: Meeting; focus: boolean; onOpen: () => void }) {
  const state = meetingStateToCardState(meeting.상태);
  const { ref, ring } = useFocusScroll<HTMLDivElement>(focus);
  const gone = state === "canceled" ? "line-through text-slate-400" : "";
  return (
    <div ref={ref} className={`scroll-mt-[280px] border-b border-slate-100 last:border-b-0 ${ROW_CLS[state]} ${ring ? "animate-pulse ring-2 ring-inset ring-blue-400" : ""}`}>
      <button type="button" onClick={onOpen} aria-haspopup="dialog" data-first-steps="meeting-card-toggle"
        className="flex w-full items-center gap-2 px-1 py-3 text-left transition-colors active:bg-black/5">
        <CarryoverBadge 구분={meeting.구분} />
        <span className="shrink-0 text-base leading-none">{CARD_ICON[state]}</span>
        <span className={`shrink-0 text-sm font-bold ${gone || TIME_TEXT_CLS[state]}`}>{meeting.미팅시간}</span>
        <span className={`shrink-0 ${CHANNEL_BADGE[meeting.channel]}`}>{meeting.channel}</span>
        {/* 업체명 먼저 — 좁은 화면(폴드 커버)에서는 장소가 아랫줄로(2026-11-07). */}
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2">
          <span className={`line-clamp-2 min-w-0 max-w-full break-keep text-sm font-semibold ${gone || "text-slate-900"}`}>{meeting.업체명}</span>
          {meeting.장소 && <span className={`ml-auto min-w-0 max-w-full truncate text-xs ${gone || "text-slate-500"}`}>{meeting.장소}</span>}
        </span>
        {state === "contract" && meeting.수임비 > 0 && <span className="shrink-0 text-xs font-bold tabular-nums text-green-700">{formatWon(meeting.수임비)}</span>}
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
      </button>
    </div>
  );
}

export default function DaySection({ date, meetings, todayISO, focusId, onOpen, extra }: Props) {
  const d = parseISO(date);
  const dow = d.getDay();
  const isWeekend = dow === 0 || dow === 6;
  const isToday = date === todayISO;

  // 화면 마감 v2(2026-11-10·11): 하루 = 흰 판 하나(.surface-panel) + 제목 줄(.section-head) + 미팅 줄 목록.
  //  - 오늘: 파란 제목 글자 + 「오늘」 칩 + 제목 줄 파란 밑줄(꼭 봐야 하는 날 하나만 강조)
  //  - 주말(토/일): 요일 빨강 글자
  const dayNameCls = isToday
    ? "text-blue-700"
    : isWeekend
      ? "text-red-500"
      : "text-slate-500";
  const dateCls = isToday ? "text-blue-900" : "text-slate-900";

  return (
    <section
      // scroll-margin-top: WeekHeader(top-24=96px) + WeekHeader 내부 + SummaryBar 합산 ~280px
      // 위로 스크롤(앞 요일 클릭) 시 sticky 헤더에 가려지지 않도록 여유 확보.
      className={`surface-panel scroll-mt-[280px] !py-3 ${isToday ? "!border-blue-300 ring-1 ring-blue-200" : ""}`}
    >
      <header
        className={`section-head !items-center !justify-start ${
          isToday ? "!border-b-2 !border-blue-600" : ""
        }`}
      >
        <span className={`text-sm font-bold ${dateCls}`}>{fmtMD(d)}</span>
        <span className={`text-sm font-semibold ${dayNameCls}`}>
          ({dayLabelKO(d)})
        </span>
        {isToday && (
          <span className="inline-flex items-center rounded-full bg-blue-700 px-2 py-0.5 text-px-10 font-bold text-white">
            오늘
          </span>
        )}
        <span
          className={`ml-auto text-xs ${
            isToday ? "font-semibold text-blue-700" : "text-slate-400"
          }`}
        >
          {meetings.length > 0 ? `${meetings.length}건` : ""}
        </span>
      </header>

      {meetings.length === 0 ? (
        <div className="py-2.5 text-center">
          <span className="text-px-11 text-slate-400">미팅 없음</span>
        </div>
      ) : (
        <div>
        {meetings.map((m) => <MeetingRow key={m.id} meeting={m} focus={focusId != null && focusId === m.id} onOpen={() => onOpen(m)} />)}
        </div>
      )}
      {extra}
    </section>
  );
}
