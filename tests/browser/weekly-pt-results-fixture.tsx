import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DirtyProvider from "../../components/DirtyGuard";
import WeeklyGoalEditor from "../../components/weekly-goals/WeeklyGoalEditor";
import type { WeeklyGoalView } from "../../lib/types/weekly-goals";
const goals={production:30,inflow:20,contacts:10,meetings:6,contracts:5};
const record={goals,task:"경쟁사 분석\n컨택 연습",revision:1,updatedAt:null};
const period={week:2,start:"2026-09-11",end:"2026-09-17",record,actuals:goals};
const view:WeeklyGoalView={student:{email:"fixture@example.test",name:"테스트 수강생",cohort:"연습기수",courseStart:"2026-09-04",region:"테스트 지역",trainers:["테스트 트레이너"]},current:period,previous:{...period,week:1,start:"2026-09-04",end:"2026-09-10",record:{...record,task:"경쟁사 세 곳 분석하기\n전화 연습하기\n목표 점검하기"}},reporting:{start:"2026-09-18",end:"2026-09-24",actuals:{...goals,meetings:4,contracts:2}},cumulative:new URLSearchParams(location.search).get("history")==="empty" ? {production:0,inflow:0,contacts:0,meetings:0,contracts:0} : new URLSearchParams(location.search).get("history")==="partial" ? {...goals,production:0} : goals,canReadInternal:new URLSearchParams(location.search).get("role")!=="student"};
const query=new QueryClient();
// Mirrors WeeklyGoalPage: single content-height wrapper inside DirtyProvider encloses
// TopHeader-equivalent sticky header/banner + Content so sticky has a tall containing
// block even with html/body/#root height:100% (see server html <style>).
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={query}><DirtyProvider><div className="min-h-dvh"><header className="sticky top-0 z-50 flex h-app-header items-center border-b bg-white px-4 font-bold">세일즈PT · 화면 검증</header><div className="sticky top-app-header z-40 flex h-12 items-center border-b bg-gray-100 px-4">주간 목표·PT과제</div><main className="mx-auto max-w-5xl px-4 pb-4"><WeeklyGoalEditor view={view} changeWeek={()=>{}} reload={()=>location.reload()}/></main></div></DirtyProvider></QueryClientProvider>);
