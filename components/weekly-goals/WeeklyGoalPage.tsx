"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import DirtyProvider, { useGuardedNav } from "@/components/DirtyGuard";
import { useGoalView } from "./client";
import WeeklyGoalEditor from "./WeeklyGoalEditor";

function Content({ student, date, week, trainer }: { student: string; date: string; week: string; trainer: boolean }) {
  const [selected, setSelected] = useState(week);
  const [generation, setGeneration] = useState(0);
  const p = new URLSearchParams();
  if (student) p.set("student", student);
  if (date) p.set("date", date);
  if (selected) p.set("week", selected);
  const query = useGoalView(p.toString());
  const nav = useGuardedNav();
  const router = useRouter();
  return <main className="min-h-dvh bg-gray-50 p-4">
    <div className="mx-auto max-w-5xl space-y-4">
      <button onClick={() => nav(() => router.push(trainer ? "/trainer/weekly-goals" : "/dashboard"))} className="min-h-11 px-3 text-sm">← {trainer ? "담당 수강생" : "대시보드"}</button>
      {query.isError && <div role="alert">{query.error.message}<button onClick={() => void query.refetch()} className="ml-3 underline">다시 시도</button></div>}
      {query.isPending && <p role="status">목표를 불러오는 중…</p>}
      {query.data && <WeeklyGoalEditor key={[query.data.student.email, query.data.student.cohort, query.data.student.courseStart, query.data.current.start, generation].join("|")}
          view={query.data} readFailed={query.isError} changeWeek={w => setSelected(String(w))}
          reload={() => { void query.refetch().then(r => { if (!r.isError) setGeneration(g => g + 1); }); }} />}
    </div>
  </main>;
}
export default function WeeklyGoalPage(props: { student: string; date: string; week: string; trainer: boolean }) {
  return <DirtyProvider><Content {...props} /></DirtyProvider>;
}
