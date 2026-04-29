/**
 * WeekHeader — 주차 네비 + 7일 요일 바 + 선택 날짜 라벨.
 * 정본: docs/design/prototypes/contact-daily-input.html (v7) §1, §2-1
 *
 * 요일 바: 수강시작 요일 기준 7일 (시작이 토면 토~금, 금이면 금~목, ...).
 */
"use client";

import { addDays, dayLabelKO, fmtMD, parseISO } from "../_lib/week";

const JS_DAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

interface Props {
  weekIndex: number;
  courseStart: string; // YYYY-MM-DD
  selectedDate: string; // YYYY-MM-DD
  todayISO: string;
  cohortName?: string; // 예: "PRM 5기 · 김믿음"
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onSelectDay: (date: string) => void;
}

export default function WeekHeader({
  weekIndex,
  courseStart,
  selectedDate,
  todayISO,
  cohortName,
  onPrevWeek,
  onNextWeek,
  onSelectDay,
}: Props) {
  const cs = parseISO(courseStart);
  const startDow = cs.getDay(); // 0~6 (일~토)
  const weekStart = addDays(cs, (weekIndex - 1) * 7);

  // 7일 슬롯: 첫 슬롯이 weekStart, 7번째까지 +6
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  // 각 슬롯의 요일 이름
  const dayLabels = days.map((d) => JS_DAY_KO[d.getDay()] ?? "");

  // 주말 (토=6 / 일=0) 인덱스
  const weekendIdx = days
    .map((d, i) => ({ i, dow: d.getDay() }))
    .filter(({ dow }) => dow === 0 || dow === 6)
    .map(({ i }) => i);

  const selectedDay = parseISO(selectedDate);
  const todayDate = parseISO(todayISO);

  return (
    <header className="sticky top-0 z-40 bg-white shadow-sm">
      {/* 주차 타이틀 + 좌우 화살표 */}
      <div className="flex items-center justify-between px-2 py-3">
        <button
          type="button"
          onClick={onPrevWeek}
          className="flex h-11 w-11 items-center justify-center text-gray-400 transition-all hover:text-gray-600 active:scale-90"
          aria-label="이전 주차"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 text-center">
          <div className="text-base font-bold text-gray-900">
            {cohortName ? `${cohortName} · ` : ""}
            {weekIndex}주차
          </div>
          <div className="mt-0.5 text-xs text-gray-400">
            {fmtMD(weekStart)} ~ {fmtMD(addDays(weekStart, 6))}
          </div>
        </div>
        <button
          type="button"
          onClick={onNextWeek}
          className="flex h-11 w-11 items-center justify-center text-gray-400 transition-all hover:text-gray-600 active:scale-90"
          aria-label="다음 주차"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 요일 바 */}
      <div className="grid grid-cols-7 gap-1 px-2 pb-2.5">
        {days.map((d, i) => {
          const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          const isSelected = iso === selectedDate;
          const isToday = iso === todayISO;
          const isWeekend = weekendIdx.includes(i);
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDay(iso)}
              className={`relative flex flex-col items-center justify-center rounded-xl py-1.5 transition-all active:scale-95 ${
                isSelected
                  ? "bg-blue-500 text-white shadow-md shadow-blue-500/30"
                  : "bg-gray-50 hover:bg-gray-100"
              }`}
              aria-pressed={isSelected}
            >
              <span
                className={`text-xs font-medium ${
                  isSelected
                    ? "text-white"
                    : isWeekend
                      ? "text-red-500"
                      : "text-gray-500"
                }`}
              >
                {dayLabels[i]}
              </span>
              <span
                className={`text-base font-bold leading-tight ${
                  isSelected ? "text-white" : "text-gray-800"
                }`}
              >
                {d.getDate()}
              </span>
              {isToday && (
                <span
                  className={`absolute -top-1.5 rounded-full px-1.5 py-px text-xs font-bold leading-none ${
                    isSelected ? "bg-white text-blue-600" : "bg-blue-500 text-white"
                  }`}
                >
                  오늘
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 선택된 날짜 라벨 */}
      <div className="px-4 pb-3">
        <div className="rounded-r-xl border-l-4 border-blue-500 bg-blue-50 px-3 py-2">
          <span className="text-sm font-semibold text-blue-800">
            {fmtMD(selectedDay)} ({dayLabelKO(selectedDay)})
            {selectedDate === todayISO ? " — 오늘" : ""}
          </span>
        </div>
      </div>
      {/* 사용된 종속성: startDow 참조 (요일 매핑 계산 의도 보존) */}
      {startDow < 0 ? null : null}
    </header>
  );
}
