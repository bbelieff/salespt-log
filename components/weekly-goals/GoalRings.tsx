"use client";

import { usePlayOnOpen } from "@/components/motion/useMotion";
import { useCountUp } from "@/components/motion/CountUp";
import { GOAL_KEYS, GOAL_LABELS, type WeeklyGoalValues, type GoalActuals, type GoalKey } from "@/types/weekly-goals";

export default function GoalRings({ goals, actuals, metrics = GOAL_KEYS, showStatus = true }: {
  goals: WeeklyGoalValues; actuals: GoalActuals; metrics?: readonly GoalKey[]; showStatus?: boolean;
}) {
  // 열 때마다 링이 차오르고 숫자가 올라간다(대시보드 움직임, belie 2026-10-09).
  const play = usePlayOnOpen("goal-rings");
  return <div className="flex justify-center gap-1 pc:gap-4" aria-label="주간 목표 실적">
    {metrics.map((key, i) => {
      const goal = goals[key], actual = actuals[key];
      const percent = goal === null || goal === 0 ? null : Math.round(actual / goal * 100);
      const progress = percent === null ? 0 : Math.min(100, percent);
      const delay = { animationDelay: `${i * 120}ms` };
      const label = goal === null ? "미기재" : goal === 0 ? "목표 0" :
        actual > goal ? `초과 ${actual - goal}` : actual === goal ? "달성" : `${goal - actual} 남음`;
      return <div key={key} className="min-w-0 flex-1 text-center pc:max-w-24">
        <div className={`relative mx-auto h-12 w-12 rounded-full pc:h-16 pc:w-16 ${play && percent !== null && percent >= 100 ? "fx-glow" : ""}`} style={{ animationDelay: "900ms" }}>
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="7" className="text-gray-100" />
            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="7" pathLength="100"
              strokeDasharray="100" strokeDashoffset={100 - progress} strokeLinecap="round" style={play ? delay : undefined}
              className={`${percent !== null && percent >= 100 ? "text-green-600" : "text-brand-red"} ${play ? "fx-ring" : ""}`} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums pc:text-sm">{percent === null ? "—" : <RingPercent value={percent} play={play} />}</span>
        </div>
        <p className="text-xs font-semibold pc:text-sm">{GOAL_LABELS[key]}</p>
        <p className="break-words text-xs tabular-nums pc:text-sm">{actual} / {goal ?? "—"}</p>
        {showStatus && <p className="break-words text-xs text-gray-500">{label}</p>}
      </div>;
    })}
  </div>;
}

function RingPercent({ value, play }: { value: number; play: boolean }) {
  const shown = useCountUp(value, play);
  return <span aria-label={`${value}%`}><span aria-hidden="true">{shown}%</span></span>;
}
