"use client";
import { useGuardedRouter } from "@/components/DirtyGuard";
import type { GoalKey } from "@/types/weekly-goals";
import { useGoalView } from "./client";
import GoalRings from "./GoalRings";

export default function WeeklyGoalSummary({ date, metrics, student }: { date?: string; metrics?: readonly GoalKey[]; student?: string }) {
  const router = useGuardedRouter();
  const p = new URLSearchParams();
  if (date) p.set("date", date);
  if (student) p.set("student", student);
  const q = useGoalView(p.toString());
  return <section className="m-4 rounded-2xl border border-gray-200 bg-white p-4" aria-label="주간 목표">
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="font-bold">주간 목표 {q.data && <span className="text-sm text-gray-500">· {q.data.current.week}주차</span>}</h2>
      <button type="button" onClick={() => router.push("/weekly-goals?" + p)} className="min-h-11 rounded-lg px-3 py-2 text-sm font-semibold text-brand-red">목표·PT과제 열기</button>
    </div>
    {q.isPending ? <p role="status" className="text-sm text-gray-500">불러오는 중…</p> :
      q.isError ? <p role="alert" className="text-sm text-red-600">{q.error.message}</p> :
      <><p className="mb-3 text-xs text-gray-500">{q.data.current.start} ~ {q.data.current.end}</p>
        <GoalRings goals={q.data.current.record.goals} actuals={q.data.current.actuals} metrics={metrics} />
        {q.data.current.record.task && <p className="mt-3 whitespace-pre-wrap break-words text-sm">{q.data.current.record.task}</p>}
      </>}
  </section>;
}
