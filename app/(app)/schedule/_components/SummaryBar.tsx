/**
 * SummaryBar — 주간 요약 (5칸 카운터 + 주간 매출 합계).
 *
 * v3:
 *  - sticky top — WeekHeader 아래에 고정 표시
 *  - 흰색 배경
 *  - 5칸 라벨: 미팅총건 / 미팅예정 / 미팅완료 / 미팅취소 / 계약(강조)
 *  - 매출 = 수임비 + 수수료 — 분리 표시
 *
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
  const reserved = meetings.filter((m) => m.상태 === "예약").length;
  const contract = meetings.filter((m) => m.상태 === "계약").length;
  const done = meetings.filter((m) => m.상태 === "완료").length;
  const canceled = meetings.filter((m) => m.상태 === "취소").length;

  // 수임비 합 — 이번 주 계약 확정된 미팅
  const feeSum = meetings
    .filter((m) => m.계약여부)
    .reduce((s, m) => s + (m.수임비 || 0), 0);

  // 수수료 합 — 02 계약수납관리의 슬롯별 수납액(Q+W+AC) 합.
  // 이번 주 계약 미팅과 (계약일+업체명) 매칭되는 row만 합산.
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
    // sticky top — WeekHeader(top-24, 약 116px 높이) 바로 아래.
    // top-[210px] = top-24(96) + WeekHeader height(~114).
    // z-20 으로 day section보다 위, WeekHeader(z-30)보다 아래.
    <div className="sticky top-[210px] z-20 mb-3 border-y border-gray-200 bg-white shadow-sm">
      {/* 5칸 카운터 — 미팅총건 / 미팅예정 / 미팅완료 / 미팅취소 / 계약(강조) */}
      <div className="grid grid-cols-5 gap-1 px-3 pb-2 pt-2.5 text-center">
        <Cell label="미팅총건" value={total} cls="text-gray-900" />
        <Cell label="미팅예정" value={reserved} cls="text-amber-600" />
        <Cell label="미팅완료" value={done} cls="text-orange-600" />
        <Cell label="미팅취소" value={canceled} cls="text-red-500" />
        <Cell
          label="계약"
          value={contract}
          cls="text-green-700"
          highlight
        />
      </div>
      {/* 주간 매출 — 수임비/수수료 분리 + 합계 */}
      <div className="border-t border-gray-100 px-4 py-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-gray-700">💰 주간 매출 합계</span>
          <span
            className="text-base font-extrabold text-green-700"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            ₩{fmtMoney(revenueSum)}
          </span>
        </div>
        <div
          className="mt-1 flex justify-end gap-3 text-[11px] text-gray-500"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          <span>
            수임비{" "}
            <b className="font-semibold text-gray-700">₩{fmtMoney(feeSum)}</b>
          </span>
          <span className="text-gray-300">+</span>
          <span>
            수수료{" "}
            <b className="font-semibold text-gray-700">
              ₩{fmtMoney(commissionSum)}
            </b>
          </span>
        </div>
      </div>
    </div>
  );
}

function Cell({
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
  if (highlight) {
    // 계약 강조 — 녹색 박스 + 굵은 폰트
    return (
      <div className="rounded-lg bg-green-100 py-0.5 ring-1 ring-green-300">
        <div className={`text-xl font-extrabold leading-tight ${cls}`}>
          {value}
        </div>
        <div className="text-[11px] font-bold text-green-700">{label}</div>
      </div>
    );
  }
  return (
    <div>
      <div className={`text-lg font-bold leading-tight ${cls}`}>{value}</div>
      <div className="text-[11px] text-gray-500">{label}</div>
    </div>
  );
}
