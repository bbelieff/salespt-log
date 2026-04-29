/**
 * MonthGrid — 6×7 캘린더 그리드.
 * 각 셀: 날짜 + 그 날 미팅 dot/카운트.
 * 클릭 시 셀 강조 + onSelectDate(date).
 */
"use client";

import type { Meeting } from "@/types";
import {
  buildMonthGrid,
  dayLabelHeader,
} from "../_lib/month";
import { meetingStateToCardState } from "../_lib/state-map";

interface Props {
  yyyyMM: string;
  todayISO: string;
  selectedDate: string;
  /** date(YYYY-MM-DD) → meetings */
  meetingsByDate: Map<string, Meeting[]>;
  onSelectDate: (date: string) => void;
}

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
          const meetings = meetingsByDate.get(c.date) ?? [];
          const count = meetings.length;
          const isToday = c.date === todayISO;
          const isSelected = c.date === selectedDate;
          const dimmed = !c.inMonth;

          // 미팅 상태별 dot 색 (최대 4개까지 표시)
          const dots = meetings.slice(0, 4).map((m) => {
            const s = meetingStateToCardState(m.상태);
            const cls =
              s === "contract"
                ? "bg-green-600"
                : s === "done"
                  ? "bg-orange-400"
                  : s === "rescheduled"
                    ? "bg-purple-500"
                    : s === "canceled"
                      ? "bg-red-500"
                      : "bg-amber-400";
            return cls;
          });

          const cellBg = isSelected
            ? "bg-blue-500 text-white shadow-md shadow-blue-500/30"
            : isToday
              ? "bg-blue-50 ring-2 ring-blue-400"
              : count > 0
                ? "bg-white"
                : "bg-gray-50";

          const dayCls = isSelected
            ? "text-white"
            : dimmed
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
              className={`relative flex aspect-square min-h-12 flex-col items-center justify-start gap-1 rounded-lg p-1 transition-all active:scale-95 ${cellBg}`}
            >
              <span
                className={`text-xs font-bold leading-none ${dayCls}`}
              >
                {c.day}
              </span>
              {count > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-0.5">
                  {dots.map((cls, i) => (
                    <span
                      key={i}
                      className={`h-1.5 w-1.5 rounded-full ${
                        isSelected ? "bg-white" : cls
                      }`}
                    />
                  ))}
                  {count > 4 && (
                    <span
                      className={`text-[10px] font-bold leading-none ${
                        isSelected ? "text-white" : "text-gray-500"
                      }`}
                    >
                      +{count - 4}
                    </span>
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
