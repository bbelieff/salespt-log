import type { ReactNode } from "react";
import PageContainer from "@/components/PageContainer";

/** Friday–Thursday responsive day columns; goal summary lives in the weekly header.
 *  기존 2열(pc:grid-cols-2) 유지 — 데스크탑에 이미 적절하므로 fluid 전폭만 적용. */
export default function WeekBody({ firstDays, lastDays }: {
  firstDays: ReactNode; lastDays: ReactNode;
}) {
  return <main className="px-4 pb-20 pt-1 pc:px-0 pc:pb-6">
    <PageContainer width="fluid">
      {/* 화면 마감 v2 구역 판(2026-11-11 belie 「섹션 구분은 있어야」): 하루 = 흰 판 하나, 판 안 미팅은 줄 목록(상자 2단). */}
      <div className="pc:grid pc:grid-cols-2 pc:items-start pc:gap-4">
        <div className="flex min-w-0 flex-col gap-3">{firstDays}</div>
        <div className="mt-3 flex min-w-0 flex-col gap-3 pc:mt-0">{lastDays}</div>
      </div>
    </PageContainer>
  </main>;
}
