/**
 * ChannelCostDonut — 채널별 비용 도넛 (3채널) + 콜·지·기·소 별도 박스.
 *
 * SSOT: docs/design/components.md §9-7
 */
"use client";

import type { DashboardCostBreakdown } from "@/types";

interface Props {
  breakdown: DashboardCostBreakdown[]; // 3 (매입DB/직접생산/현수막)
  콜지기소수임비: number;
}

const COST_COLOR: Record<DashboardCostBreakdown["채널"], string> = {
  매입DB: "#3b82f6",
  직접생산: "#16a34a",
  현수막: "#f59e0b",
};

function fmtMoney(n: number): string {
  return n.toLocaleString("ko-KR");
}

export default function ChannelCostDonut({ breakdown, 콜지기소수임비 }: Props) {
  const total = breakdown.reduce((s, b) => s + b.비용, 0);
  const W = 358;
  const H = 165;
  const cx = 90;
  const cy = H / 2 + 4;
  const r = 50;
  const stroke = 16;

  // 도넛 segment 계산
  let cum = 0;
  const segments = breakdown.map((b) => {
    const portion = total > 0 ? b.비용 / total : 0;
    const startA = cum * 2 * Math.PI - Math.PI / 2;
    cum += portion;
    const endA = cum * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(startA);
    const y1 = cy + r * Math.sin(startA);
    const x2 = cx + r * Math.cos(endA);
    const y2 = cy + r * Math.sin(endA);
    const largeArc = portion > 0.5 ? 1 : 0;
    return {
      d: `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
      color: COST_COLOR[b.채널],
      label: b.채널,
      value: b.비용,
      pct: portion * 100,
    };
  });

  return (
    <section className="rounded-md bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="h-5 w-1 rounded-full bg-red-500" />
        <h2 className="text-sm font-extrabold text-gray-900">채널별 비용</h2>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {/* 도넛 */}
        {segments.map((s) => (
          <path
            key={s.label}
            d={s.d}
            stroke={s.color}
            strokeWidth={stroke}
            fill="none"
            opacity={0.9}
          />
        ))}
        {/* 중앙 총비용 */}
        <text x={cx} y={cy - 4} fontSize="10" fill="#6b7280" textAnchor="middle">
          총비용
        </text>
        <text
          x={cx}
          y={cy + 12}
          fontSize="13"
          fontWeight="700"
          fill="#111827"
          textAnchor="middle"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          ₩{fmtMoney(total)}
        </text>

        {/* 우측 범례 */}
        {segments.map((s, i) => {
          const ly = 30 + i * 22;
          return (
            <g key={`${s.label}-legend`}>
              <rect x={170} y={ly - 8} width={10} height={10} fill={s.color} rx={2} />
              <text x={186} y={ly} fontSize="11" fill="#374151">
                {s.label}
              </text>
              <text
                x={W - 12}
                y={ly}
                fontSize="11"
                fontWeight="600"
                fill="#111827"
                textAnchor="end"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                ₩{fmtMoney(s.value)} ({s.pct.toFixed(1)}%)
              </text>
            </g>
          );
        })}
      </svg>

      {/* 콜·지·기·소 별도 박스 */}
      <div className="mt-2 flex items-center justify-between rounded-md border border-dashed border-purple-300 bg-purple-50/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-purple-500" />
          <span className="text-xs font-semibold text-gray-700">
            콜·지·기·소 (비용 발생 없음)
          </span>
        </div>
        <span
          className="text-xs font-extrabold text-purple-700"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          수임비 ₩{fmtMoney(콜지기소수임비)}
        </span>
      </div>
    </section>
  );
}
