"use client";

import { useState, type CSSProperties } from "react";
import { formatMoney } from "@/lib/format/money";
import { STATS_WEEKS } from "@/config/cohort-dates";

/**
 * FinanceSummaryBoxes — 매출/비용/영업이익 3열 1행 요약.
 *
 * SSOT: docs/design/components.md §9-2
 *
 * 변경 (2026-09-16, finance-three-columns):
 *   - 기존 매출/비용 2열 + 별도 OperatingProfitCard 큰 카드를 하나로 통합.
 *     세 컬럼이 320px 모바일에서도 데스크탑에서도 항상 한 행(grid-cols-3)에
 *     나란히 선다. 각 컬럼을 누르면 행 아래 공용 상세 패널이 열리고
 *     (한 번에 하나, 두 번째 클릭에 닫힘), 비용 상세 안의 추가 비용 행이
 *     기존 경비장부(ExpenseLedgerDialog) 진입점을 그대로 유지한다.
 *   - 모든 금액 계산·표시 계약은 기존 그대로: formatMoney 전체 금액
 *     (축약·절단 없음), 영업이익 = 매출 − 비용, 이익률 소수 1자리,
 *     시즌/이월/전체 분리, null 추가 비용은 0원으로 대신하지 않음.
 */
interface Props {
  revenue: number;
  cost: number;
  feeIncome: number;
  commissionIncome: number;
  dbCostTotal: number;
  additionalCost: number | null;
  onOpenExpenseLedger: () => void;
  weeks?: number;
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

const fmtMoney = formatMoney;

/** 한 번에 열리는 상세 패널 — null이면 전부 닫힘. */
type Panel = "revenue" | "cost" | "profit";

/**
 * 좁은 폭 대응: 금액 글꼴·컬럼 패딩이 컨테이너 폭(cqi)에 따라 유동한다.
 * 큰 금액 보호는 실제 축소+줄바꿈(anywhere)으로 하며, overflow:hidden·
 * ellipsis·truncate·nowrap 같은 잘라 숨기기는 쓰지 않는다.
 */
const amountStyle: CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  fontSize: "clamp(0.72rem, 4.4cqi, 1.25rem)",
  overflowWrap: "anywhere",
};

const columnStyle: CSSProperties = {
  padding: "clamp(0.375rem, 2.5cqi, 0.75rem)",
};

const PROFIT_OK = "#1d4ed8"; // 0 이상 영업이익 (파랑)
const PROFIT_NEG = "#7c3aed"; // 음수 영업이익 (보라 — 비용 빨강과 혼동 금지)

