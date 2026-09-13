"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Target, ChevronRight, ChevronLeft } from "lucide-react";
import { useGuardedRouter } from "@/components/DirtyGuard";
import { GOAL_KEYS, type GoalKey } from "@/types/weekly-goals";
import { addDays, fmtISO, friOf, parseISO, todayKST } from "@/util/week";
import { goalReturnTarget } from "@/util/weekly-goal-navigation";
import { useGoalView } from "./client";
import GoalCompactMetrics from "./GoalCompactMetrics";
import GoalRings from "./GoalRings";

interface Props {
  date?: string; metrics?: readonly GoalKey[]; student?: string; className?: string; compact?: boolean;
}
export default function WeeklyGoalSummary(props: Props) {
  // Reset navigation when the business date/student changes.
  return <Summary key={`${props.student ?? "self"}:${props.date ?? todayKST()}`} {...props} />;
}
function Summary({ date, metrics, student, className = "m-4", compact = false }: Props) {
  const router = useGuardedRouter();
  const pathname = usePathname();
  const [selectedDate, setSelectedDate] = useState<string>();
  const p = new URLSearchParams();
  if (selectedDate ?? date) p.set("date", (selectedDate ?? date)!);
  if (student) p.set("student", student);
  const q = useGoalView(p.toString());
  const entry = new URLSearchParams(p);
  entry.set("returnTo", goalReturnTarget(pathname).href);
  const current = !q.isError ? q.data?.current : undefined;
  const anchorStart = fmtISO(friOf(parseISO(date ?? todayKST())));
  const move = (days: number) => {
    if (!current) return;
    const next = fmtISO(addDays(parseISO(current.start), days));
    setSelectedDate(next >= anchorStart ? undefined : next);
  };
  const navigation = <div className="flex shrink-0 items-center" aria-label="주간 목표 주차 이동">
    <button type="button" aria-label="이전 주차 목표" disabled={!current || q.isFetching || current.week <= 1}
      onClick={() => move(-7)} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-30"><ChevronLeft className="h-4 w-4" aria-hidden /></button>
    <button type="button" aria-label="현재 주차로" disabled={selectedDate === undefined}
      onClick={() => setSelectedDate(undefined)} className="min-h-11 rounded-lg px-2 text-xs font-semibold hover:bg-gray-100 disabled:opacity-30">{date ? "선택 주" : "이번 주"}</button>
    <button type="button" aria-label="다음 주차 목표" disabled={!current || q.isFetching || selectedDate === undefined || current.start >= anchorStart}
      onClick={() => move(7)} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-30"><ChevronRight className="h-4 w-4" aria-hidden /></button>
  </div>;
  const status = q.isPending ? <span role="status" className="text-xs text-gray-500">불러오는 중…</span> :
    q.isError ? <div role="alert" className="text-xs text-red-600">목표를 불러오지 못했어요.<button type="button" onClick={() => void q.refetch()} className="min-h-11 px-2 underline">다시 시도</button></div> : null;
  if (compact) return <section aria-label="주간 목표" className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs">
    <span className="flex items-center gap-1 font-semibold text-gray-600"><Target className="h-3.5 w-3.5" aria-hidden />{current ? `${current.week}주 목표` : "주간 목표"}</span>
    {status ?? (current && <GoalCompactMetrics goals={current.record.goals} actuals={current.actuals} metrics={metrics ?? GOAL_KEYS} />)}
    <button type="button" aria-label="목표·PT과제 열기" onClick={() => router.push("/weekly-goals?" + entry)}
      className="ml-auto flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 font-semibold text-gray-600 hover:bg-gray-100">목표·PT<ChevronRight className="h-3.5 w-3.5" aria-hidden /></button>
  </section>;
  return <section className={className + " rounded-2xl bg-white p-3 shadow-sm"} aria-label="주간 목표">
    <div className="flex flex-wrap items-center justify-between gap-x-2">
      <h2 className="flex items-center gap-2 text-base font-extrabold text-gray-900"><span aria-hidden className="h-5 w-1 shrink-0 rounded-full bg-teal-400" /><span>주간 목표 {current && <span className="text-sm text-gray-500">· {current.week}주차</span>}</span></h2>
      {navigation}
    </div>
    {status ?? (current && <>
      <p className="mb-2 text-xs text-gray-500">{current.start} ~ {current.end}</p>
      <GoalRings goals={current.record.goals} actuals={current.actuals} metrics={metrics} />
      {current.record.task && <p className="mt-2 line-clamp-1 break-words text-xs" title={current.record.task}>{current.record.task}</p>}
    </>)}
    <button type="button" onClick={() => router.push("/weekly-goals?" + entry)} className="mt-1 min-h-11 rounded-lg px-2 text-sm font-semibold text-brand-red">목표·PT과제 열기</button>
  </section>;
}
