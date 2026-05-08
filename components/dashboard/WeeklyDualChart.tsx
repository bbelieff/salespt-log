/**
 * WeeklyDualChart — 8주차 듀얼 (활동량 line + 영업이익 bar, 음수 가능).
 *
 * SSOT: docs/design/components.md §9-6
 */
"use client";

import type { DashboardWeeklyPoint } from "@/types";

interface Props {
  points: DashboardWeeklyPoint[]; // 길이 8
}

export default function WeeklyDualChart({ points }: Props) {
  const W = 358;
  const H = 200;
  const PAD_T = 24;
  const PAD_B = 28;
  const PAD_X = 24;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_T - PAD_B;

  const profits = points.map((p) => p.영업이익);
  const activities = points.map((p) => p.활동량);
  const minProfit = Math.min(...profits, 0);
  const maxProfit = Math.max(...profits, 1);
  const maxActivity = Math.max(...activities, 1);

  const xAt = (i: number) => PAD_X + (innerW * i) / Math.max(points.length - 1, 1);
  // 영업이익: 0이 중앙
  const profitRange = maxProfit - minProfit || 1;
  const yProfit = (v: number) => PAD_T + ((maxProfit - v) / profitRange) * innerH;
  // 활동량: 0~max 정규화
  const yAct = (v: number) => PAD_T + ((maxActivity - v) / maxActivity) * innerH;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAct(p.활동량)}`)
    .join(" ");

  const zeroY = yProfit(0);

  return (
    <section className="rounded-md bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="h-5 w-1 rounded-full bg-slate-500" />
        <h2 className="text-sm font-extrabold text-gray-900">8주차 추이</h2>
        <span className="ml-auto text-[10px] text-gray-500">활동량(라인) · 영업이익(바)</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {/* 0선 */}
        <line x1={PAD_X} x2={W - PAD_X} y1={zeroY} y2={zeroY} stroke="#e5e7eb" strokeDasharray="2 2" />

        {/* 영업이익 바 */}
        {points.map((p, i) => {
          const x = xAt(i);
          const y = yProfit(p.영업이익);
          const barW = innerW / points.length / 2;
          const isNeg = p.영업이익 < 0;
          return (
            <rect
              key={p.주차}
              x={x - barW / 2}
              y={isNeg ? zeroY : y}
              width={barW}
              height={Math.abs(zeroY - y)}
              fill={isNeg ? "#ef4444" : "#3b82f6"}
              opacity={0.7}
              rx={2}
            />
          );
        })}

        {/* 활동량 라인 */}
        <path d={linePath} stroke="#0ea5e9" strokeWidth={2} fill="none" />
        {points.map((p, i) => (
          <circle
            key={p.주차}
            cx={xAt(i)}
            cy={yAct(p.활동량)}
            r={3}
            fill="#0ea5e9"
            stroke="#fff"
            strokeWidth={1.5}
          />
        ))}

        {/* x축 라벨 */}
        {points.map((p, i) => (
          <text
            key={p.주차}
            x={xAt(i)}
            y={H - 8}
            fontSize="10"
            fill="#6b7280"
            textAnchor="middle"
          >
            {p.주차}주
          </text>
        ))}
      </svg>
    </section>
  );
}
