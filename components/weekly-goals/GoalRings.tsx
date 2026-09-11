import { GOAL_KEYS, GOAL_LABELS, type WeeklyGoalValues, type GoalActuals, type GoalKey } from "@/types/weekly-goals";

export default function GoalRings({ goals, actuals, metrics = GOAL_KEYS }: {
  goals: WeeklyGoalValues; actuals: GoalActuals; metrics?: readonly GoalKey[];
}) {
  return <div className="flex flex-wrap justify-center gap-4" aria-label="주간 목표 실적">
    {metrics.map(key => {
      const goal = goals[key], actual = actuals[key];
      const percent = goal === null || goal === 0 ? null : Math.round(actual / goal * 100);
      const progress = percent === null ? 0 : Math.min(100, percent);
      const label = goal === null ? "목표 미기재" : goal === 0 ? "목표 0" :
        actual > goal ? `초과 ${actual - goal}` : actual === goal ? "달성" : `${goal - actual} 남음`;
      return <div key={key} className="w-24 text-center">
        <div className="relative mx-auto h-20 w-20">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="7" className="text-gray-100" />
            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="7" pathLength="100"
              strokeDasharray="100" strokeDashoffset={100 - progress} strokeLinecap="round"
              className={percent !== null && percent >= 100 ? "text-green-600" : "text-brand-red"} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{percent === null ? "—" : `${percent}%`}</span>
        </div>
        <p className="text-sm font-semibold">{GOAL_LABELS[key]}</p>
        <p className="text-sm tabular-nums">{actual} / {goal ?? "—"}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>;
    })}
  </div>;
}
