/**
 * ProductivityIndicators — 생산성 지표 4개 (DB퀄리티/컨택숙련도/미팅숙련도/영업생산성).
 *
 * SSOT: docs/design/components.md §9-5
 * 디자인 정본: prototype line 435~493
 *
 * 구조: 4개 stacked linear progress bars (수직 정렬)
 *   각 행: 라벨 + 보조(가는 회색) + 우측 % + 진행바
 *   1) DB 퀄리티     — 유입 → 컨택진행      (indigo-300 진행바, indigo-600 %)
 *   2) 컨택숙련도   — 컨택진행 → 미팅예약  (indigo-500 진행바, indigo-700 %)
 *   3) 미팅숙련도   — 미팅완료 → 계약       (indigo-700 진행바, indigo-800 %)
 *   4) 영업생산성   — 컨택진행 → 계약 (강조) bg-gradient indigo-50→purple-50, "종합" 배지,
 *                                              indigo-500→purple-600 그라데이션 진행바
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

  const dbQuality = ratio(contactProgress, inflow);
  const contactSkill = ratio(meetingReservation, contactProgress);
  const meetingSkill = ratio(contract, meetingCompleted);
  const salesProductivity = ratio(contract, contactProgress);

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
          label="컨택숙련도"
          formula="컨택진행 → 미팅예약"
          value={contactSkill}
          barCls="bg-indigo-500"
          pctCls="text-indigo-700"
        />
        <Row
          label="미팅숙련도"
          formula="미팅완료 → 계약"
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
