/**
 * DashboardProgressBanner — 대시보드 메인 배너 (sticky top-24 z-30).
 *
 * SSOT: docs/design/components.md §9-1
 * 디자인 정본: docs/handoff/inbox/dashboard-2026-05-07/dashboard-prototype.html
 *
 * 구조:
 *   상단: "현재 5/4 (월) · 4주차 진행중" + (우측 비움 — 종강총회는 하단으로 통합)
 *   진행바: blue gradient + amber 5겹 끝점
 *   하단: 매출/비용 1:1 grid + 영업이익 카드 + "🎓 6/6 종강총회"
 */
"use client";

interface Props {
  cohort: string; // "6기"
  today: string; // "5/4"
  weekday: string; // "월"
  currentWeek: number; // 1~8
  progressPercent: number; // 0~100
  graduationDate: string; // "6/6"
  revenue: number; // 총매출 (원)
  cost: number; // 총비용 (원)
  feeIncome: number; // 수임비 (원)
  commissionIncome: number; // 수수료 (원)
}

function fmtMoney(n: number): string {
  return n.toLocaleString("ko-KR");
}

export default function DashboardProgressBanner({
  today,
  weekday,
  currentWeek,
  progressPercent,
  graduationDate,
  revenue,
  cost,
  feeIncome,
  commissionIncome,
}: Props) {
  const profit = revenue - cost;
  const profitRate = revenue > 0 ? (profit / revenue) * 100 : 0;
  const pct = Math.max(0, Math.min(100, progressPercent));

  return (
    <div className="sticky top-24 z-30 border-b border-gray-100 bg-white shadow-sm">
      {/* 상단 라벨 + 진행바 */}
      <div className="px-4 pb-2.5 pt-3">
        <div className="mb-3 flex items-baseline gap-1">
          <span
            className="text-base font-extrabold text-gray-900"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            현재 {today} ({weekday})
          </span>
          <span className="text-base text-gray-300"> · </span>
          <span className="text-base font-extrabold text-blue-600">
            {currentWeek}주차 진행중
          </span>
        </div>

        {/* 진행바 */}
        <div className="relative mb-3 h-2 rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600"
            style={{ width: `${pct}%` }}
          />
          {/* 빛나는 끝점 (5겹 amber) */}
          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pct}%` }}
            aria-hidden
          >
            <div className="relative h-3 w-3">
              <div className="absolute inset-0 -m-2 rounded-full bg-amber-300/30 blur-md" />
              <div className="absolute inset-0 -m-1 rounded-full bg-amber-400/50" />
              <div className="absolute inset-0 rounded-full bg-amber-500" />
              <div className="absolute inset-0 m-0.5 rounded-full bg-amber-300" />
            </div>
          </div>
          <span
            className="absolute -bottom-5 right-0 text-[10px] font-semibold text-blue-600"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {Math.round(pct)}% 진행
          </span>
        </div>
      </div>

      {/* 하단 매출/비용 grid + 영업이익 + 종강총회 */}
      <div className="border-t border-gray-100 px-4 pb-3 pt-4">
        <div className="grid grid-cols-2 gap-2">
          <FinanceBox
            label="총매출"
            amount={revenue}
            badgeBg="bg-gray-200"
            badgeText="text-gray-700"
            sign="＋"
            sub={`수임비 ₩${fmtMoney(feeIncome)} + 수수료 ₩${fmtMoney(commissionIncome)}`}
          />
          <FinanceBox
            label="총비용"
            amount={cost}
            badgeBg="bg-red-100"
            badgeText="text-red-600"
            sign="－"
            sub="3채널 비용 합계"
          />
        </div>

        {/* 영업이익 카드 */}
        <div className="mt-2 flex items-center justify-between rounded-md border-l-4 border-blue-500 bg-blue-50/40 px-3 py-2">
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

        {/* 종강총회 (= 수료일, 같은 날) */}
        <div className="mt-2 flex justify-end text-[11px] font-semibold text-gray-500">
          🎓 {graduationDate} 종강총회
        </div>
      </div>
    </div>
  );
}

function FinanceBox({
  label,
  amount,
  badgeBg,
  badgeText,
  sign,
  sub,
}: {
  label: string;
  amount: number;
  badgeBg: string;
  badgeText: string;
  sign: string;
  sub: string;
}) {
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
      <div className="flex items-center gap-1.5">
        <span
          className={`flex h-4 w-4 items-center justify-center rounded-full ${badgeBg} text-[11px] font-bold ${badgeText}`}
        >
          {sign}
        </span>
        <span className="text-xs font-semibold text-gray-600">{label}</span>
      </div>
      <div
        className="mt-0.5 text-sm font-extrabold text-gray-900"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        ₩{fmtMoney(amount)}
      </div>
      <div className="mt-0.5 truncate text-[10px] text-gray-400">{sub}</div>
    </div>
  );
}
