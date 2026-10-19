/**
 * ProductivityIndicators — 생산성 지표 5개 (DB퀄리티/컨택성공률/미팅실행률/미팅숙련도/영업생산성).
 *
 * SSOT: docs/design/components.md §9-5
 * 정의 정본: docs/domains/data-model.md §생산성 지표 (사용자 결정 2026-05-08)
 *
 * 5지표:
 *   1) DB 퀄리티      = 컨택진행 ÷ 유입         (들어온 DB가 부재/거절 없이 컨택된 비율)
 *   2) 컨택성공률    = 미팅예약 ÷ 컨택진행     (컨택 → 미팅예약 전환)
 *   3) 미팅실행률    = 미팅완료 ÷ 미팅예약     (예약된 미팅이 실제로 진행된 비율)
 *   4) 미팅숙련도    = 계약 ÷ 미팅완료         (미팅완료 = 계약+완료, 영업관리!L)
 *   5) 영업생산성    = 계약 ÷ 컨택진행 (강조)  (종합 — 통화부터 계약까지)
 *
 * 미팅완료 정의 (사용자 결정 2026-05-08): **계약+완료** (취소/변경 제외).
 *   시트 출처: 영업관리!L 이미 이 정의로 자동 집계됨 (상태 IN ["계약","완료"]).
 *   matrix.미팅완료 필드는 이 시트값을 그대로 사용.
 */
"use client";

import type { DashboardChannelMatrix } from "@/types";
import { STATS_WEEKS } from "@/config/cohort-dates";
import { usePlayOnOpen } from "@/components/motion/useMotion";
import CountUp from "@/components/motion/CountUp";
import HintTooltip from "@/components/ui/HintTooltip";

const pctText = (n: number) => `${n.toFixed(1)}%`;

interface Props {
  weeks?: number;
  /** 배치용 추가 클래스(예: 넓은 화면에서 옆 카드 높이에 맞춰 늘리기). */
  className?: string;
  matrix: DashboardChannelMatrix[];
}

function ratio(a: number, b: number): number {
  return b > 0 ? (a / b) * 100 : 0;
}

export default function ProductivityIndicators({ matrix, weeks = STATS_WEEKS, className = "" }: Props) {
  const sum = (key: keyof DashboardChannelMatrix) =>
    matrix.reduce(
      (s, m) => s + (typeof m[key] === "number" ? (m[key] as number) : 0),
      0,
    );

  const inflow = sum("유입");
  const contactProgress = sum("컨택진행");
  const meetingReservation = sum("미팅예약");
  const meetingCompleted = sum("미팅완료"); // = 영업관리!L = 계약+완료
  const contract = sum("계약");

  const dbQuality = ratio(contactProgress, inflow); // 컨택진행 ÷ 유입
  const contactSuccessRate = ratio(meetingReservation, contactProgress); // 미팅예약 ÷ 컨택진행
  const meetingExecuteRate = ratio(meetingCompleted, meetingReservation); // 미팅완료 ÷ 미팅예약
  const meetingSkill = ratio(contract, meetingCompleted); // 계약 ÷ 미팅완료
  const salesProductivity = ratio(contract, contactProgress); // 계약 ÷ 컨택진행
  // 열 때마다 막대가 차례로 차고 % 가 올라간다(belie 2026-10-09).
  const play = usePlayOnOpen("productivity");

  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-3 shadow-sm ${className}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="h-5 w-1 rounded-full bg-indigo-500" />
        <h2 className="text-base font-extrabold text-gray-900">생산성 지표</h2>
        <HintTooltip label="생산성 지표 계산 안내" text="각 항목의 도착 단계 건수 ÷ 시작 단계 건수입니다. 아래에 실제 건수를 표시하며, 분모가 0이면 계산할 기록이 없어 —로 표시합니다." />
        <span className="ml-auto text-px-11 text-slate-600">{weeks}주 누적</span>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <Row
          play={play}
          order={0}
          label="DB 퀄리티"
          formula="유입 → 컨택진행"
          value={dbQuality}
          numerator={contactProgress} denominator={inflow}
          barCls="bg-indigo-300"
          pctCls="text-indigo-600"
        />
        <Row
          play={play}
          order={1}
          label="컨택성공률"
          formula="컨택진행 → 미팅예약"
          value={contactSuccessRate}
          numerator={meetingReservation} denominator={contactProgress}
          barCls="bg-indigo-400"
          pctCls="text-indigo-600"
        />
        <Row
          play={play}
          order={2}
          label="미팅실행률"
          formula="미팅예약 → 미팅완료"
          value={meetingExecuteRate}
          numerator={meetingCompleted} denominator={meetingReservation}
          barCls="bg-indigo-500"
          pctCls="text-indigo-700"
        />
        <Row
          play={play}
          order={3}
          label="미팅숙련도"
          formula="미팅완료(계약+완료) → 계약"
          value={meetingSkill}
          numerator={contract} denominator={meetingCompleted}
          barCls="bg-indigo-700"
          pctCls="text-indigo-800"
        />

        {/* 영업생산성 — 종합 강조 */}
        <div className="col-span-2 rounded-lg border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-2.5">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-1 text-px-11">
              <span className="font-bold text-indigo-900">영업생산성</span>
              <span className="hidden pc:inline ml-1 text-indigo-700">컨택진행 → 계약</span>
              <HintTooltip label="영업생산성 계산 기준" text={`계약 ${contract.toLocaleString()}건 ÷ 컨택진행 ${contactProgress.toLocaleString()}건. ${contactProgress > 0 ? '컨택진행 중 계약으로 이어진 비율입니다.' : '컨택진행 기록이 없어 아직 계산할 수 없습니다.'}`} />
              <span className="ml-1 rounded bg-indigo-200/70 px-1.5 py-0.5 text-px-11 font-medium text-indigo-800">
                종합
              </span>
            </div>
            <span
              className="text-base font-bold text-purple-700"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {contactProgress > 0 ? <CountUp value={salesProductivity} play={play} decimals={1} format={pctText} /> : <span aria-label="계산할 기록 없음">—</span>}
            </span>
          </div>
          <p className="mb-1 text-right text-px-11 tabular-nums text-indigo-800">{contract.toLocaleString()} / {contactProgress.toLocaleString()}건</p>
          <div className="h-1.5 w-full rounded-full bg-indigo-100/60">
            <div
              className={`h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 ${play ? "fx-grow-x" : ""}`}
              style={{ width: `${Math.max(0, Math.min(100, salesProductivity))}%`, animationDelay: "480ms" }}
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
  play,
  order,
  numerator,
  denominator,
}: {
  play: boolean;
  order: number;
  label: string;
  formula: string;
  value: number;
  barCls: string;
  pctCls: string;
  numerator: number;
  denominator: number;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-1 text-px-11">
          <span className="whitespace-nowrap text-px-12 font-semibold text-gray-700">{label}</span>
        </div>
        <span
          className={`text-sm font-bold ${pctCls}`}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {denominator > 0 ? <CountUp value={value} play={play} decimals={1} format={pctText} /> : <span aria-label="계산할 기록 없음">—</span>}
        </span>
      </div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-1 text-px-11 text-slate-600">
        <span>{formula}</span><span className="tabular-nums">{numerator.toLocaleString()} / {denominator.toLocaleString()}건</span>
      </div>
      <div className="h-1 w-full rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${barCls} ${play ? "fx-grow-x" : ""}`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%`, animationDelay: `${order * 120}ms` }}
        />
      </div>
    </div>
  );
}
