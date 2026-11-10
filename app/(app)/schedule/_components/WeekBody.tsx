import type { ReactNode } from "react";
import PageContainer from "@/components/PageContainer";

/** Friday–Thursday responsive day columns; goal summary lives in the weekly header.
 *  기존 2열(pc:grid-cols-2) 유지 — 데스크탑에 이미 적절하므로 fluid 전폭만 적용. */
export default function WeekBody({ firstDays, lastDays }: {
  firstDays: ReactNode; lastDays: ReactNode;
}) {
  return <main className="px-4 pb-20 pt-1 pc:px-0 pc:pb-6">
    <PageContainer width="fluid">
      {/* 화면 마감 v2: 주간 본문 = 흰 판 하나(상자 1단). 하루는 제목 줄, 미팅은 줄 목록. */}
      <div className="rounded-2xl border border-slate-200/70 bg-white px-3 pb-1 pt-4 pc:grid pc:grid-cols-2 pc:items-start pc:gap-8 pc:px-6">
        <div className="min-w-0">{firstDays}</div>
        <div className="min-w-0 pc:border-l pc:border-slate-100 pc:pl-8">{lastDays}</div>
      </div>
    </PageContainer>
  </main>;
}