export default function FinanceSummaryBoxes({
  revenue,
  cost,
  feeIncome,
  commissionIncome,
  dbCostTotal,
  additionalCost,
  onOpenExpenseLedger,
  weeks = STATS_WEEKS,
  contractCount,
  carryoverRevenue,
  totalRevenue,
  carryoverCost,
  totalCost,
}: Props) {
  const [open, setOpen] = useState<Panel | null>(null);
  const toggle = (panel: Panel) => setOpen((prev) => (prev === panel ? null : panel));

  // 기존 OperatingProfitCard 계산 그대로.
  const profit = revenue - cost;
  const profitRate = revenue > 0 ? (profit / revenue) * 100 : 0;
  const carryRev = carryoverRevenue ?? 0;
  const totRev = totalRevenue ?? revenue + carryRev;
  const carryCost = carryoverCost ?? 0;
  const totCost = totalCost ?? cost + carryCost;

  const columnClass = (selected: boolean, ring: string) =>
    `flex min-w-0 flex-col gap-1 rounded-xl border bg-white text-left transition focus-visible:outline-none focus-visible:ring-2 ${selected ? `border-slate-400 ${ring}` : "border-slate-200"} ${ring}`;

  return (
    <div style={{ containerType: "inline-size" }}>
      <div role="group" aria-label="매출·비용·영업이익" className="grid min-w-0 grid-cols-3 gap-2">
        {/* 매출 컬럼 */}
        <button
          type="button"
          id="fin-col-revenue"
          aria-expanded={open === "revenue"}
          aria-controls="fin-detail-panel"
          onClick={() => toggle("revenue")}
          style={columnStyle}
          className={columnClass(open === "revenue", "focus-visible:ring-slate-500")}
        >
          <span className="flex min-w-0 items-center gap-1">
            <span aria-hidden="true" className="hidden h-4 w-4 shrink-0 items-center sm:flex justify-center rounded-full bg-gray-200 text-xs font-bold leading-none text-gray-700">
              ＋
            </span>
            <span className="min-w-0 text-xs font-semibold text-slate-600">매출</span>
            <span aria-hidden="true" className={`ml-auto shrink-0 text-xs text-slate-400 transition-transform ${open === "revenue" ? "rotate-180" : ""}`}>⌄</span>
          </span>
          <span className="w-full font-bold tabular-nums text-slate-900" style={amountStyle}>
            ₩{fmtMoney(revenue)}
          </span>
        </button>

        {/* 비용 컬럼 */}
        <button
          type="button"
          id="fin-col-cost"
          aria-expanded={open === "cost"}
          aria-controls="fin-detail-panel"
          onClick={() => toggle("cost")}
          style={columnStyle}
          className={columnClass(open === "cost", "focus-visible:ring-red-500")}
        >
          <span className="flex min-w-0 items-center gap-1">
            <span aria-hidden="true" className="hidden h-4 w-4 shrink-0 items-center sm:flex justify-center rounded-full bg-red-100 text-xs font-bold leading-none text-red-600">
              －
            </span>
            <span className="min-w-0 text-xs font-semibold text-slate-600">비용</span>
            <span aria-hidden="true" className={`ml-auto shrink-0 text-xs text-slate-400 transition-transform ${open === "cost" ? "rotate-180" : ""}`}>⌄</span>
          </span>
          <span className="w-full font-bold tabular-nums text-red-600" style={amountStyle}>
            ₩{fmtMoney(cost)}
          </span>
        </button>

        {/* 영업이익 컬럼 — 0 이상 파랑 #1d4ed8, 음수 보라 #7c3aed (비용 빨강과 구분) */}
        <button
          type="button"
          id="fin-col-profit"
          aria-expanded={open === "profit"}
          aria-controls="fin-detail-panel"
          onClick={() => toggle("profit")}
          style={columnStyle}
          className={columnClass(open === "profit", "focus-visible:ring-blue-500")}
        >
          <span className="flex min-w-0 items-center gap-1">
            <span aria-hidden="true" className="hidden h-4 w-4 shrink-0 items-center sm:flex justify-center rounded-full bg-blue-100 text-xs font-bold leading-none text-blue-700">
              ＝
            </span>
            <span className="min-w-0 text-xs font-semibold text-slate-600">영업이익</span>
            <span aria-hidden="true" className={`ml-auto shrink-0 text-xs text-slate-400 transition-transform ${open === "profit" ? "rotate-180" : ""}`}>⌄</span>
          </span>
          <span
            className="w-full font-bold tabular-nums"
            style={{ ...amountStyle, color: profit < 0 ? PROFIT_NEG : PROFIT_OK }}
            data-profit-sign={profit < 0 ? "negative" : "nonnegative"}
          >
            ₩{fmtMoney(profit)}
          </span>
        </button>
      </div>

      {/* 공용 상세 패널 — 행 아래 전체 폭, 한 번에 하나. 패널은 컬럼 버튼의
          형제이므로 중첩 버튼이 생기지 않는다. */}
      <div
        id="fin-detail-panel"
        role="region"
        aria-labelledby={open ? `fin-col-${open}` : undefined}
        hidden={open === null}
        className="mt-2 rounded-xl border border-slate-200 bg-white p-3"
      >
        {open === "revenue" && (
          <div className="space-y-1 text-xs leading-relaxed text-slate-500" style={{ fontVariantNumeric: "tabular-nums" }}>
            <div className="flex items-baseline justify-between gap-2"><span>수임비</span><span className="break-all">₩{fmtMoney(feeIncome)}</span></div>
            <div className="flex items-baseline justify-between gap-2"><span>수수료</span><span className="break-all">₩{fmtMoney(commissionIncome)}</span></div>
          </div>
        )}
        {open === "cost" && (
          <div className="text-xs leading-relaxed text-slate-500">
            <div>DB 비용 합계 ₩{fmtMoney(dbCostTotal)}</div>
            <button
              type="button"
              onClick={onOpenExpenseLedger}
              aria-label="추가 비용: 비용 원장 열기"
              className="mt-0.5 flex min-h-6 w-full items-center justify-between gap-1 rounded text-left font-normal text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <span className="min-w-0">
                {additionalCost === null ? (
                  <span className="text-amber-700">추가 비용을 확인하지 못했습니다. 다시 시도해 주세요.</span>
                ) : (
                  <span className="flex flex-wrap items-baseline gap-x-1"><span>추가 비용</span><span className="break-all tabular-nums">₩{fmtMoney(additionalCost)}</span></span>
                )}
              </span>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" /></svg>
            </button>
          </div>
        )}
        {open === "profit" && (
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-slate-500">{weeks}주 누적{typeof contractCount === "number" && ` · 계약 ${contractCount}건`}</span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">이익률 <b style={{ color: profit < 0 ? PROFIT_NEG : PROFIT_OK }}>{profitRate.toFixed(1)}%</b></span>
            </div>
            <div className="grid min-w-0 grid-cols-4 gap-2 border-t border-gray-100 pt-2 text-right text-xs tabular-nums [overflow-wrap:anywhere]">
              <span /><span>시즌</span><span>이월</span><span>전체</span>
              <span className="text-left">매출</span><span>₩{fmtMoney(revenue)}</span><span>₩{fmtMoney(carryRev)}</span><span>₩{fmtMoney(totRev)}</span>
              <span className="text-left">비용</span><span>₩{fmtMoney(cost)}</span><span>₩{fmtMoney(carryCost)}</span><span>₩{fmtMoney(totCost)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
