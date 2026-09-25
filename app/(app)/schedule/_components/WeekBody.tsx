import type { ReactNode } from "react";
import PageContainer from "@/components/PageContainer";

/** Friday–Thursday responsive day columns; goal summary lives in the weekly header.
 *  기존 2열(pc:grid-cols-2) 유지 — 데스크탑에 이미 적절하므로 fluid 전폭만 적용. */
export default function WeekBody({ firstDays, lastDays }: {
  firstDays: ReactNode; lastDays: ReactNode;
}) {
  return <main className="px-4 pb-20 pt-1 pc:px-0 pc:pb-6">
    <PageContainer width="fluid">
      <div className="pc:grid pc:grid-cols-2 pc:items-start pc:gap-8">
        <div className="min-w-0">{firstDays}</div>
        <div className="min-w-0 pc:border-l pc:border-gray-200 pc:pl-8">{lastDays}</div>
      </div>
    </PageContainer>
  </main>;
}
