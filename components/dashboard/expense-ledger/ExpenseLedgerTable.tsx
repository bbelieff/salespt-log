"use client";

import { formatMoney } from "@/lib/format/money";
import type { ExpenseLedgerView } from "@/types";
import type { ExpenseViewMode } from "@/query/expense-ledger-hooks";

interface Props {
  data?: ExpenseLedgerView;
  loading: boolean;
  error?: Error | null;
  mode: ExpenseViewMode;
  onOpenRecord: () => void;
}

interface CategorySummaryRow {
  id: string;
  name: string;
  archived: boolean;
  amountWon: number;
  itemCount: number;
}

function categoryRows(data: ExpenseLedgerView): CategorySummaryRow[] {
  const rows = new Map<string, CategorySummaryRow>();
  let unclassifiedId = "__unclassified__";
  for (const category of data.categories) {
    const isUnclassified = category.name.trim() === "미분류";
    if (isUnclassified) unclassifiedId = category.id;
    rows.set(category.id, { id: category.id, name: category.name, archived: Boolean(category.archivedAt), amountWon: 0, itemCount: 0 });
  }
  if (!rows.has(unclassifiedId)) rows.set(unclassifiedId, { id: unclassifiedId, name: "미분류", archived: false, amountWon: 0, itemCount: 0 });

  for (const entry of data.entries) {
    const id = rows.has(entry.categoryId) && entry.categoryName.trim() ? entry.categoryId : unclassifiedId;
    const row = rows.get(id);
    if (!row) continue;
    row.amountWon += entry.amountWon;
    row.itemCount += 1;
  }
  return [...rows.values()].sort((a, b) => b.amountWon - a.amountWon || a.name.localeCompare(b.name, "ko"));
}

function share(amountWon: number, total: number): string {
  if (total < 1) return "0%";
  return `${(amountWon / total * 100).toFixed(1).replace(".0", "")}%`;
}

export default function ExpenseLedgerTable({ data, loading, error, mode, onOpenRecord }: Props) {
  if (loading) return <p className="py-8 text-center text-xs text-gray-400">비용 내역을 불러오는 중입니다.</p>;
  if (error) return <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">비용 내역을 불러오지 못했습니다: {error.message}</p>;
  if (!data) return null;
  if (mode === "category") return <CategorySummary data={data} />;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {data.entries.length === 0 ? <p className="px-3 py-8 text-center text-xs text-gray-400">해당 조건의 비용이 없습니다.</p> : data.entries.map((entry) => (
          <details key={`${entry.source}-${entry.id}-${entry.periodStart}`} className="group border-b border-gray-100 last:border-b-0">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-3 py-2.5 marker:hidden">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-gray-900">{entry.itemName}</span>
                <span className="mt-0.5 block text-xs text-gray-500">{entry.categoryName || "미분류"} · {entry.source === "recurring" ? "반복" : "일회성"}</span>
              </span>
              <span className="text-right">
                <strong className="block whitespace-nowrap text-sm text-gray-900">₩{formatMoney(entry.amountWon)}</strong>
                <span className="text-xs font-semibold text-blue-600 group-open:hidden">상세·관리</span>
                <span className="hidden text-xs font-semibold text-blue-600 group-open:inline">접기</span>
              </span>
            </summary>
            <div className="bg-slate-50 px-3 py-3 text-xs text-gray-600">
              <div className="flex justify-between gap-3"><span>인식 기간</span><strong className="text-gray-800">{entry.periodStart}{entry.periodStart === entry.periodEnd ? "" : ` ~ ${entry.periodEnd}`}</strong></div>
              <div className="mt-1 flex justify-between gap-3"><span>발생 방식</span><strong className="text-gray-800">{entry.source === "recurring" ? "매월 반복 발생" : "일회성 비용"}</strong></div>
              {entry.source === "recurring" ? (
                <button type="button" onClick={onOpenRecord} className="mt-3 min-h-11 w-full rounded-lg border border-gray-200 bg-white font-bold text-gray-700">기록 화면의 반복 규칙으로 이동</button>
              ) : <p className="mt-2 text-xs text-gray-400">수정 범위를 확인한 뒤 안전하게 관리할 수 있도록 행 안에서 상세를 유지합니다.</p>}
            </div>
          </details>
        ))}
      </div>

      <div className="rounded-xl bg-slate-100 px-3 py-3">
        <div className="space-y-1.5 text-xs text-gray-600">
          {data.categoryTotals.map((row) => <div key={row.categoryId} className="flex justify-between gap-3"><span>{row.categoryName || "미분류"}</span><span className="font-semibold">₩{formatMoney(row.amountWon)}</span></div>)}
        </div>
        <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 text-sm font-black text-gray-900"><span>추가 비용 합계</span><span>₩{formatMoney(data.additionalCostTotal)}</span></div>
      </div>
    </div>
  );
}

function CategorySummary({ data }: { data: ExpenseLedgerView }) {
  const rows = categoryRows(data);
  const total = rows.reduce((sum, row) => sum + row.amountWon, 0);
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-3 py-3">
        <div><h4 className="text-sm font-black text-gray-900">카테고리 전체 범위</h4><p className="text-xs text-gray-400">비용 내림차순 · 보관/미분류 포함</p></div>
        <strong className="text-sm text-gray-900">₩{formatMoney(total)}</strong>
      </div>
      <table className="w-full table-auto text-left text-xs">
        <thead className="bg-slate-50 text-gray-500"><tr><th className="px-3 py-2 font-semibold">카테고리</th><th className="px-1 py-2 text-right font-semibold">비중</th><th className="px-1 py-2 text-right font-semibold">항목 수</th><th className="px-3 py-2 text-right font-semibold">총비용</th></tr></thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => <tr key={row.id}><td className="truncate px-3 py-2.5 font-semibold text-gray-800">{row.name}{row.archived ? <span className="ml-1 text-xs font-normal text-gray-400">보관</span> : null}</td><td className="px-1 py-2.5 text-right text-gray-500">{share(row.amountWon, total)}</td><td className="px-1 py-2.5 text-right text-gray-500">{row.itemCount}건</td><td className="whitespace-nowrap px-3 py-2.5 text-right font-bold text-gray-900">₩{formatMoney(row.amountWon)}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}
