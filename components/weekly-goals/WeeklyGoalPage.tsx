"use client";
import { useEffect, useState } from "react";
import TopHeader from "@/components/TopHeader";
import DesktopNav from "@/components/desktop/DesktopNav";
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
  return <main className="weeklygoal-main min-h-dvh bg-gray-50 px-4 pb-4">
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
  // 트레이너 보조 화면(props.student && props.trainer)에는 사이드바를 두지 않는다.
  const isTrainerView = !!(props.student && props.trainer);
  const header = <TopHeader pageEmoji="" pageTitle="주간 목표·PT과제" roleMode={isTrainerView ? "trainer" : "student"} />;
  const body = <Content student={props.student} date={props.date} week={props.week} />;
  if (isTrainerView) {
    return <DirtyProvider><div className="min-h-dvh">{header}{body}</div></DirtyProvider>;
  }
  // STUDENT 모드: (app) 셸과 같은 데스크탑 2단 — 기존 DesktopNav 를 그대로
  // 재사용한다(사이드바 중복 구현 금지). 단일 DirtyProvider 가 사이드바와
  // 본문을 함께 감싸 사이드바 이동도 미저장 가드를 받는다. 모바일 TabBar 는
  // 기존대로 두지 않는다(원래 없음). 별도 DesktopShell 공용 컴포넌트는
  // 만들지 않았다 — 이 6줄 구조가 (app)/layout 과 1:1이라 쪼갤 이득이 없다.
  return <DirtyProvider><div className="min-h-dvh">
    <div className="desktop-shell pc:flex">
      <DesktopNav />
      <div className="min-w-0 pc:flex-1">{header}{body}</div>
    </div>
  </div></DirtyProvider>;
}
