/**
 * FinanceSummaryBoxes — 매출/비용 1:1 grid.
 *
 * SSOT: docs/design/components.md §9-2
 *
 * 현재는 DashboardProgressBanner 내부 인라인 구현(FinanceBox)을 사용 중.
 * 추후 분리 리팩터링 시 이 파일에서 export. 지금은 placeholder.
 */
"use client";

import { formatMoney } from "@/lib/format/money";

interface Props {
  revenue: number;
  cost: number;
  feeIncome: number;
  commissionIncome: number;
}

/** 공용 부품 별칭 — 중복 구현 제거(PR-1 lib/format/money 가 단일 원천). */
const fmtMoney = formatMoney;

/** 독립 사용 가능한 매출/비용 박스 (DashboardProgressBanner와 별도로 쓸 때). */
export default function FinanceSummaryBoxes({
  revenue,
  cost,
  feeIncome,
  commissionIncome,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-[11px] font-bold text-gray-700">
            ＋
          </span>
          <span className="text-xs font-semibold text-gray-600">총매출</span>
        </div>
        <div
          className="mt-0.5 text-sm font-extrabold text-gray-900"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          ₩{fmtMoney(revenue)}
        </div>
        <div className="mt-0.5 truncate text-[10px] text-gray-400">
          수임비 ₩{fmtMoney(feeIncome)} + 수수료 ₩{fmtMoney(commissionIncome)}
        </div>
      </div>
      <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-100 text-[11px] font-bold text-red-600">
            －
          </span>
          <span className="text-xs font-semibold text-gray-600">총비용</span>
        </div>
        <div
          className="mt-0.5 text-sm font-extrabold text-gray-900"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          ₩{fmtMoney(cost)}
        </div>
        <div className="mt-0.5 truncate text-[10px] text-gray-400">3채널 비용 합계</div>
      </div>
    </div>
  );
}
