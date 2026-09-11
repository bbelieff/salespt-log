import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import WeeklyGoalPage from "../../components/weekly-goals/WeeklyGoalPage";
import WeeklyGoalSummary from "../../components/weekly-goals/WeeklyGoalSummary";
import TrainerGoalOverview from "../../components/weekly-goals/TrainerGoalOverview";
import OverallCard from "../../app/(app)/db/_components/OverallCard";
import ContactWeekHeader from "../../app/(app)/contact/_components/WeekHeader";
import SummaryBar from "../../app/(app)/schedule/_components/SummaryBar";
import WeekBody from "../../app/(app)/schedule/_components/WeekBody";
import DashboardPage from "../../app/(app)/dashboard/page";
import DirtyProvider, { useDirtyEntry } from "../../components/DirtyGuard";
function BusinessInput() {
  const [value, setValue] = React.useState("");
  const [saved, setSaved] = React.useState("");
  useDirtyEntry("business-fixture", value !== saved, () => { setSaved(value); }, () => setValue(saved), "업무 입력");
  return <label>업무 입력<input aria-label="업무 입력" value={value} onChange={e => setValue(e.target.value)} /></label>;
}
const p = new URLSearchParams(location.search);
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const mode = p.get("mode");
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}>
  {mode === "dashboard" ? <DirtyProvider><DashboardPage /></DirtyProvider> : mode === "overview" ? <TrainerGoalOverview /> : mode === "summary" ?
    <DirtyProvider><BusinessInput />
      <div data-testid="db-goal-host"><OverallCard items={[]} totalCost={0} totalCount={0} activeCh="purchase" goalSummary={<WeeklyGoalSummary compact metrics={["production", "inflow"]} />} /></div>
      <div data-testid="contact-goal-host"><ContactWeekHeader weekIndex={2} courseStart="2026-09-04" selectedDate="2026-09-11" todayISO="2026-09-11" weekFunnel={{ 생산: 12, 유입: 4, 컨택진행: 3, 미팅예약: 2 }} onPrevWeek={() => {}} onNextWeek={() => {}} onSelectDay={() => {}} goalSummary={<WeeklyGoalSummary compact date="2026-09-11" metrics={["inflow", "contacts"]} />} /></div>
      <div data-testid="schedule-goal-host"><SummaryBar meetings={[]} goalSummary={<WeeklyGoalSummary compact date="2026-09-11" metrics={["meetings", "contracts"]} />} /></div>
      <WeekBody firstDays={<p>금토일</p>} lastDays={<p>월화수목</p>} /></DirtyProvider> :
    <WeeklyGoalPage student="fixture@example.invalid" week="2" date="" trainer={p.get("role") !== "student"} returnTo={p.get("returnTo") ?? undefined} />}
</QueryClientProvider>);
