import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import WeeklyGoalPage from "../../components/weekly-goals/WeeklyGoalPage";
import WeeklyGoalSummary from "../../components/weekly-goals/WeeklyGoalSummary";
import TrainerGoalOverview from "../../components/weekly-goals/TrainerGoalOverview";
import WeekBody from "../../app/(app)/schedule/_components/WeekBody";
const p = new URLSearchParams(location.search);
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const mode = p.get("mode");
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}>
  {mode === "overview" ? <TrainerGoalOverview /> : mode === "summary" ?
    <><WeeklyGoalSummary metrics={["production", "inflow"]} /><WeeklyGoalSummary metrics={["inflow", "contacts"]} /><WeekBody weekStart="2026-09-11" firstDays={<p>금토일</p>} lastDays={<p>월화수목</p>} /></> :
    <WeeklyGoalPage student="fixture@example.invalid" week="2" date="" trainer={p.get("role") !== "student"} />}
</QueryClientProvider>);
