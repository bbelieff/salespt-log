"use client";
import { useEffect, useState } from "react";
import TopHeader from "@/components/TopHeader";
import DirtyProvider from "@/components/DirtyGuard";
import { useGoalView, goalAccessDenied } from "./client";
import WeeklyGoalEditor from "./WeeklyGoalEditor";

function Content({ student, date, week }: { student: string; date: string; week: string }) {
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
  // 탭 안 '대시보드로 돌아가기' 제거 — TopHeader 우상단 버튼이 유일한 복귀 동선.
  return <main className="min-h-dvh bg-gray-50 px-4 pb-4">
    <div className="mx-auto max-w-5xl space-y-4">
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

export default function WeeklyGoalPage(props: { student: string; date: string; week: string; trainer: boolean; returnTo?: string }) {
  return <DirtyProvider><div className="min-h-dvh"><TopHeader pageEmoji="" pageTitle="주간 목표·PT과제" roleMode={props.student && props.trainer ? "trainer" : "student"} />
    <Content student={props.student} date={props.date} week={props.week} /></div></DirtyProvider>;
}
