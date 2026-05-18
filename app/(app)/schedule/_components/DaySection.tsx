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
}

export default function DaySection({
  date,
  meetings,
  todayISO,
  pendingId,
  onPatch,
  onReschedule,
  onRevert,
  onAddMeeting,
  onDelete,
}: Props) {
  const d = parseISO(date);
  const dow = d.getDay();
  const isWeekend = dow === 0 || dow === 6;
  const isToday = date === todayISO;

  // 페이지 배경(bg-slate-100)과 명확히 분리:
  //  - 오늘: 파란 그라데이션 + 강한 좌측 보더 + shadow
  //  - 주말(토/일): 빨강 좌측 보더 (휴일 강조)
  //  - 평일: 회색 좌측 보더
  const todayBorder = isToday
    ? "border-l-[5px] border-blue-600 shadow-md shadow-blue-600/20"
    : isWeekend
      ? "border-l-[5px] border-red-300 shadow-sm"
      : "border-l-[5px] border-slate-300 shadow-sm";
  const sectionBg = isToday
    ? "bg-gradient-to-b from-blue-100 to-blue-50"
    : "bg-white";
  const dayNameCls = isToday
    ? "text-blue-700"
    : isWeekend
      ? "text-red-500"
      : "text-gray-500";
  const dateCls = isToday ? "text-blue-900" : "text-gray-900";

  return (
    <section
      // scroll-margin-top: WeekHeader(top-24=96px) + WeekHeader 내부 + SummaryBar 합산 ~280px
      // 위로 스크롤(앞 요일 클릭) 시 sticky 헤더에 가려지지 않도록 여유 확보.
      className={`mb-3 rounded-xl px-3 pb-2 pt-3 scroll-mt-[280px] ${sectionBg} ${todayBorder}`}
    >
      <header
        className={`mb-2.5 flex items-center gap-2 border-b ${
          isToday
            ? "border-blue-600/25"
            : "border-dashed border-gray-200"
        } pb-2`}
      >
        <span className={`text-sm font-bold ${dateCls}`}>{fmtMD(d)}</span>
        <span className={`text-sm font-semibold ${dayNameCls}`}>
          ({dayLabelKO(d)})
        </span>
        {isToday && (
          <span className="inline-flex items-center rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
            오늘
          </span>
        )}
        <span
          className={`ml-auto text-xs ${
            isToday ? "font-semibold text-blue-700" : "text-gray-400"
          }`}
        >
          {meetings.length > 0 ? `${meetings.length}건` : ""}
        </span>
      </header>

      {meetings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-2 text-center">
          <span className="text-[11px] text-gray-400">미팅 없음</span>
        </div>
      ) : (
        meetings.map((m) => (
          <MeetingResultCard
            key={m.id}
            meeting={m}
            pending={pendingId === m.id}
            onPatch={(partial) => onPatch(m.id, partial)}
            onReschedule={(d2, t, r) => onReschedule(m, d2, t, r)}
            onRevert={onRevert ? () => onRevert(m.id) : undefined}
            onAddMeeting={
              onAddMeeting ? (d2, t2) => onAddMeeting(m, d2, t2) : undefined
            }
            onDelete={onDelete ? () => onDelete(m) : undefined}
          />
        ))
      )}
    </section>
  );
}
