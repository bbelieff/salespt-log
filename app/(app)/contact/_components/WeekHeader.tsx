/**
 * WeekHeader — 주차 네비 + 7일 요일 바 + 선택 날짜 라벨.
 * 정본: docs/design/prototypes/contact-daily-input.html (v7) §1, §2-1
 *
 * 요일 바: 수강시작 요일 기준 7일 (시작이 토면 토~금, 금이면 금~목, ...).
 */
"use client";

import { addDays, dayLabelKO, fmtMD, friOf, parseISO } from "../_lib/week";

const JS_DAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

interface Props {
  weekIndex: number;
  courseStart: string; // YYYY-MM-DD
  selectedDate: string; // YYYY-MM-DD
  todayISO: string;
  cohortName?: string; // 예: "PRM 5기 · 김믿음"
  /** 각 요일의 미팅 수 (배열 길이 = 7). 0 이면 badge 안 보임.
   *  2026-05-16 추가: 일정·계약 탭과 동일하게 컨택탭 일자 박스에도 노출. */
  countsByDay?: number[];
  /** 주차 합계 — 4채널 합산 funnel (2026-05-17 이전 WeekFunnelBar 통합). */
  weekFunnel?: {
    생산: number;
    유입: number;
    컨택진행: number;
    미팅예약: number;
  };
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onSelectDay: (date: string) => void;
  /** 2026-05-18 [2]: 슬라이드 방향. */
  slideDir?: "right" | "left" | null;
}

export default function WeekHeader({
  weekIndex,
  courseStart,
  selectedDate,
  todayISO,
  cohortName,
  countsByDay,
  weekFunnel,
  onPrevWeek,
  onNextWeek,
  onSelectDay,
  slideDir,
}: Props) {
  // v2: 한 주 = 금~목 (숙제검사 목요일 마감 기준).
  // weekStart는 courseStart 포함 첫 금요일 + (weekIndex-1)*7
  const cs = parseISO(courseStart);
  const csFri = friOf(cs); // courseStart의 금요일 정렬
  const startDow = csFri.getDay(); // 항상 5(금)
  const weekStart = addDays(csFri, (weekIndex - 1) * 7);

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
    // sticky 는 parent(page.tsx) 에서 처리 — WeekFunnelBar 와 한 그룹으로 묶기 위해
    // (일정·계약 탭의 WeekHeader+SummaryBar 패턴과 동일, 2026-05-16).
    <header className="bg-white">
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
        <div className="flex flex-1 items-baseline justify-center gap-2">
          <span className="text-base font-bold text-gray-900">
            {cohortName ? `${cohortName} · ` : ""}
            {weekIndex}주차
          </span>
          <span className="text-xs text-gray-400">
            {fmtMD(weekStart)} ~ {fmtMD(addDays(weekStart, 6))}
          </span>
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
      <div
        key={`${weekStart.getFullYear()}-${weekStart.getMonth()}-${weekStart.getDate()}`}
        className={`grid grid-cols-7 gap-1 px-2 pb-2.5 ${
          slideDir === "right" ? "week-slide-right" : slideDir === "left" ? "week-slide-left" : ""
        }`}
      >
        {days.map((d, i) => {
          const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          const isSelected = iso === selectedDate;
          const isToday = iso === todayISO;
          const isWeekend = weekendIdx.includes(i);
          const count = countsByDay?.[i] ?? 0;
          // 2026-05-18: today = 검은 테두리 + 검은 위 strip 안 TODAY, 선택 = bg-blue
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDay(iso)}
              /* 2026-05-18 [1]: 모든 cell pt-3.5 → 주차 간 높이 동일 (TODAY strip 영역 reserve). */
              className={`relative flex flex-col items-center justify-center rounded-xl pb-1.5 pt-3.5 transition-all active:scale-95 ${
                isSelected
                  ? "bg-blue-500 text-white shadow-md shadow-blue-500/30"
                  : "bg-gray-50 hover:bg-gray-100"
              } ${isToday ? "border-2 border-black" : ""}`}
              aria-pressed={isSelected}
              aria-label={`${d.getDate()}일${isToday ? " · 오늘" : ""}${count > 0 ? ` · 미팅 ${count}건` : ""}`}
            >
              {isToday && (
                /* 2026-05-18: 뱃지 가림 방지 — 왼쪽 정렬 + 우측 padding 으로 뱃지 영역 회피. */
                <span className="absolute inset-x-0 top-0 overflow-hidden rounded-t-[10px] bg-black pl-1.5 pr-5 text-left text-[9px] font-extrabold leading-[14px] tracking-wider text-white">
                  TODAY
                </span>
              )}
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
              {count > 0 && (
                <span
                  className={`absolute right-0.5 top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold leading-none shadow ${
                    isSelected
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

      {/* 선택된 날짜 라벨 + 주차합계 inline (2026-05-17, WeekFunnelBar 통합) */}
      <div className="px-4 pb-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-r-xl border-l-4 border-blue-500 bg-blue-50 px-3 py-2">
          <span className="text-sm font-semibold text-blue-800">
            {fmtMD(selectedDay)} ({dayLabelKO(selectedDay)})
            {selectedDate === todayISO ? " — 오늘" : ""}
          </span>
          {weekFunnel && (
            <span className="flex flex-wrap items-center gap-x-2 text-xs font-medium">
              <span className="text-blue-700/70">주차합계 :</span>
              <span className="text-gray-800">
                생산 <span className="font-bold">{weekFunnel.생산}</span>
              </span>
              <span className="text-amber-700">
                유입 <span className="font-bold">{weekFunnel.유입}</span>
              </span>
              <span className="text-indigo-700">
                컨택진행 <span className="font-bold">{weekFunnel.컨택진행}</span>
              </span>
              <span className="text-green-700">
                미팅예약 <span className="font-bold">{weekFunnel.미팅예약}</span>
              </span>
            </span>
          )}
        </div>
      </div>
      {/* 사용된 종속성: startDow 참조 (요일 매핑 계산 의도 보존) */}
      {startDow < 0 ? null : null}
    </header>
  );
}
