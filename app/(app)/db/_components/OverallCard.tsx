/**
 * OverallCard — 종합 카드 (4채널 한눈에 + 총합 라인).
 * 정본: db-management.html v11 `renderOverall`
 */
"use client";

import { type ChannelKey } from "../_lib/channels";
import type { ReactNode } from "react";
import { formatCount, formatWon } from "@/lib/format/money";

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
  activeCh: ChannelKey | null;
  goalSummary?: ReactNode;
}

const numStyle = { fontVariantNumeric: "tabular-nums" } as const;

export default function OverallCard({
  items,
  totalCost,
  totalCount,
  activeCh,
  goalSummary,
}: Props) {
  return (
    // 화면 마감 v2: 요약 한 칸만 밝은 그라데이션(.surface-hero). 채널 칸은 상자 없이
    // 폰은 줄 + 구분선, PC 는 4칸을 세로 선으로 나눈다(.stat-split 과 같은 선 — PC 한정이라 Tailwind 로).
    <div className="surface-hero mb-3 p-4 pc:p-5">
      <div className="mb-2">
        <div className="text-sm font-extrabold text-slate-800">전체 종합</div>
      </div>
      <div className="divide-y divide-slate-200/70 pc:grid pc:grid-cols-4 pc:divide-y-0 pc:py-1">
      {items.map((it) => (
        <div
          key={it.key}
          aria-current={it.key === activeCh ? "true" : undefined}
          className={`flex items-center justify-between py-2 pc:flex-col pc:items-start pc:justify-start pc:gap-1 pc:border-l pc:border-slate-200 pc:py-0.5 pc:pl-4 pc:first:border-l-0 pc:first:pl-0 ${
            it.key === activeCh ? "font-semibold" : ""
          }`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: it.color }}
            />
            <span className={`truncate text-sm ${it.key === activeCh ? "text-slate-900" : "text-slate-700"}`}>{it.name}</span>
          </div>
          <div className="flex shrink-0 items-baseline gap-3 pc:flex-row-reverse pc:justify-end pc:gap-2">
            <span className="text-sm text-slate-500 pc:text-xs" style={numStyle}>
              {formatCount(it.count)}
              {it.unit}
            </span>
            <span
              className={`w-24 text-right text-sm font-semibold pc:w-auto pc:text-left pc:text-lg pc:font-extrabold pc:tracking-tight ${
                it.isCost ? "text-red-600" : "text-slate-300"
              }`}
              style={numStyle}
            >
              {it.isCost ? formatWon(it.cost ?? 0) : "–"}
            </span>
          </div>
        </div>
      ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-slate-200/70 pt-3">
        <span className="text-sm font-extrabold text-slate-800">총 매입 합계</span>
        <div className="flex items-baseline gap-3">
          <span className="text-sm text-slate-600" style={numStyle}>
            {formatCount(totalCount)}건
          </span>
          <span
            className="min-w-24 text-right text-lg font-extrabold tracking-tight text-red-600"
            style={numStyle}
          >
            {formatWon(totalCost)}
          </span>
        </div>
      </div>
      {goalSummary && <div className="mt-3 border-t border-slate-200/70 pt-1">{goalSummary}</div>}
    </div>
  );
}
