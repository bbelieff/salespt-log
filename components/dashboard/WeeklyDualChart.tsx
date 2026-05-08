/**
 * WeeklyDualChart — 8주차 추이 (활동량 bar + 영업이익 line, 2축).
 *
 * SSOT: docs/design/components.md §9-6
 * 디자인 정본: prototype line 505~605
 *
 * 좌Y축: 활동량 (slate-300 bar) — 0~100 범위
 * 우Y축: 영업이익 (blue-500 line) — -50~250 만원 범위 (300 폭)
 *
 * SVG (viewBox 0 0 358 200):
 *   차트 영역: x 30~328 (298), y 16~160 (144)
 *   X: 8주, 폭 = 298/8 = 37.25, 막대 가운데 = 30 + 37.25*(i+0.5)
 *   활동량 y(v): 160 - v*144/100  (0→160, 50→88, 100→16)
 *   영업이익 y(p): 160 - (p+50)*144/300  (-50→160, 0→136, 100→88, 200→40, 250→16)
 *   막대 폭 24, rx 2
 */
"use client";

import type { DashboardWeeklyPoint } from "@/types";

interface Props {
  points: DashboardWeeklyPoint[]; // 길이 8
}

const X0 = 30;
const X1 = 328;
const Y_TOP = 16;
const Y_BOT = 160;
const STEP = (X1 - X0) / 8; // 37.25
const BAR_W = 24;
const ACT_MAX = 100; // 활동량 max
const PROFIT_MIN = -50;
const PROFIT_MAX = 250;
const PROFIT_RANGE = PROFIT_MAX - PROFIT_MIN; // 300

const xAt = (i: number) => X0 + STEP * (i + 0.5);
const yAct = (v: number) => Y_BOT - (v / ACT_MAX) * (Y_BOT - Y_TOP);
const yProfit = (p: number) =>
  Y_BOT - ((p - PROFIT_MIN) / PROFIT_RANGE) * (Y_BOT - Y_TOP);

export default function WeeklyDualChart({ points }: Props) {
  // 8주 padding (부족하면 0으로 채움)
  const data: DashboardWeeklyPoint[] = Array.from({ length: 8 }, (_, i) =>
    points[i] ?? { 주차: i + 1, 영업이익: 0, 활동량: 0 },
  );

  const linePoints = data
    .map((d, i) => `${xAt(i)},${yProfit(d.영업이익)}`)
    .join(" ");

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      {/* 섹션 제목 + 범례 */}
      <div className="mb-3 flex items-center gap-2">
        <span className="h-5 w-1 rounded-full bg-slate-500" />
        <h2 className="text-base font-extrabold text-gray-900">8주차 추이</h2>
        <div className="ml-auto flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-300" />
            <span className="text-slate-500">활동량</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
            <span className="text-blue-600">영업이익</span>
          </span>
        </div>
      </div>

      <svg viewBox="0 0 358 200" className="w-full" aria-label="8주차 추이">
        {/* 가로 그리드 (활동량 50, 100) */}
        <line
          x1={X0}
          y1={yAct(50)}
          x2={X1}
          y2={yAct(50)}
          stroke="#f1f5f9"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
        <line
          x1={X0}
          y1={yAct(100)}
          x2={X1}
          y2={yAct(100)}
          stroke="#f1f5f9"
          strokeWidth={1}
          strokeDasharray="2 3"
        />

        {/* 0선 (영업이익) */}
        <line
          x1={X0}
          y1={yProfit(0)}
          x2={X1}
          y2={yProfit(0)}
          stroke="#cbd5e1"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <text x={332} y={yProfit(0) + 3} fontSize="9" fill="#94a3b8">
          0
        </text>

        {/* 좌 Y축 라벨 (활동량) */}
        <text x={26} y={Y_TOP + 4} textAnchor="end" fontSize="9" fill="#94a3b8">
          100
        </text>
        <text x={26} y={yAct(50) + 4} textAnchor="end" fontSize="9" fill="#94a3b8">
          50
        </text>
        <text x={26} y={Y_BOT + 4} textAnchor="end" fontSize="9" fill="#94a3b8">
          0
        </text>

        {/* 우 Y축 라벨 (영업이익, 만원) */}
        <text x={332} y={Y_TOP + 4} fontSize="9" fill="#94a3b8">
          +250
        </text>
        <text x={332} y={yProfit(100) + 4} fontSize="9" fill="#94a3b8">
          +100
        </text>
        <text x={332} y={Y_BOT + 4} fontSize="9" fill="#94a3b8">
          −50
        </text>

        {/* 활동량 막대 (slate-300) */}
        {data.map((d, i) => {
          const cx = xAt(i);
          const y = yAct(d.활동량);
          return (
            <rect
              key={`bar-${d.주차}`}
              x={cx - BAR_W / 2}
              y={y}
              width={BAR_W}
              height={Math.max(0, Y_BOT - y)}
              fill="#cbd5e1"
              rx={2}
            />
          );
        })}

        {/* 영업이익 라인 */}
        <polyline
          points={linePoints}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* 점 (마지막은 강조) */}
        {data.map((d, i) => (
          <circle
            key={`pt-${d.주차}`}
            cx={xAt(i)}
            cy={yProfit(d.영업이익)}
            r={i === data.length - 1 ? 4.5 : 3.5}
            fill="#3b82f6"
            stroke={i === data.length - 1 ? "#fff" : undefined}
            strokeWidth={i === data.length - 1 ? 1.5 : 0}
          />
        ))}

        {/* X축 + 주차 라벨 (마지막 8주 강조) */}
        <line x1={X0} y1={Y_BOT} x2={X1} y2={Y_BOT} stroke="#e5e7eb" strokeWidth={1} />
        {data.map((d, i) => (
          <text
            key={`xl-${d.주차}`}
            x={xAt(i)}
            y={178}
            textAnchor="middle"
            fontSize="10"
            fill={i === data.length - 1 ? "#1d4ed8" : "#64748b"}
            fontWeight={i === data.length - 1 ? 700 : undefined}
          >
            {d.주차}주
          </text>
        ))}

        {/* 단위 표시 */}
        <text x={2} y={194} fontSize="9" fill="#94a3b8">
          활동량(건)
        </text>
        <text x={356} y={194} textAnchor="end" fontSize="9" fill="#94a3b8">
          영업이익(만원)
        </text>
      </svg>
    </section>
  );
}
