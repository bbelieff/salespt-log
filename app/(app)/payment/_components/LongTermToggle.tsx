/**
 * 업체 상태 「진행 | 장기관리」 작은 세그먼트 — 상세 배너 오른쪽 끝(「기본 너비」 옆). 2026-10-23 belie.
 * 값은 실제 상태(직접 지정 또는 자동 — lib/analytics/long-term.ts). 누르면 직접 지정으로 저장한다.
 */
"use client";

import type { CompanyStage } from "@/lib/analytics/long-term";

const STAGES: CompanyStage[] = ["진행", "장기관리"];

export default function LongTermToggle({ value, onChange, pending = false, className = "" }: {
  value: CompanyStage;
  onChange: (next: CompanyStage) => void;
  pending?: boolean;
  className?: string;
}) {
  const long = value === "장기관리";
  return (
    <div role="group" aria-label="이 업체 상태" data-payment-stage-toggle={value}
      title="진행건이 모두 수납완료·중도중지(또는 조건 대기·장기관리)가 되면 저절로 장기관리로 옮겨져요. 직접 바꿀 수도 있어요."
      className={`inline-flex shrink-0 gap-0.5 rounded-md border bg-white/70 p-0.5 ${long ? "border-amber-300" : "border-blue-200"} ${className}`}>
      {STAGES.map((stage) => (
        <button key={stage} type="button" aria-pressed={value === stage} disabled={pending}
          onClick={() => { if (stage !== value) onChange(stage); }}
          className={`h-5 rounded px-2 text-px-10 font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-wait ${value === stage ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-800"}`}>
          {stage}
        </button>
      ))}
    </div>
  );
}
