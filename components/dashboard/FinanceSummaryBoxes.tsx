"use client";

import { formatMoney } from "@/lib/format/money";

/**
 * FinanceSummaryBoxes — 매출/비용 1:1 grid.
 *
 * SSOT: docs/design/components.md §9-2
 *
 * 변경 (2026-09-11):
 *   - DashboardProgressBanner에서 분리되어 본문 상단으로 이동
 *   - 비용 박스는 경비장부 진입점 (ExpenseLedgerDialog)
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

      {/* 비용 박스 — 클릭 시 경비장부 열기 */}
      <button
        type="button"
        onClick={onOpenExpenseLedger}
        aria-label="비용 추가하기: 비용 원장 열기"
        className="group rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-red-300 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
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
          {additionalCost === null ? (
            <div className="mt-0.5 text-amber-700">추가 비용을 확인하지 못했습니다. 다시 시도해 주세요.</div>
          ) : (
            <div>추가 비용 ₩{fmtMoney(additionalCost)}</div>
          )}
          <div className="mt-1 font-bold text-red-600">
            비용 추가하기
          </div>
        </div>
      </button>
    </div>
  );
}
