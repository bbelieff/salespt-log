/**
 * SummaryBar — 주간 요약 (5 카운터 + 매출 합계 — 한 row 통합, 2026-05-17 [A2]).
 *
 * v5 (2026-05-17): 5 counters + 매출 합계를 1 row 로 통합.
 *   [미팅총건][예정][완료][취소][계약]  💰 ₩X (수임+수수료)
 *
 * sticky 제거 (부모 schedule/page.tsx가 WeekHeader와 묶어 sticky 처리).
 * "변경" 상태 미팅도 미팅예정에 포함 (재예약된 미팅도 진행 예정).
 * SSOT: docs/domains/sheet-structure.md §4 v2 (수수료 = Q+W+AC = 슬롯별 수납액)
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
  const reserved = meetings.filter(
    (m) => m.상태 === "예약" || m.상태 === "변경",
  ).length;
  const contract = meetings.filter((m) => m.상태 === "계약").length;
  const done = meetings.filter((m) => m.상태 === "완료").length;
  const canceled = meetings.filter((m) => m.상태 === "취소").length;

  const feeSum = meetings
    .filter((m) => m.계약여부)
    .reduce((s, m) => s + (m.수임비 || 0), 0);

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
    <div className="border-y border-gray-200 bg-white shadow-sm">
      {/* 단일 row — 5 카운터 + 매출. 모바일 좁을 시 flex-wrap. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-2">
        <Counter label="총건" value={total} cls="text-gray-900" />
        <Counter label="예정" value={reserved} cls="text-amber-600" />
        <Divider />
        <Counter label="완료" value={done} cls="text-orange-600" />
        <Counter label="취소" value={canceled} cls="text-red-500" />
        <Counter label="계약" value={contract} cls="text-green-700" highlight />
        <RevenueChip
          revenueSum={revenueSum}
          feeSum={feeSum}
          commissionSum={commissionSum}
        />
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
  const baseCls = highlight
    ? "rounded-md bg-green-100 ring-1 ring-green-300 px-1.5"
    : "";
  return (
    <span
      className={`inline-flex items-baseline gap-1 px-1 ${baseCls}`}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      <span className={`text-base font-extrabold leading-none ${cls}`}>
        {value}
      </span>
      <span className={`text-[10px] ${highlight ? "font-bold text-green-700" : "text-gray-500"}`}>
        {label}
      </span>
    </span>
  );
}

function Divider() {
  return <span className="h-4 w-px bg-gray-300" />;
}

function RevenueChip({
  revenueSum,
  feeSum,
  commissionSum,
}: {
  revenueSum: number;
  feeSum: number;
  commissionSum: number;
}) {
  return (
    <span
      className="ml-auto inline-flex flex-wrap items-baseline gap-x-1.5 rounded-md bg-green-50 px-2 py-0.5 text-xs ring-1 ring-green-200"
      style={{ fontVariantNumeric: "tabular-nums" }}
      title={`수임비 ₩${fmtMoney(feeSum)} + 수수료 ₩${fmtMoney(commissionSum)}`}
    >
      <span className="font-semibold text-green-700">💰</span>
      <span className="text-sm font-extrabold text-green-700">
        ₩{fmtMoney(revenueSum)}
      </span>
      <span className="text-[10px] text-gray-500">
        (수임 ₩{fmtMoney(feeSum)} + 수수료 ₩{fmtMoney(commissionSum)})
      </span>
    </span>
  );
}
