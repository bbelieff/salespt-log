"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DirtyProvider, { useGuardedNav } from "@/components/DirtyGuard";
import { useGoalView, goalAccessDenied } from "./client";
import WeeklyGoalEditor from "./WeeklyGoalEditor";

function Content({ student, date, week, trainer }: { student: string; date: string; week: string; trainer: boolean }) {
  const [selected, setSelected] = useState(week);
  const [generation, setGeneration] = useState(0);
  const [deniedTarget, setDeniedTarget] = useState<string | null>(null);
  const p = new URLSearchParams();
  if (student) p.set("student", student);
  if (date) p.set("date", date);
  if (selected) p.set("week", selected);
  const target = p.toString();
  const query = useGoalView(target);
  const denied = goalAccessDenied(query.error);
  useEffect(() => { if (denied) setDeniedTarget(target); }, [denied, target]);
  const locked = denied || deniedTarget === target;
  const nav = useGuardedNav();
  const router = useRouter();
  return <main className="min-h-dvh bg-gray-50 p-4">
    <div className="mx-auto max-w-5xl space-y-4">
      <button onClick={() => nav(() => router.push(trainer ? "/trainer/weekly-goals" : "/dashboard"))} className="min-h-11 px-3 text-sm">← {trainer ? "담당 수강생" : "대시보드"}</button>
      {(query.isError || locked) && <div role="alert">{query.error?.message || "접근 권한을 다시 확인해 주세요."}<button onClick={() => {
        void query.refetch().then(result => { if (!result.isError) setDeniedTarget(null); });
      }} className="ml-3 min-h-11 underline">다시 시도</button></div>}
      {query.isPending && <p role="status">목표를 불러오는 중…</p>}
      {query.data && !locked && <WeeklyGoalEditor key={[query.data.student.email, query.data.student.cohort, query.data.student.courseStart, query.data.current.start, generation].join("|")}
          view={query.data} readFailed={query.isError} changeWeek={w => setSelected(String(w))}
          reload={() => { void query.refetch().then(r => { if (!r.isError) setGeneration(g => g + 1); }); }} />}
    </div>
  </main>;
}
export default function WeeklyGoalPage(props: { student: string; date: string; week: string; trainer: boolean }) {
  return <DirtyProvider><Content {...props} /></DirtyProvider>;
}
