"use client";

import { formatMoney } from "@/lib/format/money";
import type { ExpenseLedgerView } from "@/types";

interface Props {
  data?: ExpenseLedgerView;
  loading: boolean;
  error?: Error | null;
}

export default function ExpenseLedgerTable({ data, loading, error }: Props) {
  if (loading) return <p className="py-6 text-center text-xs text-gray-400">비용 내역을 불러오는 중입니다.</p>;
  if (error) return <p role="alert" className="rounded-md bg-red-50 p-3 text-xs text-red-700">비용 내역을 불러오지 못했습니다: {error.message}</p>;
  if (!data) return null;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-gray-500">
            <tr><th className="px-3 py-2 font-medium">카테고리 · 품목</th><th className="px-3 py-2 font-medium">기간</th><th className="px-3 py-2 text-right font-medium">인식 비용</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {data.entries.length === 0 ? (
              <tr><td colSpan={3} className="px-3 py-7 text-center text-gray-400">해당 조건의 비용이 없습니다.</td></tr>
            ) : data.entries.map((entry) => (
              <tr key={`${entry.source}-${entry.id}-${entry.periodStart}`}>
                <td className="px-3 py-2"><p className="font-medium text-gray-800">{entry.itemName}</p><p className="mt-0.5 text-gray-400">{entry.categoryName}{entry.source === "recurring" ? " · 반복" : ""}</p></td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-500">{entry.periodStart}{entry.periodStart === entry.periodEnd ? "" : ` ~ ${entry.periodEnd}`}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-gray-800">₩{formatMoney(entry.amountWon)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg bg-slate-50 px-3 py-2.5">
        <div className="space-y-1 text-xs text-gray-600">
          {data.categoryTotals.map((row) => <div key={row.categoryId} className="flex justify-between gap-3"><span>{row.categoryName}</span><span className="font-medium">₩{formatMoney(row.amountWon)}</span></div>)}
        </div>
        <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 text-sm font-bold text-gray-900"><span>추가 비용 합계</span><span>₩{formatMoney(data.additionalCostTotal)}</span></div>
      </div>
    </div>
  );
}
