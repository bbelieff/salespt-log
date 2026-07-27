/**
 * WeeklyDualChart — 8주차 추이 (활동량 bar + 계약수 line, 2축).
 *
 * SSOT: docs/design/components.md §9-6
 *
 * 사용자 결정 2026-05-08: 영업이익 → **계약수** 로 변경.
 *   원: 영업이익 (만원, 음수 가능)
 *   신: 계약수 (건, 0 이상)
 *
 * 좌Y축: 활동량 (slate-300 bar) — 0~max 자동 스케일
 * 우Y축: 계약수 (blue-500 line) — 0~max(계약수) 자동 스케일
 *
 * 시트 출처:
 *   계약수 = 01 영업관리!N{38,72,106,140,174,208,242,276}
 *   활동량 = 대시보드(자동작성) C33:H40 의 마지막(6번째) 컬럼
 */
"use client";

import type { DashboardWeeklyPoint } from "@/types";
import { STATS_WEEKS } from "@/config/cohort-dates";

interface Props {
  points: DashboardWeeklyPoint[]; // 길이 8
}

const X0 = 30;
const X1 = 328;
const Y_TOP = 16;
const Y_BOT = 160;
const STEP = (X1 - X0) / 8; // 37.25
const BAR_W = 24;

const xAt = (i: number) => X0 + STEP * (i + 0.5);

export default function WeeklyDualChart({ points }: Props) {
  // 8주 padding (부족하면 0으로 채움)
  const data: DashboardWeeklyPoint[] = Array.from(
    { length: STATS_WEEKS },
    (_, i) => points[i] ?? { 주차: i + 1, 계약수: 0, 활동량: 0 },
  );

  // 자동 스케일 (max 기준, 데이터 0이면 1로 fallback)
  const actMax = Math.max(...data.map((d) => d.활동량), 1);
  const contractMax = Math.max(...data.map((d) => d.계약수), 1);
  // 시각상 위쪽 여백 10% — Math.ceil(max * 1.1)
  const actScale = Math.ceil(actMax * 1.1) || 1;
  const contractScale = Math.ceil(contractMax * 1.1) || 1;

  const yAct = (v: number) => Y_BOT - (v / actScale) * (Y_BOT - Y_TOP);
  const yContract = (v: number) =>
    Y_BOT - (v / contractScale) * (Y_BOT - Y_TOP);

  const linePoints = data
    .map((d, i) => `${xAt(i)},${yContract(d.계약수)}`)
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
            <span className="text-blue-600">계약수</span>
          </span>
        </div>
      </div>

      <svg viewBox="0 0 358 200" className="w-full" aria-label="8주차 추이">
        {/* 가로 그리드 (활동량 50%, 100%) */}
        <line
          x1={X0}
          y1={yAct(actScale * 0.5)}
          x2={X1}
          y2={yAct(actScale * 0.5)}
          stroke="#f1f5f9"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
        <line
          x1={X0}
          y1={yAct(actScale)}
          x2={X1}
          y2={yAct(actScale)}
          stroke="#f1f5f9"
          strokeWidth={1}
          strokeDasharray="2 3"
        />

        {/* 좌 Y축 라벨 (활동량) */}
        <text x={26} y={Y_TOP + 4} textAnchor="end" fontSize="9" fill="#94a3b8">
          {actScale}
        </text>
        <text
          x={26}
          y={yAct(actScale * 0.5) + 4}
          textAnchor="end"
          fontSize="9"
          fill="#94a3b8"
        >
          {Math.round(actScale * 0.5)}
        </text>
        <text x={26} y={Y_BOT + 4} textAnchor="end" fontSize="9" fill="#94a3b8">
          0
        </text>

        {/* 우 Y축 라벨 (계약수) */}
        <text x={332} y={Y_TOP + 4} fontSize="9" fill="#94a3b8">
          {contractScale}
        </text>
        <text x={332} y={yContract(contractScale * 0.5) + 4} fontSize="9" fill="#94a3b8">
          {Math.round(contractScale * 0.5)}
        </text>
        <text x={332} y={Y_BOT + 4} fontSize="9" fill="#94a3b8">
          0
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

        {/* 계약수 라인 (blue-500) */}
        <polyline
          points={linePoints}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {data.map((d, i) => (
          <circle
            key={`pt-${d.주차}`}
            cx={xAt(i)}
            cy={yContract(d.계약수)}
            r={i === data.length - 1 ? 4.5 : 3.5}
            fill="#3b82f6"
            stroke={i === data.length - 1 ? "#fff" : undefined}
            strokeWidth={i === data.length - 1 ? 1.5 : 0}
          />
        ))}

        {/* X축 + 주차 라벨 */}
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
          계약수(건)
        </text>
      </svg>
    </section>
  );
}
