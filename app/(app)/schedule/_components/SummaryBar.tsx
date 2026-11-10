/**
 * SummaryBar — 주간 요약 (5 카운터 + 매출 합계 — 한 row 통합, 2026-05-17 [A2]).
 *
 * v5 (2026-05-17): 5 counters + 매출 합계를 1 row 로 통합.
 *   [미팅총건][예정][완료][취소][계약]  💰 X원 (수임+수수료)
 *
 * sticky 제거 (부모 schedule/page.tsx가 WeekHeader와 묶어 sticky 처리).
 * "변경" 상태 미팅도 미팅예정에 포함 (재예약된 미팅도 진행 예정).
 * SSOT: docs/domains/sheet-structure.md §4 v2 (수수료 = Q+W+AC = 슬롯별 수납액)
 */
"use client";

import { contractRef } from "@/util/contract-ref";
import { useMemo, type ReactNode } from "react";
import { isTerminatedContract } from "@/types";
import type { Meeting } from "@/types";
import { useContractPayments } from "@/query/contract-payment-hooks";
import { formatWon } from "@/lib/format/money";
import { slotTotals } from "@/lib/analytics/contract-slots";

interface Props {
  meetings: Meeting[];
  goalSummary?: ReactNode;
}

/** 공용 부품 별칭 — 중복 구현 제거(PR-1 lib/format/money 가 단일 원천). */

export default function SummaryBar({ meetings, goalSummary }: Props) {
  const total = meetings.length;
  const reserved = meetings.filter(
    (m) => m.상태 === "예약" || m.상태 === "변경",
  ).length;
  const done = meetings.filter((m) => m.상태 === "완료").length;
  const canceled = meetings.filter((m) => m.상태 === "취소").length;

  // "이번 주 계약" = 이번 주 계약 수임비 + 그 계약의 수납액(2026-10-15 D7 — 기간 매출과 구분해 이름을 바꿈).
// 이월(arena-carryover §4) 계약은 제외 — 아레나 점수 비합산. 기간 매출은 대시보드·실무수납(ADR-0034).
  const feeSum = meetings
    .filter((m) => m.계약여부 && m.구분 !== "이월")
    .reduce((s, m) => s + (m.수임비 || 0), 0);

  const cpQuery = useContractPayments();
  // 해지 계약(02 AL 해지일)은 '계약' 카운터에서 제외 — 대시보드·아레나와 통일.
  // 조인 = commissionSum 과 동일 키(미팅날짜=계약일 | 업체명).
  const contract = useMemo(() => {
    const rows = cpQuery.data?.rows ?? [];
    const terminatedKeys = new Set(
      rows
        .filter(isTerminatedContract)
        .map((cp) => contractRef(cp.계약일, cp.업체명)),
    );
    return meetings.filter(
      (m) =>
        m.상태 === "계약" &&
        !terminatedKeys.has(contractRef(m.미팅날짜, m.업체명)),
    ).length;
  }, [cpQuery.data, meetings]);
  const commissionSum = useMemo(() => {
    const rows = cpQuery.data?.rows ?? [];
    const weekContractKeys = new Set(
      meetings
        .filter((m) => m.계약여부 && m.구분 !== "이월")
        .map((m) => contractRef(m.미팅날짜, m.업체명)),
    );
    return rows
      .filter((cp) =>
        weekContractKeys.has(contractRef(cp.계약일, cp.업체명)),
      )
      .reduce(
        (s, cp) => s + slotTotals(cp).received,
        0,
      );
  }, [cpQuery.data, meetings]);

  const revenueSum = feeSum + commissionSum;

  return (
    <div className="px-3 pb-2.5">
      {/* 2026-05-17 [5] 재정돈: row 1 = 5 카운터 균등, row 2 = 매출 (정신없는 wrap 회피).
          화면 마감 v2(2026-11-10): 요약 한 칸 = .surface-hero, 숫자 칸은 상자 대신 세로 선(.stat-split). */}
      <div className="surface-hero px-3 py-2.5">
        <div className="stat-split grid grid-cols-5">
          <Counter label="총건" value={total} cls="text-slate-900" />
          <Counter label="예정" value={reserved} cls="text-amber-600" />
          <Counter label="완료" value={done} cls="text-orange-600" />
          <Counter label="취소" value={canceled} cls="text-red-500" />
          <Counter label="계약" value={contract} cls="text-green-700" highlight />
        </div>
        {revenueSum > 0 && (
          <div className="mt-2 flex items-baseline justify-end gap-2 border-t border-slate-200/70 pt-2 text-xs">
            <span className="font-medium text-green-700">💰 이번 주 계약</span>
            <span
              className="text-sm font-extrabold text-green-700"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatWon(revenueSum)}
            </span>
            <span
              className="text-px-10 text-slate-500"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              수임 {formatWon(feeSum)} · 수수료 {formatWon(commissionSum)}
            </span>
          </div>
        )}
        {goalSummary && <div className="mt-1.5 border-t border-slate-200/70">{goalSummary}</div>}
      </div>
    </div>
  );
}

function Counter({
  label,
  value,
  cls,
  highlight,
}: {
  label: string;
  value: number;
  cls: string;
  highlight?: boolean;
}) {
  // 화면 마감 v2: 칸마다 상자 없음 — 계약 강조는 색 글자로만.
  return (
    <div
      className="flex flex-col items-center py-1"
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      <span className={`text-lg font-extrabold leading-none ${cls}`}>
        {value}
      </span>
      <span
        className={`mt-0.5 text-px-10 ${highlight ? "font-bold text-green-700" : "text-slate-500"}`}
      >
        {label}
      </span>
    </div>
  );
}
