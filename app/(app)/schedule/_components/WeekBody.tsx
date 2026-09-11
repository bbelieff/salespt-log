import type { ReactNode } from "react";
import PageContainer from "@/components/PageContainer";

/** Friday–Thursday responsive day columns; goal summary lives in the weekly header. */
export default function WeekBody({ firstDays, lastDays }: {
  firstDays: ReactNode; lastDays: ReactNode;
}) {
  return <main className="px-4 pb-20 pt-1">
    <PageContainer width="wide">
      <div className="pc:grid pc:grid-cols-2 pc:items-start pc:gap-8">
        <div>{firstDays}</div>
        <div className="pc:border-l pc:border-gray-200 pc:pl-8">{lastDays}</div>
      </div>
    </PageContainer>
  </main>;
}
