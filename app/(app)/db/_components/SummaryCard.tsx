/**
 * SummaryCard — 선택 채널 합계 카드.
 * 정본: db-management.html v11 `renderSummary`
 *
 * 비용 채널: 총비용 + 평균단가 grid + 푸터
 * 콜·지·기·소: 영업기회 카운트만
 */
"use client";

import { fmtWon, type ChannelMeta } from "../_lib/channels";

const numStyle = { fontVariantNumeric: "tabular-nums" } as const;

interface CostProps {
  channel: ChannelMeta;
  rowCount: number;
  totalCost: number;
  avgUnit: number;
  totalQty: number;
  unitLabel: string;
}

export function CostSummary({
  channel,
  rowCount,
  totalCost,
  avgUnit,
  totalQty,
  unitLabel,
}: CostProps) {
  const badgeCls = `badge-${channel.cls}`;
  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <span className={`badge ${badgeCls}`}>{channel.name}</span>
        <span className="text-sm font-semibold text-gray-700">합계</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="mb-0.5 text-xs text-gray-500">총비용</div>
          <div className="text-xl font-bold text-red-600" style={numStyle}>
            ₩{fmtWon(totalCost)}
          </div>
        </div>
        <div>
          <div className="mb-0.5 text-xs text-gray-500">평균단가</div>
          <div className="text-xl font-bold text-gray-900" style={numStyle}>
            ₩{fmtWon(avgUnit)}
          </div>
        </div>
      </div>
      <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 text-xs text-gray-500">
        <span>
          {rowCount}개 {channel.recordsLabel}
        </span>
        <span>
          총 {fmtWon(totalQty)}
          {unitLabel}
        </span>
      </div>
    </>
  );
}

export function LeadSummary({ count }: { count: number }) {
  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <span className="badge badge-referral">콜·지·기·소</span>
        <span className="text-sm font-semibold text-gray-700">영업기회</span>
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-3xl font-bold text-purple-700" style={numStyle}>
          {count}
        </div>
        <div className="text-base text-gray-700">건</div>
      </div>
    </>
  );
}
