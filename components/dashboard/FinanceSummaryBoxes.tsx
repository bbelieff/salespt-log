"use client";

import { formatMoney } from "@/lib/format/money";

/**
 * FinanceSummaryBoxes — 매출/비용 1:1 grid.
 *
 * SSOT: docs/design/components.md §9-2
 *
 * 변경 (2026-09-11):
 *   - DashboardProgressBanner에서 분리되어 본문 상단으로 이동
 *   - 추가 비용 행은 경비장부 진입점 (ExpenseLedgerDialog)
 */
interface Props {
  revenue: number;
  cost: number;
  feeIncome: number;
  commissionIncome: number;
  dbCostTotal: number;
  additionalCost: number | null;
  onOpenExpenseLedger: () => void;
}

const fmtMoney = formatMoney;

export default function FinanceSummaryBoxes({
  revenue,
  cost,
  feeIncome,
  commissionIncome,
  dbCostTotal,
  additionalCost,
  onOpenExpenseLedger,
}: Props) {
  return (
    <div className="mb-2 grid min-w-0 grid-cols-2 gap-2">
      {/* 매출 박스 */}
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex flex-wrap items-center gap-x-1.5 gap-y-2">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-xs font-bold leading-none text-gray-700">
            ＋
          </span>
          <span className="text-xs font-semibold text-slate-600">매출</span>
          <span
            className="w-full break-all text-xl font-bold tabular-nums text-slate-900"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            ₩{fmtMoney(revenue)}
          </span>
        </div>
        <div
          className="text-xs leading-relaxed text-slate-500"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          <div>수임비 ₩{fmtMoney(feeIncome)}</div>
          <div>수수료 ₩{fmtMoney(commissionIncome)}</div>
        </div>
      </div>

      {/* 비용 요약과 추가 비용 진입 행 */}
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex flex-wrap items-center gap-x-1.5 gap-y-2">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-100 text-xs font-bold leading-none text-red-600">
            －
          </span>
          <span className="text-xs font-semibold text-slate-600">비용</span>
          <span
            className="w-full break-all text-xl font-bold tabular-nums text-red-600"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            ₩{fmtMoney(cost)}
          </span>
        </div>
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
      </div>
    </div>
  );
}
