"use client";

import { formatMoney } from "@/lib/format/money";
import type { ExpenseLedgerView } from "@/types";
import type { ExpenseViewMode } from "@/query/expense-ledger-hooks";

export type ExpenseLedgerR5Entry = ExpenseLedgerView["entries"][number];
export type ExpenseLedgerR5View = ExpenseLedgerView;

type R5Source = ExpenseLedgerR5Entry["source"];
type RecognitionStatus = ExpenseLedgerR5Entry["recognitionStatus"];

interface Props {
  data?: ExpenseLedgerR5View;
  loading: boolean;
  error?: Error | null;
  retrying?: boolean;
  mode: ExpenseViewMode;
  onRetry?: () => void;
  onOpenManage: () => void;
}

const sourceLabels: Record<R5Source, string> = {
  one_time: "일회성",
  recurring: "반복",
  db_purchase: "매입DB",
  db_production: "직접생산",
  db_banner: "현수막",
};

const recognitionLabels: Record<RecognitionStatus, string> = {
  allocated: "기간 일할",
  recognized_on_date: "해당일 인식",
  recognized_on_start: "시작일 인식",
  unallocated: "미배분",
};

function safeLedgerError(error: Error) {
  if (/\b401\b|unauthenticated|로그인/i.test(error.message)) return "로그인이 만료되어 비용 내역을 불러오지 못했습니다. 다시 로그인한 뒤 시도해 주세요.";
  if (/\b403\b|forbidden|권한/i.test(error.message)) return "비용 내역을 볼 권한이 없습니다. 관리자에게 권한을 요청해 주세요.";
  return "비용 내역을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

function formatShare(value: number) {
  return Number.isFinite(value) ? value.toFixed(1).replace(/\.0$/, "") : "0";
}

function ScopeFooter({ data }: { data: ExpenseLedgerR5View }) {
  return (
    <div aria-label={`${data.selectedScope.label} 비용 합계`} className="rounded-xl bg-slate-100 px-3 py-3 text-xs text-gray-600">
      <div className="flex justify-between gap-3"><span>DB 비용</span><strong className="text-gray-900">₩{formatMoney(data.dbCostTotal)}</strong></div>
      <div className="mt-1.5 flex justify-between gap-3"><span>추가 비용</span><strong className="text-gray-900">₩{formatMoney(data.additionalCostTotal)}</strong></div>
      <div className="mt-2 flex justify-between gap-3 border-t border-gray-300 pt-2 text-sm font-black text-gray-900"><span>총비용</span><span>₩{formatMoney(data.totalCost)}</span></div>
    </div>
  );
}

function RetryPanel({ message, retrying, onRetry }: { message: string; retrying?: boolean; onRetry?: () => void }) {
  return <div role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700"><p>{message}</p>{onRetry && <button type="button" disabled={retrying} onClick={onRetry} className="mt-3 min-h-11 rounded-lg border border-red-200 bg-white px-4 font-bold disabled:opacity-50">{retrying ? "다시 불러오는 중…" : "다시 시도"}</button>}</div>;
}

export default function ExpenseLedgerTable({ data, loading, error, retrying, mode, onRetry, onOpenManage }: Props) {
  if (loading || (!data && !error)) return <p role="status" className="py-8 text-center text-xs text-gray-400">비용 내역을 불러오는 중입니다.</p>;
  if (error) return <RetryPanel message={safeLedgerError(error)} retrying={retrying} onRetry={onRetry} />;
  if (!data) return null;
  if (mode === "category") return <CategorySummary data={data} />;
  const empty = data.totalCost === 0 && data.entries.length === 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-900"><span className="font-semibold">{data.selectedScope.label}</span><strong>총비용 ₩{formatMoney(data.totalCost)}</strong></div>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {empty ? <p className="px-3 py-8 text-center text-xs text-gray-400">해당 조건의 비용이 없습니다.</p> : data.entries.length === 0 ? (
          <div className="p-4"><RetryPanel message="합계가 있지만 표시할 비용 항목을 불러오지 못했습니다. 다시 시도해 주세요." retrying={retrying} onRetry={onRetry} /></div>
        ) : data.entries.map((entry) => <ExpenseRow key={entry.id} entry={entry} onOpenManage={onOpenManage} />)}
      </div>
      <ScopeFooter data={data} />
    </div>
  );
}

