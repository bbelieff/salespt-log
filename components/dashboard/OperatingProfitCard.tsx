/**
 * OperatingProfitCard — 영업이익 카드 (좌측 border-l-4 + ＝ 배지).
 *
 * SSOT: docs/design/components.md §9-3
 *
 * 현재 DashboardProgressBanner 내부 인라인. 독립 사용 가능한 형태로도 export.
 */
"use client";

interface Props {
  revenue: number;
  cost: number;
}

function fmtMoney(n: number): string {
  return n.toLocaleString("ko-KR");
}

export default function OperatingProfitCard({ revenue, cost }: Props) {
  const profit = revenue - cost;
  const profitRate = revenue > 0 ? (profit / revenue) * 100 : 0;
  return (
    <div className="flex items-center justify-between rounded-md border-l-4 border-blue-500 bg-blue-50/40 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-600">
          ＝
        </span>
        <span className="text-xs font-semibold text-gray-600">영업이익</span>
      </div>
      <div className="text-right">
        <div
          className="text-base font-extrabold text-blue-700"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          ₩{fmtMoney(profit)}
        </div>
        <div className="text-[10px] text-gray-500">
          영업이익률 {profitRate.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}
