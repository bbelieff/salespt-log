/**
 * ProductivityIndicators — 생산성 지표 4개 (DB퀄리티/컨택숙련도/미팅숙련도/영업생산성).
 *
 * SSOT: docs/design/components.md §9-5, docs/domains/data-model.md §생산성 지표
 * 그라데이션: 입구 옅음(indigo-300) → 종착 진함(영업생산성 = indigo-purple gradient).
 */
"use client";

import type { DashboardChannelMatrix } from "@/types";

interface Props {
  matrix: DashboardChannelMatrix[];
}

function ratio(a: number, b: number): number {
  return b > 0 ? (a / b) * 100 : 0;
}

export default function ProductivityIndicators({ matrix }: Props) {
  // 4채널 합
  const sum = (key: keyof DashboardChannelMatrix) =>
    matrix.reduce((s, m) => s + (typeof m[key] === "number" ? (m[key] as number) : 0), 0);

  const inflow = sum("유입");
  const contactProgress = sum("컨택진행");
  const meetingReservation = sum("미팅예약");
  const meetingCompleted = sum("미팅완료");
  const contract = sum("계약");

  const dbQuality = ratio(contactProgress, inflow);
  const contactSkill = ratio(meetingReservation, contactProgress);
  const meetingSkill = ratio(contract, meetingCompleted);
  const salesProductivity = ratio(contract, contactProgress);

  return (
    <section className="rounded-md bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="h-5 w-1 rounded-full bg-indigo-500" />
        <h2 className="text-sm font-extrabold text-gray-900">생산성 지표</h2>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric label="DB 퀄리티" value={dbQuality} formula="컨택진행 ÷ 유입" cls="text-indigo-300" />
        <Metric
          label="컨택숙련도"
          value={contactSkill}
          formula="미팅예약 ÷ 컨택진행"
          cls="text-indigo-500"
        />
        <Metric label="미팅숙련도" value={meetingSkill} formula="계약 ÷ 미팅완료" cls="text-indigo-700" />
        <MetricEmphasis
          label="영업생산성"
          value={salesProductivity}
          formula="계약 ÷ 컨택진행"
        />
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  formula,
  cls,
}: {
  label: string;
  value: number;
  formula: string;
  cls: string;
}) {
  return (
    <div className="rounded-md border border-gray-100 bg-white p-2">
      <div className="text-[10px] text-gray-500">{label}</div>
      <div
        className={`text-lg font-extrabold ${cls}`}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value.toFixed(1)}%
      </div>
      <div className="text-[9px] text-gray-400">{formula}</div>
    </div>
  );
}

function MetricEmphasis({
  label,
  value,
  formula,
}: {
  label: string;
  value: number;
  formula: string;
}) {
  return (
    <div className="rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 p-2 text-white shadow-sm">
      <div className="text-[10px] text-indigo-100">{label}</div>
      <div className="text-lg font-extrabold" style={{ fontVariantNumeric: "tabular-nums" }}>
        {value.toFixed(1)}%
      </div>
      <div className="text-[9px] text-indigo-200">{formula}</div>
    </div>
  );
}
