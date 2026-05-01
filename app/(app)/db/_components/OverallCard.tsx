/**
 * OverallCard — 종합 카드 (4채널 한눈에 + 총합 라인).
 * 정본: db-management.html v11 `renderOverall`
 */
"use client";

import { fmtWon, type ChannelKey } from "../_lib/channels";

interface Item {
  key: ChannelKey;
  name: string;
  color: string;
  count: number;
  unit: string;
  cost: number | null;
  isCost: boolean;
}

interface Props {
  items: Item[];
  totalCost: number;
  totalCount: number;
  activeCh: ChannelKey;
}

const numStyle = { fontVariantNumeric: "tabular-nums" } as const;

export default function OverallCard({
  items,
  totalCost,
  totalCount,
  activeCh,
}: Props) {
  return (
    <div className="mb-3 rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-2">
        <div className="text-sm font-semibold text-gray-800">전체 종합</div>
      </div>
      {items.map((it) => (
        <div
          key={it.key}
          className={`flex items-center justify-between py-1.5 ${
            it.key === activeCh ? "-mx-2 rounded-md bg-gray-50 px-2" : ""
          }`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: it.color }}
            />
            <span className="truncate text-sm text-gray-700">{it.name}</span>
          </div>
          <div className="flex shrink-0 items-baseline gap-3">
            <span className="text-sm text-gray-500" style={numStyle}>
              {fmtWon(it.count)}
              {it.unit}
            </span>
            <span
              className={`w-24 text-right text-sm font-semibold ${
                it.isCost ? "text-red-600" : "text-gray-300"
              }`}
              style={numStyle}
            >
              {it.isCost ? "₩" + fmtWon(it.cost ?? 0) : "–"}
            </span>
          </div>
        </div>
      ))}
      <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
        <span className="text-sm font-semibold text-gray-800">총 매입 합계</span>
        <div className="flex items-baseline gap-3">
          <span className="text-sm text-gray-600" style={numStyle}>
            {fmtWon(totalCount)}건
          </span>
          <span
            className="w-24 text-right text-base font-bold text-red-600"
            style={numStyle}
          >
            ₩{fmtWon(totalCost)}
          </span>
        </div>
      </div>
    </div>
  );
}
