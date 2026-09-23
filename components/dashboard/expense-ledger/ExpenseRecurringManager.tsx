/**
 * Scope B — 반복 비용 관리 목록 (ExpenseLedgerDialog 에서 분리, 500줄 캡).
 * 일시중지·재개·건너뛰기·다음달 적용·종료는 모두 명시적 액션으로 유지한다.
 * 일회성 자동 기록과 무관 — 이 파일의 어떤 것도 자동 전송하지 않는다.
 */
"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format/money";
import type { ManagedRecurringRule } from "@/query/expense-ledger-hooks";

export function safeRecurringDeleteMessage(error: unknown) {
  const detail = error instanceof Error ? error.message : "";
  if (/\b401\b|로그인|인증|unauthenticated/i.test(detail)) {
    return "로그인이 만료되어 반복 비용을 종료하지 못했습니다. 다시 로그인한 뒤 다시 시도해 주세요.";
  }
  if (/\b403\b|권한|forbidden/i.test(detail)) {
    return "반복 비용을 종료할 권한이 없습니다. 관리자에게 권한을 요청해 주세요.";
  }
  return "반복 비용을 종료하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

interface QueryStateProps {
  loading: boolean;
  loaded: boolean;
  errorMessage: string | null;
  retrying: boolean;
  onRetry: () => void;
}

function QueryStatePanel({ message, error = false, retrying = false, onRetry }: { message: string; error?: boolean; retrying?: boolean; onRetry?: () => void }) {
  return (
    <div role={error ? "alert" : "status"} className={`rounded-xl border p-4 text-sm ${error ? "border-red-100 bg-red-50 text-red-800" : "border-gray-200 bg-white text-gray-600"}`}>
      <p className="font-semibold">{message}</p>
      {onRetry && <button type="button" disabled={retrying} onClick={onRetry} className="mt-3 min-h-11 rounded-lg border border-current bg-white px-4 text-xs font-bold disabled:opacity-50">{retrying ? "다시 불러오는 중…" : "다시 시도"}</button>}
    </div>
  );
}

export function RecurringRuleManager({
  rules,
  loading,
  loaded,
  errorMessage,
  retrying,
  onRetry,
  month,
  amountWon,
  onPause,
  onResume,
  onSkip,
  onFutureAmount,
  onDelete,
}: QueryStateProps & { rules: ManagedRecurringRule[]; month: string; amountWon: number; onPause: (id: string) => void; onResume: (id: string) => void; onSkip: (id: string) => void; onFutureAmount: (id: string) => void; onDelete: (id: string) => Promise<void> }) {
  const count = loading || (!loaded && !errorMessage) ? "불러오는 중" : errorMessage ? "확인 필요" : `${rules.length}건`;
  let content;
  if (loading || (!loaded && !errorMessage)) {
    content = <QueryStatePanel message="반복 비용을 불러오고 있습니다." />;
  } else if (errorMessage) {
    content = <QueryStatePanel message={errorMessage} error retrying={retrying} onRetry={onRetry} />;
  } else if (rules.length === 0) {
    content = <p className="p-6 text-center text-xs text-gray-400">등록된 반복 비용이 없습니다.</p>;
  } else {
    content = rules.map((rule) => (
      <RecurringRuleRow key={rule.id} rule={rule} month={month} amountWon={amountWon} onPause={onPause} onResume={onResume} onSkip={onSkip} onFutureAmount={onFutureAmount} onDelete={onDelete} />
    ));
  }
  return <div><div className="mb-2 flex items-end justify-between"><div><h3 className="text-sm font-black text-gray-900">반복 비용</h3><p className="text-xs text-gray-500">목록 행을 펼쳐 상태와 다음 작업을 관리합니다.</p></div><span className="text-xs font-bold text-gray-500">{count}</span></div><div className="overflow-hidden rounded-xl border border-gray-200 bg-white">{content}</div></div>;
}

type RecurringRuleRowProps = { rule: ManagedRecurringRule; month: string; amountWon: number; onPause: (id: string) => void; onResume: (id: string) => void; onSkip: (id: string) => void; onFutureAmount: (id: string) => void; onDelete: (id: string) => Promise<void> };

function RecurringRuleRow({ rule, month, amountWon, onPause, onResume, onSkip, onFutureAmount, onDelete }: RecurringRuleRowProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function deleteRule() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(rule.id);
      setConfirmingDelete(false);
    } catch (error) {
      setDeleteError(safeRecurringDeleteMessage(error));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <details className="group border-b border-gray-100 last:border-b-0">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 marker:hidden">
        <span className="min-w-0"><strong className="block truncate text-sm text-gray-900">{rule.itemName}</strong><span className="text-xs text-gray-500">{rule.categoryName} · ₩{formatMoney(rule.amountWon)}</span></span>
        <span className="shrink-0 text-xs font-bold text-blue-600">{rule.status === "archived" ? "종료됨" : "상세·관리"}</span>
      </summary>
      <div className="bg-slate-50 p-3 text-xs text-gray-600">
        <p>상태 <strong className="text-gray-900">{rule.status}</strong></p>
        <p className="mt-1">이번 발생 <strong className="text-gray-900">{rule.currentOccurrence ? `${rule.currentOccurrence.occurrenceDate} (${rule.currentOccurrence.status})` : "없음"}</strong></p>
        {rule.nextOccurrence && <p className="mt-1">다음 발생 <strong className="text-gray-900">{rule.nextOccurrence.occurrenceDate}</strong></p>}
        {rule.status === "archived" ? (
          <p className="mt-3 rounded-lg bg-white p-3 font-semibold text-gray-500">종료·보관된 규칙은 다시 발생하지 않으며 작업할 수 없습니다. 과거 비용 기록은 그대로 유지됩니다.</p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" disabled={deleting} onClick={() => rule.status === "paused" ? onResume(rule.id) : onPause(rule.id)} className="min-h-11 rounded-lg border border-gray-200 bg-white font-bold disabled:opacity-40">{rule.status === "paused" ? "재개" : "일시 중지"}</button>
              <button type="button" disabled={deleting} onClick={() => onSkip(rule.id)} className="min-h-11 rounded-lg border border-gray-200 bg-white font-bold disabled:opacity-40">{month} 건너뛰기</button>
              <button type="button" disabled={deleting || amountWon < 1} onClick={() => onFutureAmount(rule.id)} className="col-span-2 min-h-11 rounded-lg border border-gray-200 bg-white font-bold disabled:opacity-40">기록 화면 금액을 다음 달부터 적용</button>
              <button type="button" disabled={deleting} onClick={() => { setConfirmingDelete(true); setDeleteError(null); }} className="col-span-2 min-h-11 rounded-lg border border-red-200 bg-white font-bold text-red-700 disabled:opacity-40">삭제/종료</button>
            </div>
            {confirmingDelete && (
              <div role="alertdialog" aria-label={`${rule.itemName} 반복 비용 삭제 또는 종료 확인`} className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-red-900">
                <p className="font-bold">이 반복 규칙을 종료할까요?</p>
                <p className="mt-1 leading-relaxed">앞으로의 비용 발생은 중단되지만 과거 비용 기록은 그대로 유지됩니다. 실제 데이터를 지우는 작업이 아니라 종료·보관 처리입니다.</p>
                {deleteError && <p role="alert" className="mt-2 rounded-lg bg-white p-2 font-semibold text-red-800">{deleteError}</p>}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" disabled={deleting} onClick={() => { setConfirmingDelete(false); setDeleteError(null); }} className="min-h-11 rounded-lg border border-gray-300 bg-white font-bold text-gray-700 disabled:opacity-40">취소</button>
                  <button type="button" disabled={deleting} onClick={() => { void deleteRule(); }} className="min-h-11 rounded-lg bg-red-600 px-2 font-bold text-white disabled:opacity-50">{deleting ? "종료 중…" : deleteError ? "종료 다시 시도" : "삭제/종료 확인"}</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </details>
  );
}
