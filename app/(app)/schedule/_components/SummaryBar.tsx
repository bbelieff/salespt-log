/**
 * SummaryBar — 주간 요약 (총건/예약/완료/취소/수임비합계).
 * 정본: docs/design/prototypes/schedule-weekly.html (sum-* IDs)
 */
"use client";

import type { Meeting } from "@/types";

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
  const fee = meetings
    .filter((m) => m.계약여부)
    .reduce((s, m) => s + (m.수임비 || 0), 0);

  return (
    <div className="mx-4 mb-3 rounded-2xl bg-white p-3 shadow-sm">
      <div className="grid grid-cols-5 gap-1 text-center">
        <Cell label="총건" value={total} cls="text-gray-900" />
        <Cell label="예약" value={reserved} cls="text-amber-600" />
        <Cell label="계약" value={contract} cls="text-green-700" />
        <Cell label="완료" value={done} cls="text-orange-600" />
        <Cell label="취소" value={canceled} cls="text-red-500" />
      </div>
      <div className="mt-2.5 flex items-center justify-between rounded-xl bg-green-50 px-3 py-2 text-sm">
        <span className="font-semibold text-green-800">💰 수임비 합계</span>
        <span className="text-base font-bold text-green-700">
          {fmtMoney(fee)}만원
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
