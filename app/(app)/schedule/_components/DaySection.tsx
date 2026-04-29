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
}

export default function DaySection({
  date,
  meetings,
  todayISO,
  pendingId,
  onPatch,
}: Props) {
  const d = parseISO(date);
  const dow = d.getDay();
  const isWeekend = dow === 0 || dow === 6;
  const isToday = date === todayISO;

  const sectionCls = isToday
    ? "bg-gradient-to-b from-blue-100 to-blue-50 border-l-[5px] border-blue-600 shadow-md shadow-blue-600/15"
    : "bg-slate-100 border-l-[5px] border-slate-300";
  const dayNameCls = isToday
    ? "text-blue-700"
    : isWeekend
      ? "text-red-500"
      : "text-gray-500";
  const dateCls = isToday ? "text-blue-900" : "text-gray-900";

  return (
    <section
      className={`mb-3.5 rounded-2xl px-3 pb-2 pt-3 ${sectionCls}`}
    >
      <header
        className={`mb-2.5 flex items-center gap-2 border-b ${
          isToday
            ? "border-blue-600/25"
            : "border-dashed border-black/10"
        } pb-2`}
      >
        <span className={`text-base font-bold ${dateCls}`}>{fmtMD(d)}</span>
        <span className={`text-base font-semibold ${dayNameCls}`}>
          ({dayLabelKO(d)})
        </span>
        {isToday && (
          <span className="inline-flex items-center rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white shadow">
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
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-center">
          <span className="text-xs text-gray-400">미팅 없음</span>
        </div>
      ) : (
        meetings.map((m) => (
          <MeetingResultCard
            key={m.id}
            meeting={m}
            pending={pendingId === m.id}
            onPatch={(partial) => onPatch(m.id, partial)}
          />
        ))
      )}
    </section>
  );
}
