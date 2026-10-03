"use client";

import DDayBadge from "@/components/DDayBadge";

/**
 * DashboardProgressBanner — 대시보드 진행도 라인 (D-day 통합).
 *
 * 변경 (2026-09-11):
 *   1. 매출/비용 박스 분리 — 본문 상단 "재무 한 세트"로 이동
 *   2. D-day 통합 — TopHeader 슬림바에서 빠지고 우측에 배치
 *   3. 페이지의 full-width sticky 래퍼가 배너 아래에 붙인다. 재무 카드는 본문에 둔다.
 *
 * SSOT: docs/design/components.md §9-1
 */
interface Props {
  today: string;
  weekday: string;
  currentWeek: number;
  hasDates?: boolean;
  graduated?: boolean;
  startDate: string;
  progressPercent: number;
  graduationDate: string;
  graduationISO?: string;
}

export default function DashboardProgressBanner({
  today,
  weekday,
  currentWeek,
  hasDates = true,
  graduated = false,
  startDate,
  progressPercent,
  graduationDate,
  graduationISO,
}: Props) {
  const pct = Math.max(0, Math.min(100, progressPercent));

  if (!hasDates) {
    // 진행도 데이터가 없으면 헤더만 보여주고 D-day는 그대로 표시 (R4 W1-3 — 매출/비용·경비장부 진입점 보호)
    return (
      <div className="border-b border-gray-100 bg-white px-4 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm text-gray-500"><div>현재 {today} ({weekday})</div><div>수강 일정을 확인하고 있어요</div></div>
          <DDayBadge graduationISO={graduationISO} />
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-gray-100 bg-white">
      <div className="px-4 pb-2.5 pt-3">
        {/* 상단 라벨 — 현재 날짜·주차 + D-day (요청 [6] — D-day 진행표 우측) */}
        <div className="mb-3 flex items-center justify-between gap-2.5">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span
              className="text-sm font-extrabold text-gray-900 sm:text-base"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              현재 {today} ({weekday})
            </span>
            {graduated ? (
              <span className="text-sm font-extrabold text-emerald-600">🎓 수료</span>
            ) : (
              <span className="text-sm font-extrabold text-blue-600">
                {currentWeek}주차 진행중
              </span>
            )}
          </div>
          <div className="shrink-0"><DDayBadge graduationISO={graduationISO} /></div>
        </div>

        {/* 진행바 + amber 5겹 끝점 */}
        <div className="relative mb-3 h-1.5 rounded-full bg-slate-100">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600"
            style={{ width: `${pct}%` }}
          />
          <svg
            className="pointer-events-none absolute"
            width="18"
            height="18"
            style={{
              left: `calc(${pct}% - 9px)`,
              top: "50%",
              transform: "translateY(-50%)",
            }}
            viewBox="0 0 18 18"
            aria-hidden
          >
            <circle cx="9" cy="9" r="8" fill="#fbbf24" opacity="0.2" />
            <circle cx="9" cy="9" r="6" fill="#fbbf24" opacity="0.45" />
            <circle cx="9" cy="9" r="3.5" fill="#f59e0b" />
            <circle cx="9" cy="9" r="2.2" fill="#fbbf24" />
            <circle cx="7.8" cy="7.8" r="0.8" fill="#fffbeb" opacity="0.9" />
          </svg>
        </div>

        {/* 시작 · 진행률 · 종강총회 — 3-라벨 justify-between */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">{startDate} 시작</span>
          <span
            className="font-bold text-blue-600"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {Math.round(pct)}% 진행
          </span>
          <span className="text-gray-500">🎓 {graduationDate} 종강총회</span>
        </div>
      </div>
    </div>
  );
}
