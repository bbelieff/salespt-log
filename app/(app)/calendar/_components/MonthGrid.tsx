/**
 * MonthGrid — 6×7 캘린더 그리드.
 *
 * 정본: docs/design/prototypes/calendar-monthly.html (Google Calendar 스타일 pill).
 * 각 셀: 날짜 + 그 날 미팅 pill 최대 3개 (시간 + 업체명) + "+N" 오버플로.
 * 클릭 시 셀 강조 + onSelectDate(date).
 */
"use client";

import type { Channel, Meeting, Todo } from "@/types";
import {
  buildMonthGrid,
  dayLabelHeader,
} from "../_lib/month";
import TodoTypeIcon from "./TodoTypeIcon";

interface Props {
  yyyyMM: string;
  todayISO: string;
  selectedDate: string;
  /** date(YYYY-MM-DD) → meetings */
  meetingsByDate: Map<string, Meeting[]>;
  /** date(YYYY-MM-DD) → 실무투두 (Scope 2). */
  todosByDate: Map<string, Todo[]>;
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
  todosByDate,
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
          const dayTodos = (todosByDate.get(c.date) ?? [])
            .slice()
            .sort((a, b) => a.예정시각.localeCompare(b.예정시각));
          // 미팅 우선 3개 + 투두 2개, 나머지 +N
          const visible = dayMeetings.slice(0, VISIBLE_PILL_COUNT);
          const visibleTodos = dayTodos.slice(0, 2);
          const overflow =
            dayMeetings.length -
            visible.length +
            (dayTodos.length - visibleTodos.length);

          const isToday = c.date === todayISO;
          const isSelected = c.date === selectedDate;
          const dimmed = !c.inMonth;
          const hasItems = dayMeetings.length + dayTodos.length > 0;

          const cellBg = isSelected
            ? "bg-blue-50 ring-2 ring-blue-500"
            : isToday
              ? "bg-blue-50/60 ring-1 ring-blue-300"
              : hasItems
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
              className={`relative flex min-h-[84px] flex-col items-stretch gap-0.5 overflow-hidden rounded-md p-1 text-left transition-all active:scale-[0.98] pc:min-h-[150px] pc:gap-1 pc:p-2 ${cellBg}`}
            >
              <span
                className={`text-xs font-bold leading-none pc:text-sm ${dayCls}`}
              >
                {c.day}
              </span>
              {c.inMonth && hasItems && (
                <div className="flex flex-col gap-0.5">
                  {visible.map((m) => (
                    <div
                      key={m.id}
                      className={`flex items-center gap-0.5 truncate rounded-sm px-1 py-0.5 text-[10px] leading-tight pc:text-xs ${
                        PILL_CLS[m.channel]
                      } ${m.상태 === "완료" ? "opacity-70" : ""}`}
                      title={`${m.미팅시간} ${m.업체명} · ${m.상태}`}
                    >
                      <span className="font-bold">{m.미팅시간}</span>
                      <span className="truncate">{m.업체명}</span>
                    </div>
                  ))}
                  {/* 실무투두 pill — 진회색 + type 아이콘 (Scope 2) */}
                  {visibleTodos.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-0.5 truncate rounded-sm px-1 py-0.5 text-[10px] leading-tight text-white pc:text-xs"
                      style={{ background: "#334155" }}
                      title={`${t.예정시각} ${t.제목}`.trim()}
                    >
                      <TodoTypeIcon type={t.type} size={9} />
                      {t.예정시각 && (
                        <span className="font-bold">{t.예정시각}</span>
                      )}
                      <span className="truncate">{t.제목}</span>
                    </div>
                  ))}
                  {overflow > 0 && (
                    <div className="text-center text-[10px] font-semibold leading-tight text-gray-500">
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
