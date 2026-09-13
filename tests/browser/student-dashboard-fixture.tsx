import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DashboardPage from "../../app/(app)/dashboard/page";
import WeeklyGoalSummary from "../../components/weekly-goals/WeeklyGoalSummary";
import DirtyProvider from "../../components/DirtyGuard";

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function Fixture() {
  const [date, setDate] = React.useState("2026-09-11");
  const [student, setStudent] = React.useState("first@example.invalid");
  const [notice, setNotice] = React.useState("");
  const controls = new URLSearchParams(location.search).has("summary");
  return <QueryClientProvider client={client}><DirtyProvider>
    {controls ? <>
      <button onClick={() => setDate("2026-09-18")}>선택 날짜 변경</button>
      <button onClick={() => setStudent("second@example.invalid")}>다른 수강생 선택</button>
      <button onClick={async () => { await fetch("/fixture/fail-next", { method: "POST" }); setNotice("다음 조회 실패 준비됨"); }}>다음 조회 실패</button>
      <p>{notice}</p>
      <WeeklyGoalSummary date={date} student={student} />
    </> : <DashboardPage />}
  </DirtyProvider></QueryClientProvider>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
