import type { ReactNode } from "react";
import PageContainer from "@/components/PageContainer";
import WeeklyGoalSummary from "@/components/weekly-goals/WeeklyGoalSummary";

/** Selected-week goal summary and existing Friday–Thursday responsive day columns. */
export default function WeekBody({ weekStart, firstDays, lastDays }: {
  weekStart: string; firstDays: ReactNode; lastDays: ReactNode;
}) {
  return <main className="px-4 pb-20 pt-1">
    <PageContainer width="wide">
      <WeeklyGoalSummary date={weekStart} metrics={["meetings", "contracts"]} />
      <div className="pc:grid pc:grid-cols-2 pc:items-start pc:gap-8">
        <div>{firstDays}</div>
        <div className="pc:border-l pc:border-gray-200 pc:pl-8">{lastDays}</div>
      </div>
    </PageContainer>
  </main>;
}
