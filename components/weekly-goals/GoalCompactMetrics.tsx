import { Check, ArrowUpRight } from "lucide-react";
import { GOAL_LABELS, type GoalKey, type WeeklyGoalValues, type GoalActuals } from "@/types/weekly-goals";

const tones: Record<GoalKey, string> = {
  production: "border-blue-200 bg-blue-50 text-blue-700",
  inflow: "border-blue-200 bg-blue-50 text-blue-700",
  contacts: "border-emerald-200 bg-emerald-50 text-emerald-700",
  meetings: "border-violet-200 bg-violet-50 text-violet-700",
  contracts: "border-violet-200 bg-violet-50 text-violet-700",
};

/** Compact metric badges, visually distinct from the dashboard's five rings. */
export default function GoalCompactMetrics({ goals, actuals, metrics }: {
  goals: WeeklyGoalValues; actuals: GoalActuals; metrics: readonly GoalKey[];
}) {
  return <div className="flex min-w-0 flex-wrap gap-1.5">{metrics.map(key => {
    const goal = goals[key], actual = actuals[key];
    const percent = goal === null || goal === 0 ? null : Math.round(actual / goal * 100);
    const status = goal === null ? "미설정" : goal === 0 ? "목표 0" : actual >= goal ? (actual > goal ? `+${actual - goal} 초과` : "달성") : `${percent}%`;
    return <div key={key} aria-label={`${GOAL_LABELS[key]} 실적 ${actual}, 목표 ${goal ?? "미설정"}, ${status}`}
      className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 ${goal === null ? "border-gray-200 bg-gray-50 text-gray-500" : tones[key]}`}>
      <span className="font-medium">{GOAL_LABELS[key]}</span>
      <span className="tabular-nums"><strong className="font-bold">{actual}</strong><span className="opacity-60"> / {goal ?? "—"}</span></span>
      <span className="flex items-center gap-0.5 border-l border-current pl-1.5 font-semibold tabular-nums">
        {goal !== null && goal > 0 && actual >= goal && (actual > goal ? <ArrowUpRight className="h-3 w-3" aria-hidden /> : <Check className="h-3 w-3" aria-hidden />)}{status}
      </span>
    </div>;
  })}</div>;
}
