/**
 * ProductivityIndicators — 생산성 지표 4개 (DB퀄리티/컨택성공률/미팅숙련도/영업생산성).
 *
 * SSOT: docs/design/components.md §9-5
 * 정의 정본: docs/domains/data-model.md §생산성 지표 (사용자 결정 2026-05-08)
 *
 * 4지표 (라벨/공식 통일):
 *   1) DB 퀄리티      = 컨택진행 ÷ 유입         (들어온 DB가 부재/거절 없이 컨택된 비율)
 *   2) 컨택성공률    = 미팅예약 ÷ 컨택진행     (컨택 → 미팅예약 전환 — 구 "컨택숙련도")
 *   3) 미팅숙련도    = 계약 ÷ 미팅완료         (미팅완료 = 계약+완료+취소, 결과 정해진 미팅)
 *   4) 영업생산성    = 계약 ÷ 컨택진행 (강조)  (종합 — 통화부터 계약까지)
 *
 * ⚠ 미팅완료 정의 변경: 기존 "계약+완료" → 신 "계약+완료+취소" (변경만 제외).
 *    DashboardChannelMatrix.미팅완료 필드값이 이 의미로 채워져야 함.
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
  const sum = (key: keyof DashboardChannelMatrix) =>
    matrix.reduce(
      (s, m) => s + (typeof m[key] === "number" ? (m[key] as number) : 0),
      0,
    );

  const inflow = sum("유입");
  const contactProgress = sum("컨택진행");
  const meetingReservation = sum("미팅예약");
  const meetingCompleted = sum("미팅완료");
  const contract = sum("계약");

  const dbQuality = ratio(contactProgress, inflow); // 컨택진행 ÷ 유입
  const contactSuccessRate = ratio(meetingReservation, contactProgress); // 미팅예약 ÷ 컨택진행
  const meetingSkill = ratio(contract, meetingCompleted); // 계약 ÷ 미팅완료(=계약+완료+취소)
  const salesProductivity = ratio(contract, contactProgress); // 계약 ÷ 컨택진행

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-5 w-1 rounded-full bg-indigo-500" />
        <h2 className="text-base font-extrabold text-gray-900">생산성 지표</h2>
        <span className="ml-auto text-xs text-gray-400">8주 누적</span>
      </div>

      <div className="space-y-3">
        <Row
          label="DB 퀄리티"
          formula="유입 → 컨택진행"
          value={dbQuality}
          barCls="bg-indigo-300"
          pctCls="text-indigo-600"
        />
        <Row
          label="컨택성공률"
          formula="컨택진행 → 미팅예약"
          value={contactSuccessRate}
          barCls="bg-indigo-500"
          pctCls="text-indigo-700"
        />
        <Row
          label="미팅숙련도"
          formula="미팅완료(계약+완료+취소) → 계약"
          value={meetingSkill}
          barCls="bg-indigo-700"
          pctCls="text-indigo-800"
        />

        {/* 영업생산성 — 종합 강조 */}
        <div className="mt-3 rounded-lg border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-2.5">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs">
              <span className="font-bold text-indigo-900">영업생산성</span>
              <span className="ml-1 text-indigo-600">컨택진행 → 계약</span>
              <span className="ml-1 rounded bg-indigo-200/70 px-1.5 py-0.5 text-xs font-medium text-indigo-800">
                종합
              </span>
            </div>
            <span
              className="text-base font-bold text-purple-700"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {salesProductivity.toFixed(1)}%
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-indigo-100/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-600"
              style={{ width: `${Math.max(0, Math.min(100, salesProductivity))}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({
  label,
  formula,
  value,
  barCls,
  pctCls,
}: {
  label: string;
  formula: string;
  value: number;
  barCls: string;
  pctCls: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <div className="text-xs">
          <span className="font-semibold text-gray-700">{label}</span>
          <span className="ml-1 text-gray-400">{formula}</span>
        </div>
        <span
          className={`text-sm font-bold ${pctCls}`}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {value.toFixed(1)}%
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${barCls}`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}
