"use client";
import { useGuardedRouter } from "@/components/DirtyGuard";
import { GOAL_KEYS, type GoalKey } from "@/types/weekly-goals";
import { useGoalView } from "./client";
import { Target, ChevronRight } from "lucide-react";
import GoalCompactMetrics from "./GoalCompactMetrics";
import GoalRings from "./GoalRings";
import { usePathname } from "next/navigation";
import { goalReturnTarget } from "@/util/weekly-goal-navigation";

export default function WeeklyGoalSummary({ date, metrics, student, className = "m-4", compact = false }: {
  date?: string; metrics?: readonly GoalKey[]; student?: string; className?: string; compact?: boolean;
}) {
  const router = useGuardedRouter();
  const pathname = usePathname();
  const p = new URLSearchParams();
  if (date) p.set("date", date);
  if (student) p.set("student", student);
  const q = useGoalView(p.toString());
  const entry = new URLSearchParams(p);
  entry.set("returnTo", goalReturnTarget(pathname).href);
  if (compact) return <section aria-label="주간 목표" className="grid min-w-0 grid-cols-2 items-center gap-x-3 gap-y-1 text-xs pc:flex pc:flex-wrap">
    <span className="flex shrink-0 items-center gap-1 font-semibold text-gray-600"><Target className="h-3.5 w-3.5" aria-hidden />{q.data ? q.data.current.week + "주 목표" : "주간 목표"}</span>
    {q.isPending ? <span role="status" className="text-gray-500">불러오는 중…</span> :
      q.isError ? <span role="alert" className="text-red-600">목표를 불러오지 못했어요.</span> :
        <div className="order-3 col-span-2 pc:order-none"><GoalCompactMetrics goals={q.data.current.record.goals} actuals={q.data.current.actuals} metrics={metrics ?? GOAL_KEYS} /></div>}
    <button type="button" aria-label="목표·PT과제 열기" onClick={() => router.push("/weekly-goals?" + entry)}
      className="order-2 ml-auto flex min-h-11 pc:order-none pc:min-h-14 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-500">목표·PT<ChevronRight className="h-3.5 w-3.5" aria-hidden /></button>
  </section>;
  return <section className={className + " rounded-2xl border border-gray-200 bg-white p-3"} aria-label="주간 목표">
    <div className="mb-1 flex items-center justify-between gap-2">
      <h2 className="font-bold">주간 목표 {q.data && <span className="text-sm text-gray-500">· {q.data.current.week}주차</span>}</h2>
      <button type="button" onClick={() => router.push("/weekly-goals?" + entry)} className="min-h-11 rounded-lg px-3 py-2 text-sm font-semibold text-brand-red">목표·PT과제 열기</button>
    </div>
    {q.isPending ? <p role="status" className="text-sm text-gray-500">불러오는 중…</p> :
      q.isError ? <p role="alert" className="text-sm text-red-600">{q.error.message}</p> :
      <><p className="mb-2 text-xs text-gray-500">{q.data.current.start} ~ {q.data.current.end}</p>
        <GoalRings goals={q.data.current.record.goals} actuals={q.data.current.actuals} metrics={metrics} />
        {q.data.current.record.task && <p className="mt-2 line-clamp-1 break-words text-xs" title={q.data.current.record.task}>{q.data.current.record.task}</p>}
      </>}
  </section>;
}
