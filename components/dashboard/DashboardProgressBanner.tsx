"use client";

import DDayBadge from "@/components/DDayBadge";
import { usePlayOnOpen } from "@/components/motion/useMotion";
import CountUp from "@/components/motion/CountUp";

/**
 * DashboardProgressBanner — 대시보드 진행도 라인 (D-day 통합).
 *
 * 변경 (2026-09-11):
 *   1. 매출/비용 박스 분리 — 본문 상단 "재무 한 세트"로 이동
 *   2. D-day 통합 — TopHeader 슬림바에서 빠지고 우측에 배치
 *   3. (화면 마감 v2, 2026-11-10) 페이지 맨 위 .surface-hero 띠 안에 재무 3종과 함께 놓인다 — 자체 바탕·선 없음.
 *   4. (A안, 2026-11-13) PC 는 같은 줄 오른쪽에 기간 칩이 붙는다.
 *   5. (할 일 구역 개편, 2026-11-24) 폰도 한 줄 — 주차·진행률·진행바·D-day. 「M/D 시작」·「종강총회」 글과 폰의 오늘 날짜는 뺐다.
 *
 * SSOT: docs/design/components.md §9-1
 */
interface Props {
  today: string;
  weekday: string;
  currentWeek: number;
  hasDates?: boolean;
  graduated?: boolean;
  /** 수료 다음 날부터 1, 2, … 주 (수료 전 0) — D2 「수료 후 N주」. */
  weeksAfterGraduation?: number;
  /** 2026-11-24 부터 그리지 않는다(한 줄 압축) — 호출부 호환용. */
  startDate?: string;
  progressPercent: number;
  /** 2026-11-24 부터 그리지 않는다 — D-day 배지가 대신한다. */
  graduationDate?: string;
  graduationISO?: string;
}

export default function DashboardProgressBanner({
  today,
  weekday,
  currentWeek,
  hasDates = true,
  graduated = false,
  weeksAfterGraduation = 0,
  progressPercent,
  graduationISO,
}: Props) {
  const pct = Math.max(0, Math.min(100, progressPercent));
  // 열 때마다: 진행바가 왼쪽부터 차고, 지금 위치 점이 세 번 맥박친다(belie 2026-10-09).
  const play = usePlayOnOpen("progress-banner");

  if (!hasDates) {
    // 진행도 데이터가 없으면 헤더만 보여주고 D-day는 그대로 표시 (R4 W1-3 — 매출/비용·경비장부 진입점 보호)
    return (
      <div className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm text-slate-500"><div>현재 {today} ({weekday})</div><div>수강 일정을 확인하고 있어요</div></div>
          <DDayBadge graduationISO={graduationISO} />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 어느 폭이든 한 줄(2026-11-24 할 일 구역 개편 — 폰도 「주차·진행률·진행바·D-day」 한 줄로 압축해 바로 아래 「오늘 챙길 일」이 첫 화면에 들어온다).
          PC(1024+)는 날짜·주차 | 진행바 | 진행률 | D-day (belie 2026-10-24, A안 2026-11-13 — 오른쪽에 기간 칩),
          폰은 날짜를 빼고 주차 | 진행률 | 진행바 | D-day. 시작일·종강총회 글은 어느 폭에서도 그리지 않는다(D-day 배지가 종강을 알린다). */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 pc:gap-4">
        <div className="order-1 flex shrink-0 items-baseline gap-x-2.5 whitespace-nowrap">
          <span
            className="hidden text-base font-extrabold text-slate-900 pc:inline"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            현재 {today} ({weekday})
          </span>
          {graduated ? (
            <span className="text-sm font-extrabold text-emerald-600">🎓 수료{weeksAfterGraduation > 0 ? ` 후 ${weeksAfterGraduation}주` : ""}</span>
          ) : (
            <span className="text-sm font-extrabold text-blue-600">
              {currentWeek}주차 진행중
            </span>
          )}
        </div>

        {/* 수료하면 진행바·진행률은 뺀다 — 「수료 후 N주」·배지만(belie 2026-11-08) */}
        {!graduated && <>
        {/* 진행바 + amber 5겹 끝점 */}
        <div className="relative order-3 h-1.5 min-w-0 flex-1 rounded-full bg-slate-200/70">
          <div
            className={`bar-brand absolute left-0 top-0 h-full rounded-full ${play ? "fx-grow-x" : ""}`}
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
            overflow="visible"
            aria-hidden
          >
            {play && <circle cx="9" cy="9" r="6" fill="#f59e0b" opacity="0" className="fx-box fx-ping" style={{ animationDelay: "700ms" }} />}
            <circle cx="9" cy="9" r="8" fill="#fbbf24" opacity="0.2" />
            <circle cx="9" cy="9" r="6" fill="#fbbf24" opacity="0.45" />
            <circle cx="9" cy="9" r="3.5" fill="#f59e0b" />
            <circle cx="9" cy="9" r="2.2" fill="#fbbf24" />
            <circle cx="7.8" cy="7.8" r="0.8" fill="#fffbeb" opacity="0.9" />
          </svg>
        </div>

        <span
          className="order-2 shrink-0 whitespace-nowrap text-xs font-bold text-red-700 pc:order-4"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          <CountUp value={Math.round(pct)} play={play} format={(n) => `${n}%`} /> 진행
        </span>
        </>}

        <div className={`order-6 shrink-0${graduated ? " ml-auto" : ""}`}><DDayBadge graduationISO={graduationISO} /></div>
      </div>
    </div>
  );
}
