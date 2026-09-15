"use client";

import { formatMoney } from "@/lib/format/money";
import { STATS_WEEKS } from "@/config/cohort-dates";
/**
 * OperatingProfitCard — 영업이익 큰 카드 (대시보드 메인 KPI).
 *
 * SSOT: docs/design/components.md §9-3
 * 디자인 정본: prototype line 265~278
 *
 * 구조: 한 줄 금액·이익률 요약. 펼치면 시즌/이월/전체 매출·비용을 확인한다.
 */
interface Props {
  revenue: number; // 아레나 집계 매출 (점수·전광판 기준)
  cost: number; // 총비용
  contractCount?: number; // 계약 건수 (없으면 부연 우측 비움)
  /** 이월(아레나 비집계, 시작일 이전) 매출 — 있으면 매출 3줄 분리 표시. */
  carryoverRevenue?: number;
  /** 전체 매출 (= 아레나 + 이월). 없으면 revenue+carryover 로 계산. */
  totalRevenue?: number;
  /** 이월(시작일 이전 발생) 비용 — 있으면 비용도 3줄 분리 표시 (belie 결정 2026-08-07, BBE-83). */
  carryoverCost?: number;
  /** 전체 비용 (= 시즌 + 이월). 없으면 cost+carryoverCost 로 계산. */
  totalCost?: number;
}

/** 공용 부품 별칭 — 중복 구현 제거(PR-1 lib/format/money 가 단일 원천). */
const fmtMoney = formatMoney;

export default function OperatingProfitCard({
  revenue,
  cost,
  contractCount,
  carryoverRevenue,
  totalRevenue,
  carryoverCost,
  totalCost,
}: Props) {
  const profit = revenue - cost;
  const profitRate = revenue > 0 ? (profit / revenue) * 100 : 0;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3">
      <details>
        <summary aria-label="영업이익과 매출·비용 상세" className="cursor-pointer list-none rounded-lg focus-visible:ring-2 focus-visible:ring-blue-500">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-slate-600"><span aria-hidden className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">＝</span>영업이익</span>
            <span className="text-slate-500">{STATS_WEEKS}주 누적{typeof contractCount === "number" && ` · 계약 ${contractCount}건`}　⌄</span>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2 tabular-nums">
            <strong className="min-w-0 break-all text-xl font-bold text-indigo-700">₩{fmtMoney(profit)}</strong>
            <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs text-slate-500">이익률 <b className="text-indigo-700">{profitRate.toFixed(1)}%</b></span>
          </div>
        </summary>
        <div className="mt-2 grid grid-cols-4 gap-2 border-t border-gray-100 pt-2 text-right text-xs tabular-nums">
          <span /><span>시즌</span><span>이월</span><span>전체</span>
          <span className="text-left">매출</span><span>₩{fmtMoney(revenue)}</span><span>₩{fmtMoney(carryoverRevenue ?? 0)}</span><span>₩{fmtMoney(totalRevenue ?? revenue + (carryoverRevenue ?? 0))}</span>
          <span className="text-left">비용</span><span>₩{fmtMoney(cost)}</span><span>₩{fmtMoney(carryoverCost ?? 0)}</span><span>₩{fmtMoney(totalCost ?? cost + (carryoverCost ?? 0))}</span>
        </div>
      </details>
    </section>
  );
}
