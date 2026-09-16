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
  const navigation = <div className="relative z-20 flex shrink-0 items-center" aria-label="주간 목표 주차 이동">
    <button type="button" aria-label="이전 주차 목표" disabled={!current || q.isFetching || current.week <= 1}
      onClick={() => move(-7)} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-30"><ChevronLeft className="h-4 w-4" aria-hidden /></button>
    <button type="button" aria-label="현재 주차로" disabled={selectedDate === undefined}
      onClick={() => setSelectedDate(undefined)} className="min-h-11 rounded-lg px-2 text-xs font-semibold hover:bg-gray-100 disabled:opacity-30">{date ? "선택 주" : "이번 주"}</button>
    <button type="button" aria-label="다음 주차 목표" disabled={!current || q.isFetching || selectedDate === undefined || current.start >= anchorStart}
      onClick={() => move(7)} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-30"><ChevronRight className="h-4 w-4" aria-hidden /></button>
  </div>;
  const status = q.isPending ? <span role="status" className="text-xs text-gray-500">불러오는 중…</span> :
    q.isError ? <div role="alert" className="relative z-20 text-xs text-red-600">목표를 불러오지 못했어요.<button type="button" onClick={() => void q.refetch()} className="min-h-11 px-2 underline">다시 시도</button></div> : null;
  if (compact) return <section aria-label="주간 목표" className="relative isolate flex min-h-11 min-w-0 items-center gap-2 rounded-lg text-xs">
    <button type="button" aria-label="목표·PT과제 열기" onClick={() => router.push("/weekly-goals?" + entry)}
      className="absolute inset-0 z-10 rounded-lg hover:bg-blue-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" />
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
      <span className="flex shrink-0 items-center gap-1 font-semibold text-gray-600"><Target className="h-3.5 w-3.5" aria-hidden />{current ? `${current.week}주 목표` : "주간 목표"}</span>
      {status ?? (current && <GoalCompactMetrics goals={current.record.goals} actuals={current.actuals} metrics={metrics ?? GOAL_KEYS} />)}
    </div>
    <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
  </section>;
  return <section className={className + " relative isolate rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"} aria-label="주간 목표">
    <button type="button" aria-label="주간 목표·PT과제 상세 보기" onClick={() => router.push("/weekly-goals?" + entry)} className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500" />
    <div className="flex flex-wrap items-center justify-between gap-x-2">
      <h2 className="flex items-center gap-2 text-base font-extrabold text-gray-900"><span aria-hidden className="h-5 w-1 shrink-0 rounded-full bg-teal-400" /><span>주간 목표 {current && <span className="text-sm text-gray-500">· {current.week}주차</span>}</span></h2>
      {navigation}
    </div>
    {status ?? (current && <>
      <p className="mb-2 text-xs text-gray-500">{current.start} ~ {current.end}</p>
      <GoalRings goals={current.record.goals} actuals={current.actuals} metrics={metrics} showStatus={false} />
      <div className="mt-3 rounded-xl border border-teal-100 bg-teal-50/60 p-3">
        <div className="mb-1 flex items-center justify-between text-xs font-bold text-teal-800"><span>{selectedDate ? `${current.week}주차 PT과제` : "이번 주 PT과제"}</span><ChevronRight className="h-4 w-4" aria-hidden /></div>
        <p className="line-clamp-2 whitespace-pre-line break-words text-xs leading-relaxed text-slate-700">{current.record.task?.trim() || "등록된 PT과제가 없어요"}</p>
      </div>
    </>)}
  </section>;
}
