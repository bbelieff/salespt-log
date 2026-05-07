/**
 * FunnelChart — 6단계 영업퍼널 stacked SVG.
 *
 * SSOT: docs/design/components.md §9-4
 * 단계: 생산 → 유입 → 컨택진행 → 미팅예약 → 미팅완료 → 계약
 * 채널 색: 매입DB=blue / 직접생산=green / 현수막=amber / 콜·지·기·소=purple
 */
"use client";

import type { DashboardChannelMatrix } from "@/types";

interface Props {
  matrix: DashboardChannelMatrix[]; // 4 채널
}

const STAGES = ["생산", "유입", "컨택진행", "미팅예약", "미팅완료", "계약"] as const;
type StageKey = (typeof STAGES)[number];

const CH_COLOR: Record<DashboardChannelMatrix["채널"], string> = {
  매입DB: "#3b82f6",
  직접생산: "#16a34a",
  현수막: "#f59e0b",
  "콜·지·기·소": "#a855f7",
};

function fmtMoney(n: number): string {
  return n.toLocaleString("ko-KR");
}

export default function FunnelChart({ matrix }: Props) {
  // 단계별 4채널 합 + 전체 max (사다리꼴 폭 정규화)
  const stageTotals = STAGES.map((s) => {
    const total = matrix.reduce((sum, m) => sum + (m[s] as number), 0);
    return { stage: s, total };
  });
  const maxTotal = Math.max(...stageTotals.map((s) => s.total), 1);

  // 유입 → 계약 전환율
  const inflowTotal = stageTotals.find((s) => s.stage === "유입")?.total ?? 0;
  const contractTotal = stageTotals.find((s) => s.stage === "계약")?.total ?? 0;
  const conversionRate = inflowTotal > 0 ? (contractTotal / inflowTotal) * 100 : 0;

  const W = 358;
  const ROW_H = 24; // 사다리꼴 높이 15 + 레이블 9
  const TRAP_H = 15;
  const PAD_X = 4;

  return (
    <section className="rounded-md bg-white p-3 shadow-sm">
      {/* 액센트 바 + 제목 */}
      <div className="mb-2 flex items-center gap-1.5">
        <span className="h-5 w-1 rounded-full bg-blue-500" />
        <h2 className="text-sm font-extrabold text-gray-900">영업퍼널 (6단계)</h2>
        <span
          className="ml-auto text-[11px] font-semibold text-gray-500"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          유입→계약 {conversionRate.toFixed(1)}%
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${ROW_H * STAGES.length + 8}`} className="w-full">
        {stageTotals.map((s, i) => {
          const y = i * ROW_H;
          const widthRatio = s.total / maxTotal;
          const trapW = (W - PAD_X * 2) * widthRatio;
          const cx = W / 2;
          // stacked: 채널별 길이 누적
          let cursor = cx - trapW / 2;
          return (
            <g key={s.stage}>
              {matrix.map((m) => {
                const v = m[s.stage] as number;
                const segW = s.total > 0 ? (v / s.total) * trapW : 0;
                const x = cursor;
                cursor += segW;
                return (
                  <rect
                    key={m.채널}
                    x={x}
                    y={y}
                    width={segW}
                    height={TRAP_H}
                    fill={CH_COLOR[m.채널]}
                    opacity={0.9}
                  />
                );
              })}
              {/* 레이블: 단계명 + 합계 */}
              <text
                x={PAD_X}
                y={y + TRAP_H - 3}
                fontSize="10"
                fontWeight="600"
                fill="#374151"
              >
                {s.stage}
              </text>
              <text
                x={W - PAD_X}
                y={y + TRAP_H - 3}
                fontSize="10"
                fontWeight="700"
                fill="#111827"
                textAnchor="end"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {fmtMoney(s.total)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* 채널 범례 */}
      <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
        {matrix.map((m) => (
          <span key={m.채널} className="flex items-center gap-1 text-gray-600">
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{ backgroundColor: CH_COLOR[m.채널] }}
            />
            {m.채널}
          </span>
        ))}
      </div>
    </section>
  );
}
