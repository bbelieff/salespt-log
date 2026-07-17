"use client";

import { formatMoney } from "@/lib/format/money";
/**
 * OperatingProfitCard — 영업이익 큰 카드 (대시보드 메인 KPI).
 *
 * SSOT: docs/design/components.md §9-3
 * 디자인 정본: prototype line 265~278
 *
 * 구조:
 *   - 좌측 border-l-4 border-blue-500 + rounded-2xl shadow-sm
 *   - 상단: ＝ 배지 + "영업이익" 라벨 + (우측) "8주 누적 · 계약 N건"
 *   - 가운데: ₩금액 (text-4xl font-extrabold blue-700)
 *   - 하단: "영업이익률 N%"
 */
interface Props {
  revenue: number; // 아레나 집계 매출 (점수·전광판 기준)
  cost: number; // 총비용
  contractCount?: number; // 계약 건수 (없으면 부연 우측 비움)
  /** 이월(아레나 비집계, 시작일 이전) 매출 — 있으면 매출 3줄 분리 표시. */
  carryoverRevenue?: number;
  /** 전체 매출 (= 아레나 + 이월). 없으면 revenue+carryover 로 계산. */
  totalRevenue?: number;
}

/** 공용 부품 별칭 — 중복 구현 제거(PR-1 lib/format/money 가 단일 원천). */
const fmtMoney = formatMoney;

export default function OperatingProfitCard({
  revenue,
  cost,
  contractCount,
  carryoverRevenue,
  totalRevenue,
}: Props) {
  const profit = revenue - cost;
  const profitRate = revenue > 0 ? (profit / revenue) * 100 : 0;
  return (
    <section className="rounded-2xl border-l-4 border-blue-500 bg-white p-4 shadow-sm">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-xs font-bold leading-none text-blue-600">
            ＝
          </span>
          <span className="text-xs font-semibold text-blue-600">영업이익</span>
        </div>
        {typeof contractCount === "number" && (
          <span className="text-xs text-gray-400">
            8주 누적 · 계약 {contractCount}건
          </span>
        )}
      </div>
      <div
        className="mb-1 text-4xl font-extrabold text-blue-700"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        ₩{fmtMoney(profit)}
      </div>
      <div className="text-sm text-gray-500">
        영업이익률{" "}
        <span
          className="font-bold text-blue-700"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {profitRate.toFixed(1)}%
        </span>
      </div>
      {typeof carryoverRevenue === "number" && (
        <div
          className="mt-2 space-y-0.5 border-t border-gray-100 pt-2 text-xs"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          <div className="flex justify-between text-gray-600">
            <span>
              아레나 매출 <span className="text-gray-400">(집계)</span>
            </span>
            <span>₩{fmtMoney(revenue)}</span>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>이월 매출 (비집계)</span>
            <span>₩{fmtMoney(carryoverRevenue)}</span>
          </div>
          <div className="flex justify-between font-semibold text-gray-700">
            <span>전체</span>
            <span>₩{fmtMoney(totalRevenue ?? revenue + carryoverRevenue)}</span>
          </div>
        </div>
      )}
    </section>
  );
}
