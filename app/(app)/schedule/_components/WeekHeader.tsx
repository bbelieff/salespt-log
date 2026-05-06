/**
 * WeekHeader — 일정·계약 탭 주차 네비 (week 단위 — daily 아님).
 * 컨택탭의 WeekHeader와 비슷하지만, 일자 클릭 = scrollIntoView (뷰 이동 X).
 *
 * 컴팩트 버전: 한 화면에 7일 + 미팅 카드를 더 많이 보여주기 위해
 *   - 네비게이션 버튼 h-11→h-9, 텍스트 base→sm
 *   - 일자 박스 vertical(요일/숫자 stacked)→horizontal(요일 숫자 한 줄)
 *   - 전체 vertical 공간 ~110px → ~70px (35% 절약)
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
    <header className="sticky top-24 z-30 bg-white shadow-sm">
      {/* 주차 네비 — 중간 컴팩트 (py-2, h-9 버튼) */}
      <div className="flex items-center justify-between px-2 py-2">
        <button
          type="button"
          onClick={onPrevWeek}
          className="flex h-9 w-9 items-center justify-center text-gray-400 transition-all hover:text-gray-600 active:scale-90"
          aria-label="이전 주차"
        >
          <svg
            className="h-4 w-4"
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
        <div className="flex flex-1 items-baseline justify-center gap-1.5">
          <span className="text-sm font-bold text-gray-900">
            {cohortName ? `${cohortName} · ` : ""}
            {weekIndex}주차
          </span>
          <span className="text-[11px] text-gray-400">
            {fmtMD(ws)} ~ {fmtMD(addDays(ws, 6))}
          </span>
        </div>
        <button
          type="button"
          onClick={onNextWeek}
          className="flex h-9 w-9 items-center justify-center text-gray-400 transition-all hover:text-gray-600 active:scale-90"
          aria-label="다음 주차"
        >
          <svg
            className="h-4 w-4"
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

      {/* 7일 그리드 — 요일/숫자 stack (작은 폰트 + 작은 패딩) */}
      <div className="grid grid-cols-7 gap-0.5 px-2 pb-2">
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
              className={`relative flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 transition-all active:scale-95 ${
                isToday
                  ? "bg-blue-500 text-white shadow-sm shadow-blue-500/30"
                  : count > 0
                    ? "bg-blue-50 hover:bg-blue-100"
                    : "bg-gray-50 hover:bg-gray-100"
              }`}
            >
              <span
                className={`text-[10px] font-medium ${
                  isToday
                    ? "text-white/90"
                    : isWeekend
                      ? "text-red-500"
                      : "text-gray-500"
                }`}
              >
                {JS_DAY_KO[dow]}
              </span>
              <span
                className={`text-sm font-bold leading-none ${
                  isToday ? "text-white" : "text-gray-800"
                }`}
              >
                {d.getDate()}
              </span>
              {count > 0 && (
                <span
                  className={`absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none ${
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
