/**
 * SummaryBar — 주간 요약 (총건/예약/완료/취소/매출 합계).
 * 정본: docs/design/prototypes/schedule-weekly.html (sum-* IDs)
 *
 * v2: 수임비 합계 → 주간 매출 합계 (수임비 + 수수료)
 *   - 수임비: 미팅의 계약 확정 시점 입력값 (Meeting.수임비)
 *   - 수수료: 02 계약수납관리의 슬롯별 수납액 합 (Q+W+AC)
 *   - SSOT: docs/domains/sheet-structure.md §4 v2
 *
 * Layout: rounded square → 양옆 풀 width 배너
 */
"use client";

import { useMemo } from "react";
import type { Meeting } from "@/types";
import { useContractPayments } from "@/query/contract-payment-hooks";

interface Props {
  meetings: Meeting[];
}

function fmtMoney(n: number): string {
  return n.toLocaleString("ko-KR");
}

export default function SummaryBar({ meetings }: Props) {
  const total = meetings.length;
  const reserved = meetings.filter((m) => m.상태 === "예약").length;
  const contract = meetings.filter((m) => m.상태 === "계약").length;
  const done = meetings.filter((m) => m.상태 === "완료").length;
  const canceled = meetings.filter((m) => m.상태 === "취소").length;

  // 수임비 합 — 이번 주 계약 확정된 미팅
  const feeSum = meetings
    .filter((m) => m.계약여부)
    .reduce((s, m) => s + (m.수임비 || 0), 0);

  // 수수료 합 — 02 계약수납관리의 슬롯별 수납액 합. 이번 주 계약된 미팅의
  // 업체명+계약일과 매칭되는 row만 합산.
  const cpQuery = useContractPayments();
  const commissionSum = useMemo(() => {
    const rows = cpQuery.data?.rows ?? [];
    const weekContractKeys = new Set(
      meetings
        .filter((m) => m.계약여부)
        .map((m) => `${m.미팅날짜}|${m.업체명.trim()}`),
    );
    return rows
      .filter((cp) =>
        weekContractKeys.has(`${cp.계약일}|${cp.업체명.trim()}`),
      )
      .reduce(
        (s, cp) => s + cp.수납1.수납액 + cp.수납2.수납액 + cp.수납3.수납액,
        0,
      );
  }, [cpQuery.data, meetings]);

  const revenueSum = feeSum + commissionSum;

  return (
    <div className="mb-3 border-y border-green-100 bg-green-50">
      {/* 5칸 카운터 */}
      <div className="grid grid-cols-5 gap-1 px-4 pb-2 pt-3 text-center">
        <Cell label="총건" value={total} cls="text-gray-900" />
        <Cell label="예약" value={reserved} cls="text-amber-600" />
        <Cell label="계약" value={contract} cls="text-green-700" />
        <Cell label="완료" value={done} cls="text-orange-600" />
        <Cell label="취소" value={canceled} cls="text-red-500" />
      </div>
      {/* 매출 풀-width 배너 (양옆 다 채움) */}
      <div className="flex items-center justify-between border-t border-green-100 bg-green-100/50 px-4 py-2 text-sm">
        <span className="font-semibold text-green-800">💰 주간 매출 합계</span>
        <span
          className="text-base font-bold text-green-700"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          ₩{fmtMoney(revenueSum)}
        </span>
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  cls,
}: {
  label: string;
  value: number;
  cls: string;
}) {
  return (
    <div>
      <div className={`text-lg font-bold leading-tight ${cls}`}>{value}</div>
      <div className="text-[11px] text-gray-500">{label}</div>
    </div>
  );
}
