/**
 * WeekHeader — 일정·계약 탭 주차 네비 (week 단위 — daily 아님).
 * 컨택탭의 WeekHeader와 비슷하지만, 일자 클릭 = scrollIntoView (뷰 이동 X).
 */
"use client";

import { addDays, fmtMD, parseISO } from "../_lib/week";

const JS_DAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

interface Props {
  weekIndex: number;
  weekStart: string; // YYYY-MM-DD
  todayISO: string;
  cohortName?: string;
  /** 각 요일의 미팅 수 (배열 길이 = 7). */
  countsByDay: number[];
  onPrevWeek: () => void;
  onNextWeek: () => void;
  /** 클릭 시 그 day section으로 스크롤. */
  onClickDay: (dayIdx: number) => void;
}

export default function WeekHeader({
  weekIndex,
  weekStart,
  todayISO,
  cohortName,
  countsByDay,
  onPrevWeek,
  onNextWeek,
  onClickDay,
}: Props) {
  const ws = parseISO(weekStart);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));

  return (
    <header className="sticky top-0 z-40 bg-white shadow-sm">
      <div className="flex items-center justify-between px-2 py-3">
        <button
          type="button"
          onClick={onPrevWeek}
          className="flex h-11 w-11 items-center justify-center text-gray-400 transition-all hover:text-gray-600 active:scale-90"
          aria-label="이전 주차"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <div className="flex-1 text-center">
          <div className="text-base font-bold text-gray-900">
            {cohortName ? `${cohortName} · ` : ""}
            {weekIndex}주차
          </div>
          <div className="mt-0.5 text-xs text-gray-400">
            {fmtMD(ws)} ~ {fmtMD(addDays(ws, 6))}
          </div>
        </div>
        <button
          type="button"
          onClick={onNextWeek}
          className="flex h-11 w-11 items-center justify-center text-gray-400 transition-all hover:text-gray-600 active:scale-90"
          aria-label="다음 주차"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 px-2 pb-2.5">
        {days.map((d, i) => {
          const iso = `${d.getFullYear()}-${String(
            d.getMonth() + 1,
          ).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          const isToday = iso === todayISO;
          const dow = d.getDay();
          const isWeekend = dow === 0 || dow === 6;
          const count = countsByDay[i] ?? 0;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onClickDay(i)}
              className={`relative flex flex-col items-center justify-center rounded-xl py-1.5 transition-all active:scale-95 ${
                isToday
                  ? "bg-blue-500 text-white shadow-md shadow-blue-500/30"
                  : count > 0
                    ? "bg-blue-50 hover:bg-blue-100"
                    : "bg-gray-50 hover:bg-gray-100"
              }`}
            >
              <span
                className={`text-xs font-medium ${
                  isToday
                    ? "text-white"
                    : isWeekend
                      ? "text-red-500"
                      : "text-gray-500"
                }`}
              >
                {JS_DAY_KO[dow]}
              </span>
              <span
                className={`text-base font-bold leading-tight ${
                  isToday ? "text-white" : "text-gray-800"
                }`}
              >
                {d.getDate()}
              </span>
              {count > 0 && (
                <span
                  className={`absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold leading-none ${
                    isToday
                      ? "bg-white text-blue-600"
                      : "bg-blue-500 text-white"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
}
