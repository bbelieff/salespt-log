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
"use client";

interface Props {
  revenue: number; // 총매출
  cost: number; // 총비용
  contractCount?: number; // 계약 건수 (없으면 부연 우측 비움)
}

function fmtMoney(n: number): string {
  return n.toLocaleString("ko-KR");
}

export default function OperatingProfitCard({
  revenue,
  cost,
  contractCount,
}: Props) {
  const profit = revenue - cost;
  const profitRate = revenue > 0 ? (profit / revenue) * 100 : 0;
  return (
    <section className="rounded-2xl border-l-4 border-blue-500 bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
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
    </section>
  );
}
