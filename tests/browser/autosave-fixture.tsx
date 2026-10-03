import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DirtyProvider from "../../components/DirtyGuard";
import WeeklyGoalEditor from "../../components/weekly-goals/WeeklyGoalEditor";
import ExpenseLedgerDialog from "../../components/dashboard/expense-ledger/ExpenseLedgerDialog";
import RowCard from "../../app/(app)/db/_components/RowCard";
import { CHANNELS } from "../../app/(app)/db/_lib/channels";
import type { WeeklyGoalView } from "../../lib/types/weekly-goals";

function Fixture() {
  const [view, setView] = useState<WeeklyGoalView | null>(null);
  const [week, setWeek] = useState(2);
  const [expense, setExpense] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const page = new URLSearchParams(location.search).get("page");
  const load = () => { void fetch(`/api/weekly-goals?week=${week}`).then(r => r.json()).then(setView); };
  useEffect(load, [week]);
  useEffect(() => { window.addEventListener("weekly-goals-saved", load); return () => window.removeEventListener("weekly-goals-saved", load); }, [week]);
  return <div className="min-h-dvh">
    <header className="sticky top-0 z-50 flex h-app-header items-center justify-between border-b bg-white px-4 text-sm font-bold">
      <span>세일즈PT · 가상 데이터 검증</span><nav className="flex gap-3"><a href="/">목표</a><a href="/?page=db">DB</a><button onClick={() => setExpense(true)}>비용</button></nav>
    </header>
    <div className="sticky top-app-header z-40 flex h-12 items-center border-b bg-gray-100 px-4 text-sm">{page === "db" ? "DB 생산" : "주간 목표·PT과제"}</div>
    <main className="mx-auto max-w-5xl px-4" style={{paddingBottom:112}}>
      {page === "db" ? <div className="py-4"><RowCard channelKey="purchase" channel={CHANNELS.purchase} index={0}
        row={{ row: 2, 업체명: "가상 구매처", 구매일: "2026-09-21", 주문개수: 10, 개당단가: 1000, 주문금액: 10000, 기타: '', 부가세여부: false }}
        expanded={expanded} pending={false} badgeCls="badge-purchase" onExpand={() => setExpanded(true)} onCollapse={() => setExpanded(false)}
        onSave={async data => { const r = await fetch("/api/fixture-db", { method: "PATCH", body: JSON.stringify(data) }); if (!r.ok) throw new Error("검증용 저장 오류"); }}
        onDeleteRequest={() => {}} /><button className="mt-4 p-2" type="button">입력 영역 밖</button></div>
        : view && <WeeklyGoalEditor key={week} view={view} changeWeek={setWeek} reload={load} />}
    </main>
    <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:40,display:"flex",height:80,alignItems:"center",justifyContent:"space-around",background:"rgba(255,255,255,.7)",backdropFilter:"blur(16px)",borderTop:"1px solid #e5e7eb",fontSize:12}}><span>DB생산</span><span>컨택관리</span><span>캘린더</span><span>일정·계약</span><span>실무/수납</span></div>
    <ExpenseLedgerDialog open={expense} onClose={() => setExpense(false)} dbCostTotal={10000} additionalCost={0} />
  </div>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><DirtyProvider><Fixture /></DirtyProvider></QueryClientProvider></React.StrictMode>);
