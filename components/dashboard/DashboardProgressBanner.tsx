"use client";

import { formatMoney } from "@/lib/format/money";
/**
 * DashboardProgressBanner — 대시보드 메인 배너 (sticky top-24 z-30).
 *
 * SSOT: docs/design/components.md §9-1
 * 디자인 정본: docs/handoff/inbox/dashboard-2026-05-07/dashboard-prototype.html (line 152~)
 *
 * 구조 (prototype 1:1):
 *   상단: 진행도
 *     - "현재 [today] ([weekday]) · [N주차] 진행중" (제목 수준 두 그룹)
 *     - 진행바 + amber 5겹 SVG 끝점
 *     - "[mm/dd] 시작 · [N]% 진행 · 🎓 [grad] 종강총회" (3-라벨 justify-between)
 *   구분선 (옅게)
 *   하단: 매출/비용 1:1 grid
 *     - 매출 박스 (gray border, ＋ 배지, 합계 + 수임비/수수료 분해 2줄)
 *     - 비용 박스 (red border + 옅은 red bg, － 배지, DB 비용 합계 부연)
 *
 * ⚠ 영업이익은 이 배너 외부 별도 카드 (OperatingProfitCard) — page.tsx에서 호출.
 */
interface Props {
  dbCostTotal: number;
  additionalCost: number | null;
  onOpenExpenseLedger: () => void;
  today: string; // "5/4"
  weekday: string; // "월"
  currentWeek: number; // 코스주차 1~STATS_WEEKS (clamp 는 page 가 수행)
  /** 날짜(O1/O2)를 확보했는가. false 면 진행도 줄을 숨기고 매출/비용만 렌더 —
   *  me 시트 read 실패로 배너가 통째로 사라져 **경비장부 진입점까지 소실**되던 회귀 차단(적대리뷰 MAJOR). */
  hasDates?: boolean;
  /** 종강일(O2) 경과 — true 면 "N주차 진행중" 대신 수료 표시 (R4 W1-3, 📥기본안). */
  graduated?: boolean;
  startDate: string; // "4/10" (N1)
  progressPercent: number; // 0~100
  graduationDate: string; // "6/6"
  revenue: number; // 총매출 (원)
  cost: number; // 총비용 (원)
  feeIncome: number; // 수임비 (원)
  commissionIncome: number; // 수수료 (원)
}

/** 공용 부품 별칭 — 중복 구현 제거(PR-1 lib/format/money 가 단일 원천). */
const fmtMoney = formatMoney;

export default function DashboardProgressBanner({
  dbCostTotal,
  additionalCost,
  onOpenExpenseLedger,
  today,
  weekday,
  currentWeek,
  hasDates = true,
  graduated = false,
  startDate,
  progressPercent,
  graduationDate,
  revenue,
  cost,
  feeIncome,
  commissionIncome,
}: Props) {
  const pct = Math.max(0, Math.min(100, progressPercent));

  return (
    <div className="sticky top-24 z-30 border-b border-gray-100 bg-white">
      {/* === 위: 진행도 === (날짜 미확보 시 생략 — 매출/비용·경비장부는 계속 렌더) */}
      {hasDates && (
      <div className="px-4 pb-2.5 pt-3">
        {/* 상단 라벨 — "현재 5/4 (월) · 4주차 진행중" */}
        <div className="mb-3 flex items-baseline gap-2.5">
          <span
            className="text-base font-extrabold text-gray-900"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            현재 {today} ({weekday})
          </span>
          <span className="text-base text-gray-300">·</span>
          {graduated ? (
            <span className="text-base font-extrabold text-emerald-600">🎓 수료</span>
          ) : (
            <span className="text-base font-extrabold text-blue-600">
              {currentWeek}주차 진행중
            </span>
          )}
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
      )}

      {/* 구분선 — 진행도 줄이 있을 때만(없으면 상단 이중선 방지) */}
      {hasDates && <div className="border-t border-gray-100" />}

      {/* === 아래: 매출 / 비용 1:1 grid === */}
      <div className="px-3 py-2.5">
        <div className="grid grid-cols-2 gap-2">
          {/* 매출 박스 */}
          <div className="rounded-lg border border-gray-200 px-2.5 py-2">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-xs font-bold leading-none text-gray-700">
                ＋
              </span>
              <span className="text-xs font-medium text-gray-600">매출</span>
              <span
                className="ml-auto text-sm font-bold text-gray-900"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                ₩{fmtMoney(revenue)}
              </span>
            </div>
            <div
              className="pl-5 text-xs leading-snug text-gray-400"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              <div>수임비 ₩{fmtMoney(feeIncome)}</div>
              <div>수수료 ₩{fmtMoney(commissionIncome)}</div>
            </div>
          </div>

          {/* 비용 박스 */}
          <button
            type="button"
            onClick={onOpenExpenseLedger}
            aria-label="비용 추가하기: 비용 원장 열기"
            className="group rounded-lg border border-red-200/70 bg-red-50/30 px-2.5 py-2 text-left transition hover:border-red-300 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <div className="mb-1 flex items-center gap-1.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-100 text-xs font-bold leading-none text-red-600">
                －
              </span>
              <span className="text-xs font-medium text-gray-600">비용</span>
              <span
                className="ml-auto text-sm font-bold text-red-600"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                ₩{fmtMoney(cost)}
              </span>
            </div>
            <div className="pl-5 text-xs leading-snug text-gray-400">
              <div>DB 비용 합계 ₩{fmtMoney(dbCostTotal)}</div>
              {additionalCost === null ? (
                <div className="mt-0.5 text-amber-700">추가 비용을 확인하지 못했습니다. 다시 시도해 주세요.</div>
              ) : (
                <div>추가 비용 ₩{fmtMoney(additionalCost)}</div>
              )}
              <div className="mt-1 font-bold text-red-600 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">비용 추가하기</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
