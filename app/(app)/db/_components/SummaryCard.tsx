/**
 * SummaryCard — 선택 채널 합계 카드.
 * 정본: db-management.html v11 `renderSummary`
 *
 * 비용 채널: 총비용 + 평균단가 grid + 푸터
 * 콜·지·기·소: 영업기회 카운트만
 */
"use client";

import { type ChannelMeta } from "../_lib/channels";
import { formatCount, formatWon } from "@/lib/format/money";

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
      <div className="mb-3 flex items-center gap-2 border-b border-slate-200 pb-2">
        <span className={`badge ${badgeCls}`}>{channel.name}</span>
        <span className="text-sm font-semibold text-slate-700">합계</span>
      </div>
      <div className="stat-split grid grid-cols-2 gap-3">
        <div>
          <div className="mb-0.5 text-xs text-slate-500">총비용</div>
          <div className="text-xl font-bold text-red-600" style={numStyle}>
            {formatWon(totalCost)}
          </div>
        </div>
        <div>
          <div className="mb-0.5 text-xs text-slate-500">평균단가</div>
          <div className="text-xl font-bold text-slate-900" style={numStyle}>
            {formatWon(avgUnit)}
          </div>
        </div>
      </div>
      <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span>
          {rowCount}개 {channel.recordsLabel}
        </span>
        <span>
          총 {formatCount(totalQty)}
          {unitLabel}
        </span>
      </div>
    </>
  );
}

export function LeadSummary({ count }: { count: number }) {
  return (
    <>
      <div className="mb-3 flex items-center gap-2 border-b border-slate-200 pb-2">
        <span className="badge badge-referral">콜·지·기·소</span>
        <span className="text-sm font-semibold text-slate-700">영업기회</span>
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-3xl font-bold text-purple-700" style={numStyle}>
          {count}
        </div>
        <div className="text-base text-slate-700">건</div>
      </div>
    </>
  );
}
