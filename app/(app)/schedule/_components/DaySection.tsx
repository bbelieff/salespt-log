/**
 * DaySection — 1일 박스 (요일/날짜 헤더 + 그 날의 미팅 카드 리스트).
 * 정본: docs/design/prototypes/schedule-weekly.html `.day-section`
 */
"use client";

import type { Meeting } from "@/types";
import { dayLabelKO, fmtMD, parseISO } from "../_lib/week";
import MeetingResultCard from "./MeetingResultCard";

interface Props {
  date: string; // YYYY-MM-DD
  meetings: Meeting[];
  todayISO: string;
  pendingId: string | null;
  /** 캘린더에서 넘어온 포커스 대상 미팅 id — 스크롤+하이라이트. */
  focusId?: string | null;
  onPatch: (id: string, partial: Partial<Omit<Meeting, "id">>) => void;
  onReschedule: (
    meeting: Meeting,
    newDate: string,
    newTime: string,
    reason: string,
  ) => void;
  /** 미팅 결과 되돌리기 (2026-05-17 [2a]). */
  onRevert?: (id: string) => void;
  /** 추가 미팅 (2026-05-17 [2b]). */
  onAddMeeting?: (meeting: Meeting, newDate: string, newTime: string) => void;
  /** 일정 삭제 (2026-05-19) — cascade. */
  onDelete?: (meeting: Meeting) => void;
  /** 자식 미팅을 가진 원본 미팅 id 셋 (2026-05-19) — 케이스 종료 표시용. */
  followUpParentIds?: Set<string>;
  /** 케이스 종료 되살리기 (2026-05-19). */
  onReviveCase?: (meeting: Meeting) => void;
}

export default function DaySection({
  date,
  meetings,
  todayISO,
  pendingId,
  focusId,
  onPatch,
  onReschedule,
  onRevert,
  onAddMeeting,
  onDelete,
  followUpParentIds,
  onReviveCase,
}: Props) {
  const d = parseISO(date);
  const dow = d.getDay();
  const isWeekend = dow === 0 || dow === 6;
  const isToday = date === todayISO;

  // 화면 마감 v2(2026-11-10): 하루 = 상자 대신 제목 줄(.section-head) + 미팅 줄 목록.
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
      className="mb-5 pt-1 scroll-mt-[280px]"
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
        {meetings.map((m) => (
          <MeetingResultCard
            key={m.id}
            meeting={m}
            pending={pendingId === m.id}
            focus={focusId != null && focusId === m.id}
            onPatch={(partial) => onPatch(m.id, partial)}
            onReschedule={(d2, t, r) => onReschedule(m, d2, t, r)}
            onRevert={onRevert ? () => onRevert(m.id) : undefined}
            onAddMeeting={
              onAddMeeting ? (d2, t2) => onAddMeeting(m, d2, t2) : undefined
            }
            onDelete={onDelete ? () => onDelete(m) : undefined}
            hasFollowUp={followUpParentIds?.has(m.id) ?? false}
            onReviveCase={onReviveCase ? () => onReviveCase(m) : undefined}
          />
        ))}
        </div>
      )}
    </section>
  );
}