function ExpenseRow({ entry, onOpenManage }: { entry: ExpenseLedgerR5Entry; onOpenManage: () => void }) {
  const systemReadOnly = entry.system || entry.readOnly;
  const period = entry.periodStart ? entry.periodStart === entry.periodEnd || !entry.periodEnd ? entry.periodStart : `${entry.periodStart} ~ ${entry.periodEnd}` : "인식일 미지정";
  return (
    <details className="group border-b border-gray-100 last:border-b-0">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-3 py-2.5 marker:hidden">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-gray-900">{entry.itemName}</span>
          <span className="mt-0.5 block text-xs text-gray-500">{entry.categoryName || "미분류"} · {systemReadOnly ? "시스템 · 자동 집계 · 읽기 전용" : sourceLabels[entry.source]}</span>
        </span>
        <span className="text-right"><strong className="block whitespace-nowrap text-sm text-gray-900">₩{formatMoney(entry.amountWon)}</strong><span className="text-xs font-semibold text-blue-600 group-open:hidden">{systemReadOnly ? "상세" : "상세·관리"}</span><span className="hidden text-xs font-semibold text-blue-600 group-open:inline">접기</span></span>
      </summary>
      <div className="bg-slate-50 px-3 py-3 text-xs text-gray-600">
        <div className="flex justify-between gap-3"><span>인식 기간</span><strong className="text-right text-gray-800">{period}</strong></div>
        <div className="mt-1 flex justify-between gap-3"><span>인식 방식</span><strong className="text-gray-800">{recognitionLabels[entry.recognitionStatus]}</strong></div>
        {entry.recognitionNote && <p className="mt-2 rounded-lg bg-white p-2 text-gray-500">{entry.recognitionNote}</p>}
        {systemReadOnly ? <p className="mt-2 rounded-lg bg-white p-2 font-semibold text-gray-500">{sourceLabels[entry.source]} 원본 자동 집계 행이며 읽기 전용입니다.</p> : entry.source === "recurring" ? (
          <button type="button" onClick={onOpenManage} className="mt-3 min-h-11 w-full rounded-lg border border-gray-200 bg-white font-bold text-gray-700">반복 규칙 관리로 이동</button>
        ) : <p className="mt-2 text-gray-400">이 비용은 추가 비용 기록으로 관리합니다.</p>}
      </div>
    </details>
  );
}

function CategorySummary({ data }: { data: ExpenseLedgerR5View }) {
  const rows = [...data.categoryTotals].sort((a, b) => b.amountWon - a.amountWon || a.categoryName.localeCompare(b.categoryName, "ko"));
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-3 py-3"><div><h4 className="text-sm font-black text-gray-900">카테고리 전체 범위</h4><p className="text-xs text-gray-400">시스템·사용자·미분류·보관 포함</p></div><strong className="text-sm text-gray-900">₩{formatMoney(data.totalCost)}</strong></div>
        <table className="w-full min-w-[340px] table-auto text-left text-xs">
          <caption className="sr-only">{data.selectedScope.label} 총비용 ₩{formatMoney(data.totalCost)}</caption>
          <thead className="bg-slate-50 text-gray-500"><tr><th className="px-3 py-2 font-semibold">카테고리</th><th className="px-1 py-2 text-right font-semibold">비중</th><th className="px-1 py-2 text-right font-semibold">항목 수</th><th className="px-3 py-2 text-right font-semibold">총비용</th></tr></thead>
          <tbody className="divide-y divide-gray-100">{rows.map((row) => <tr key={row.categoryId}><td className="px-3 py-2.5 font-semibold text-gray-800">{row.categoryName || "미분류"}{row.system ? <span className="ml-1 text-xs font-normal text-blue-600">시스템</span> : row.archived ? <span className="ml-1 text-xs font-normal text-gray-400">보관</span> : null}</td><td className="px-1 py-2.5 text-right text-gray-500">{formatShare(row.sharePercent)}%</td><td className="px-1 py-2.5 text-right text-gray-500">{row.itemCount}건</td><td className="whitespace-nowrap px-3 py-2.5 text-right font-bold text-gray-900">₩{formatMoney(row.amountWon)}</td></tr>)}</tbody>
        </table>
      </div>
      <ScopeFooter data={data} />
    </div>
  );
}
