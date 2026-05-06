/**
 * MonthGrid — 6×7 캘린더 그리드.
 *
 * 정본: docs/design/prototypes/calendar-monthly.html (Google Calendar 스타일 pill).
 * 각 셀: 날짜 + 그 날 미팅 pill 최대 3개 (시간 + 업체명) + "+N" 오버플로.
 * 클릭 시 셀 강조 + onSelectDate(date).
 */
"use client";

import type { Channel, Meeting } from "@/types";
import {
  buildMonthGrid,
  dayLabelHeader,
} from "../_lib/month";

interface Props {
  yyyyMM: string;
  todayISO: string;
  selectedDate: string;
  /** date(YYYY-MM-DD) → meetings */
  meetingsByDate: Map<string, Meeting[]>;
  onSelectDate: (date: string) => void;
}

const VISIBLE_PILL_COUNT = 3;

/** 채널별 pill 색상 — prototype의 PILL_CLASS 매핑. */
const PILL_CLS: Record<Channel, string> = {
  매입DB: "bg-blue-100 text-blue-700",
  직접생산: "bg-green-100 text-green-700",
  현수막: "bg-amber-100 text-amber-700",
  "콜·지·기·소": "bg-purple-100 text-purple-700",
};

export default function MonthGrid({
  yyyyMM,
  todayISO,
  selectedDate,
  meetingsByDate,
  onSelectDate,
}: Props) {
  const cells = buildMonthGrid(yyyyMM);
  const headers = dayLabelHeader();

  return (
    <div className="px-2">
      {/* 요일 헤더 */}
      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {headers.map((h, i) => (
          <div
            key={h}
            className={`py-1.5 text-center text-xs font-semibold ${
              i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-500"
            }`}
          >
            {h}
          </div>
        ))}
      </div>

      {/* 6 weeks × 7 days = 42 cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((c) => {
          // 변경/취소 제외 + 시간 오름차순 정렬 (prototype 사양).
          const dayMeetings = (meetingsByDate.get(c.date) ?? [])
            .filter((m) => m.상태 !== "변경" && m.상태 !== "취소")
            .sort((a, b) => a.미팅시간.localeCompare(b.미팅시간));
          const visible = dayMeetings.slice(0, VISIBLE_PILL_COUNT);
          const overflow = dayMeetings.length - visible.length;

          const isToday = c.date === todayISO;
          const isSelected = c.date === selectedDate;
          const dimmed = !c.inMonth;
          const hasMeetings = dayMeetings.length > 0;

          const cellBg = isSelected
            ? "bg-blue-50 ring-2 ring-blue-500"
            : isToday
              ? "bg-blue-50/60 ring-1 ring-blue-300"
              : hasMeetings
                ? "bg-white"
                : "bg-gray-50";

          const dayCls = dimmed
            ? "text-gray-300"
            : c.dow === 0
              ? "text-red-500"
              : c.dow === 6
                ? "text-blue-500"
                : "text-gray-800";

          return (
            <button
              key={c.date}
              type="button"
              onClick={() => onSelectDate(c.date)}
              className={`relative flex min-h-[68px] flex-col items-stretch gap-0.5 overflow-hidden rounded-md p-1 text-left transition-all active:scale-[0.98] ${cellBg}`}
            >
              <span
                className={`text-[11px] font-bold leading-none ${dayCls}`}
              >
                {c.day}
              </span>
              {c.inMonth && hasMeetings && (
                <div className="flex flex-col gap-0.5">
                  {visible.map((m) => (
                    <div
                      key={m.id}
                      className={`flex items-center gap-0.5 truncate rounded-sm px-1 text-[9px] leading-tight ${
                        PILL_CLS[m.channel]
                      } ${m.상태 === "완료" ? "opacity-70" : ""}`}
                      title={`${m.미팅시간} ${m.업체명} · ${m.상태}`}
                    >
                      <span className="font-bold">{m.미팅시간}</span>
                      <span className="truncate">{m.업체명}</span>
                    </div>
                  ))}
                  {overflow > 0 && (
                    <div className="text-center text-[9px] font-semibold leading-tight text-gray-500">
                      +{overflow}
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
