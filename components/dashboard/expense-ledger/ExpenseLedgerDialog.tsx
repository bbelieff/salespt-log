"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import MoneyInput from "@/components/ui/MoneyInput";
import { formatMoney } from "@/lib/format/money";
import { isValidISODate } from "@/lib/service/cohort-dates";
import {
  type ExpenseViewMode,
  type ManagedRecurringRule,
  useCreateCategory,
  useDeleteRecurringRule,
  useCreateExpense,
  useCreateRecurringRule,
  useExpenseCategories,
  useExpenseLedger,
  usePatchCategory,
  usePatchRecurringRule,
  useRecurringRules,
  useRecurringRuleAction,
} from "@/query/expense-ledger-hooks";
import type { ExpenseCategory } from "@/types";
import ExpenseCategoryPicker from "./ExpenseCategoryPicker";
import ExpenseLedgerTable, { type ExpenseLedgerR5View } from "./ExpenseLedgerTable";

interface Props {
  open: boolean;
  onClose: () => void;
  dbCostTotal: number;
  additionalCost: number | null;
}

type Workspace = "record" | "view" | "manage";
type CostKind = "one_time" | "recurring";

const fieldClass = "mt-1 min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none";
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const currentMonth = () => today().slice(0, 7);
const shiftMonth = (month: string, delta: number) => {
  const [year = 0, value = 1] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};
const isoDay = (value: string) => { const [year, month, day] = value.split("-").map(Number); return Date.UTC(year!, month! - 1, day!); };
const daysInclusive = (start: string, end: string) => isValidISODate(start) && isValidISODate(end) && end >= start ? Math.round((isoDay(end) - isoDay(start)) / 86_400_000) + 1 : null;

function occurrenceInMonth(month: string, anchorDay: number) {
  const [year = 0, value = 1] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, value, 0)).getUTCDate();
  return `${month}-${String(Math.min(anchorDay, lastDay)).padStart(2, "0")}`;
}

function firstRecurringOccurrence(startsOn: string, anchorDay: number) {
  if (!isValidISODate(startsOn) || !Number.isInteger(anchorDay) || anchorDay < 1 || anchorDay > 31) return null;
  const startMonth = startsOn.slice(0, 7);
  const inStartMonth = occurrenceInMonth(startMonth, anchorDay);
  return inStartMonth >= startsOn ? inStartMonth : occurrenceInMonth(shiftMonth(startMonth, 1), anchorDay);
}

function safeQueryMessage(resource: "카테고리" | "반복 비용", error: unknown) {
  const detail = error instanceof Error ? error.message : "";
  const object = resource === "카테고리" ? "카테고리를" : "반복 비용을";
  if (/\b401\b|로그인|인증/i.test(detail)) {
    return `로그인이 만료되어 ${object} 불러올 수 없습니다. 다시 로그인한 뒤 재시도해 주세요.`;
  }
  if (/\b403\b|권한|forbidden/i.test(detail)) {
    return `${object} 볼 권한이 없습니다. 관리자에게 권한을 요청해 주세요.`;
  }
  return `${object} 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.`;
}

function safeRecurringDeleteMessage(error: unknown) {
  const detail = error instanceof Error ? error.message : "";
  if (/\b401\b|로그인|인증|unauthenticated/i.test(detail)) {
    return "로그인이 만료되어 반복 비용을 종료하지 못했습니다. 다시 로그인한 뒤 다시 시도해 주세요.";
  }
  if (/\b403\b|권한|forbidden/i.test(detail)) {
    return "반복 비용을 종료할 권한이 없습니다. 관리자에게 권한을 요청해 주세요.";
  }
  return "반복 비용을 종료하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

export default function ExpenseLedgerDialog({ open, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [workspace, setWorkspace] = useState<Workspace>("record");
  const [view, setView] = useState<ExpenseViewMode>("month");
  const [month, setMonth] = useState(currentMonth);
  const [categoryId, setCategoryId] = useState("");
  const [itemName, setItemName] = useState("");
  const [amountWon, setAmountWon] = useState(0);
  const [kind, setKind] = useState<CostKind>("one_time");
  const [oneTimeRange, setOneTimeRange] = useState(false);
  const [oneTimeStart, setOneTimeStart] = useState(today);
  const [oneTimeEnd, setOneTimeEnd] = useState(today);
  const [recurringStart, setRecurringStart] = useState(today);
  const [recurringEnd, setRecurringEnd] = useState("");
  const [anchorDay, setAnchorDay] = useState(String(new Date().getDate()));
  const [message, setMessage] = useState<string | null>(null);

  const categories = useExpenseCategories();
  const ledger = useExpenseLedger(view === "category" ? "all" : view, month);
  const ledgerData = ledger.data as ExpenseLedgerR5View | undefined;
  const recurringRules = useRecurringRules();
  const createCategory = useCreateCategory();
  const deleteRecurring = useDeleteRecurringRule();
  const createExpense = useCreateExpense();
  const createRecurring = useCreateRecurringRule();
  const patchCategory = usePatchCategory();
  const patchRule = usePatchRecurringRule();
  const pauseRule = useRecurringRuleAction("pause");
  const resumeRule = useRecurringRuleAction("resume");
  const skipRule = useRecurringRuleAction("skip");

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  const oneTimeDateError = !isValidISODate(oneTimeStart) ? "발생일을 올바르게 입력해 주세요." : oneTimeRange && !isValidISODate(oneTimeEnd) ? "기간 종료일을 올바르게 입력해 주세요." : oneTimeRange && oneTimeEnd < oneTimeStart ? "종료일은 시작일보다 빠를 수 없습니다." : null;
  const recurringDateError = !isValidISODate(recurringStart) ? "반복 시작일을 올바르게 입력해 주세요." : recurringEnd && !isValidISODate(recurringEnd) ? "반복 종료일을 올바르게 입력해 주세요." : recurringEnd && recurringEnd < recurringStart ? "반복 종료일은 시작일보다 빠를 수 없습니다." : null;
  const allocation = useMemo(() => {
    if (oneTimeDateError) return null;
    const days = oneTimeRange ? daysInclusive(oneTimeStart, oneTimeEnd) : 1;
    if (days === null) return null;
    return { days, daily: Math.floor(amountWon / days), remainder: amountWon % days };
  }, [amountWon, oneTimeDateError, oneTimeEnd, oneTimeRange, oneTimeStart]);
  const firstOccurrence = useMemo(() => recurringDateError ? null : firstRecurringOccurrence(recurringStart, Number(anchorDay)), [anchorDay, recurringDateError, recurringStart]);
  const categoryList = categories.data ?? [];
  const categoryErrorMessage = categories.error ? safeQueryMessage("카테고리", categories.error) : null;
  const recurringErrorMessage = recurringRules.error ? safeQueryMessage("반복 비용", recurringRules.error) : null;
  const busy = createExpense.isPending || createRecurring.isPending || createCategory.isPending || patchCategory.isPending;

  async function addCategory(name: string): Promise<ExpenseCategory> {
    setMessage(null);
    try {
      const result = await createCategory.mutateAsync(name);
      setMessage(`카테고리 '${result.category.name}'을 추가했습니다.`);
      return result.category;
    } catch (error) {
      const text = error instanceof Error ? error.message : "카테고리를 추가하지 못했습니다.";
      setMessage(text);
      throw error;
    }
  }

  async function renameCategory(id: string, name: string) {
    setMessage(null);
    try {
      await patchCategory.mutateAsync({ id, name });
      setMessage(`카테고리 이름을 '${name}'으로 바꿨습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "카테고리 이름을 바꾸지 못했습니다.");
      throw error;
    }
  }

  async function archiveCategory(id: string) {
    setMessage(null);
    try {
      await patchCategory.mutateAsync({ id, archived: true });
      if (categoryId === id) setCategoryId("");
      setMessage("사용 중인 기록을 보존하기 위해 카테고리를 보관했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "카테고리를 보관하지 못했습니다.");
      throw error;
    }
  }

  async function toggleCategoryArchive(id: string, archived: boolean) {
    setMessage(null);
    try {
      await patchCategory.mutateAsync({ id, archived });
      setMessage(archived ? "카테고리를 보관했습니다." : "카테고리를 복원했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : archived ? "카테고리를 보관하지 못했습니다." : "카테고리를 복원하지 못했습니다.");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (!categoryId || !itemName.trim() || amountWon < 1) {
      setMessage("카테고리, 항목, 부가세 제외 금액을 입력해 주세요.");
      return;
    }
    const dateError = kind === "one_time" ? oneTimeDateError : recurringDateError;
    if (dateError) {
      setMessage(dateError);
      return;
    }
    try {
      if (kind === "recurring") {
        await createRecurring.mutateAsync({
          categoryId,
          itemName: itemName.trim(),
          amountWon,
          anchorDay: Number(anchorDay),
          startsOn: recurringStart,
          ...(recurringEnd ? { endsOn: recurringEnd } : {}),
        });
        setMessage("반복 비용을 저장했습니다. 관리 화면의 목록 행에서 상세와 작업을 확인할 수 있습니다.");
        setWorkspace("manage");
      } else {
        await createExpense.mutateAsync({
          categoryId,
          itemName: itemName.trim(),
          amountWon,
          periodStart: oneTimeStart,
          ...(oneTimeRange ? { periodEnd: oneTimeEnd } : {}),
        });
        setItemName("");
        setAmountWon(0);
        setMessage("비용을 저장했습니다.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "비용을 저장하지 못했습니다.");
    }
  }

  if (!open || typeof document === "undefined") return null;
  const scopeLabel = view === "category" ? `${ledgerData?.selectedScope.label ?? "전체 범위"} · 카테고리` : ledgerData?.selectedScope.label ?? (ledger.error ? "선택 범위 확인 필요" : "선택 범위 불러오는 중");
  const pendingSummary = ledger.error ? "확인 필요" : "불러오는 중";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 pc:items-start pc:overflow-y-auto pc:p-6" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="expense-ledger-title" className="flex h-screen w-full max-w-3xl flex-col overflow-hidden bg-slate-50 shadow-xl pc:my-4 pc:h-auto pc:max-h-screen pc:rounded-2xl">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-100 bg-white px-4 py-3 pc:px-6">
          <div className="min-w-0"><h2 id="expense-ledger-title" className="text-base font-black text-gray-900">비용 원장</h2><p className="truncate text-xs text-gray-500">부가세 제외 금액 · 기록부터 관리까지 한곳에서</p></div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="비용 원장 닫기" className="min-h-11 min-w-11 rounded-full text-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700">×</button>
        </header>

        <div className="shrink-0 bg-white px-3 pb-3 pc:px-6">
          <p className="mb-1.5 truncate text-xs font-bold text-gray-600" aria-label="선택 비용 범위">{scopeLabel}</p>
          <div className="grid grid-cols-3 gap-1.5" aria-label="비용 요약" data-scope-label={scopeLabel}>
            <SummaryCard label="DB 비용" value={ledgerData ? `₩${formatMoney(ledgerData.dbCostTotal)}` : pendingSummary} tone="red" />
            <SummaryCard label="추가 비용" value={ledgerData ? `₩${formatMoney(ledgerData.additionalCostTotal)}` : pendingSummary} />
            <SummaryCard label="총비용" value={ledgerData ? `₩${formatMoney(ledgerData.totalCost)}` : pendingSummary} tone="dark" />
          </div>
          <nav role="tablist" aria-label="비용 원장 작업" className="mt-3 grid grid-cols-3 rounded-xl bg-slate-100 p-1">
            {(["record", "view", "manage"] as const).map((value) => (
              <button key={value} type="button" role="tab" aria-selected={workspace === value} aria-controls={value === "record" ? "expense-record-form" : `expense-${value}-panel`} onClick={() => setWorkspace(value)} className={`min-h-11 rounded-lg text-sm font-bold ${workspace === value ? "bg-white text-blue-700 shadow-sm" : "text-gray-500"}`}>
                {value === "record" ? "기록" : value === "view" ? "조회" : "관리"}
              </button>
            ))}
          </nav>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 pc:px-6">
          {workspace === "record" && (
            <form id="expense-record-form" onSubmit={submit} role="tabpanel" aria-labelledby="expense-ledger-title" className="space-y-4">
              <div className="grid grid-cols-2 rounded-xl border border-gray-200 bg-white p-1" aria-label="비용 발생 방식">
                {(["one_time", "recurring"] as const).map((value) => <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value)} className={`min-h-11 rounded-lg text-sm font-bold ${kind === value ? "bg-slate-900 text-white" : "text-gray-500"}`}>{value === "one_time" ? "일회성" : "매월 반복"}</button>)}
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <label className="text-xs font-bold text-gray-700">카테고리</label>
                <div className="mt-1">
                  <ExpenseCategoryPicker
                    categories={categoryList}
                    value={categoryId}
                    busy={busy}
                    loading={categories.isLoading}
                    loaded={categories.isSuccess}
                    errorMessage={categoryErrorMessage}
                    retrying={categories.isFetching}
                    onRetry={() => { void categories.refetch(); }}
                    onChange={setCategoryId}
                    onCreate={addCategory}
                    onRename={renameCategory}
                    onArchive={archiveCategory}
                    onMessage={setMessage}
                  />
                </div>
                <div className="mt-3 grid gap-3 pc:grid-cols-2">
                  <label className="text-xs font-bold text-gray-700">항목<input value={itemName} onChange={(event) => setItemName(event.target.value)} className={fieldClass} maxLength={100} placeholder="예: 사무실 임차료" /></label>
                  <label className="text-xs font-bold text-gray-700">금액 (부가세 제외)<MoneyInput value={amountWon} onChange={setAmountWon} aria-label="부가세 제외 비용 금액" className={fieldClass} placeholder="0" /></label>
                </div>
              </div>

              {kind === "one_time" ? (
                <section className="rounded-xl border border-gray-200 bg-white p-3" aria-label="일회성 비용 기간">
                  <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1">
                    <button type="button" aria-pressed={!oneTimeRange} onClick={() => setOneTimeRange(false)} className={`min-h-11 rounded-md text-xs font-bold ${!oneTimeRange ? "bg-white text-blue-700 shadow-sm" : "text-gray-500"}`}>당일</button>
                    <button type="button" aria-pressed={oneTimeRange} onClick={() => setOneTimeRange(true)} className={`min-h-11 rounded-md text-xs font-bold ${oneTimeRange ? "bg-white text-blue-700 shadow-sm" : "text-gray-500"}`}>기간</button>
                  </div>
                  <div className={`mt-3 grid gap-3 ${oneTimeRange ? "grid-cols-2" : "grid-cols-1"}`}>
                    <label className="text-xs font-bold text-gray-700">발생일<input type="date" required value={oneTimeStart} aria-invalid={!isValidISODate(oneTimeStart)} aria-describedby="one-time-date-preview" onChange={(event) => setOneTimeStart(event.target.value)} className={fieldClass} /></label>
                    {oneTimeRange && <label className="text-xs font-bold text-gray-700">종료일<input type="date" required value={oneTimeEnd} min={isValidISODate(oneTimeStart) ? oneTimeStart : undefined} aria-invalid={!isValidISODate(oneTimeEnd) || (isValidISODate(oneTimeStart) && oneTimeEnd < oneTimeStart)} aria-describedby="one-time-date-preview" onChange={(event) => setOneTimeEnd(event.target.value)} className={fieldClass} /></label>}
                  </div>
                  <div id="one-time-date-preview" role="status" className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-gray-600"><p className="font-bold text-gray-800">일할 인식 미리보기</p>{allocation ? <><p className="mt-1">{allocation.days}일 × ₩{formatMoney(allocation.daily)}{allocation.remainder > 0 ? ` + 잔여 ₩${formatMoney(allocation.remainder)} (시작일 우선)` : ""}</p><p className="mt-1 text-xs text-gray-400">시작일과 종료일을 모두 포함해 일별로 배분합니다.</p></> : <p className="mt-1 font-semibold text-amber-700">{oneTimeDateError}</p>}</div>
                </section>
              ) : (
                <section className="rounded-xl border border-gray-200 bg-white p-3" aria-label="반복 비용 일정">
                  <h3 className="text-sm font-black text-gray-900">반복 일정</h3>
                  <p className="mt-0.5 text-xs text-gray-500">당일/기간 토글 없이 시작·종료 경계와 매월 반영일을 각각 정합니다.</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="text-xs font-bold text-gray-700">반복 시작일<input type="date" required value={recurringStart} aria-invalid={!isValidISODate(recurringStart)} aria-describedby="recurring-date-preview" onChange={(event) => setRecurringStart(event.target.value)} className={fieldClass} /></label>
                    <label className="text-xs font-bold text-gray-700">반복 종료일 (선택)<input type="date" value={recurringEnd} min={isValidISODate(recurringStart) ? recurringStart : undefined} aria-invalid={Boolean(recurringEnd && (!isValidISODate(recurringEnd) || recurringEnd < recurringStart))} aria-describedby="recurring-date-preview" onChange={(event) => setRecurringEnd(event.target.value)} className={fieldClass} /></label>
                  </div>
                  <label className="mt-3 block text-xs font-bold text-gray-700">매월 반영일<select value={anchorDay} onChange={(event) => setAnchorDay(event.target.value)} className={fieldClass}>{Array.from({ length: 31 }, (_, index) => index + 1).map((day) => <option key={day} value={day}>{day}일</option>)}</select></label>
                  <div id="recurring-date-preview" role="status" className="mt-3 rounded-lg bg-blue-50 p-3 text-xs text-blue-900">{firstOccurrence ? <><p className="font-bold">첫 반영 예정일 {firstOccurrence}</p><p className="mt-1 text-xs text-blue-700">29~31일이 없는 달은 그 달의 말일로 자동 보정합니다. 종료일이 있으면 해당 날짜 이후에는 발생하지 않습니다.</p></> : <p className="font-semibold text-amber-800">{recurringDateError}</p>}</div>
                </section>
              )}
            </form>
          )}

          {workspace === "view" && (
            <section id="expense-view-panel" role="tabpanel" className="space-y-3">
              <div role="tablist" aria-label="비용 조회 방식" className="grid grid-cols-3 rounded-xl bg-slate-200 p-1">
                {(["month", "all", "category"] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={view === value} onClick={() => setView(value)} className={`min-h-11 rounded-lg text-xs font-bold ${view === value ? "bg-white text-blue-700 shadow-sm" : "text-gray-500"}`}>{value === "month" ? "월별" : value === "all" ? "전체" : "카테고리"}</button>)}
              </div>
              {view === "month" && <div className="flex items-center justify-center gap-2 rounded-xl bg-white p-2"><button type="button" aria-label="이전 달" onClick={() => setMonth((value) => shiftMonth(value, -1))} className="min-h-11 min-w-11 rounded-lg border border-gray-200">‹</button><strong className="min-w-24 text-center text-sm">{month.replace("-", ".")}</strong><button type="button" aria-label="다음 달" onClick={() => setMonth((value) => shiftMonth(value, 1))} className="min-h-11 min-w-11 rounded-lg border border-gray-200">›</button></div>}
              {view === "category" && <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">현재 조회 범위의 모든 카테고리를 비용 내림차순으로 비교합니다. 미분류와 보관 카테고리도 빠지지 않습니다.</p>}
              <ExpenseLedgerTable data={ledgerData} loading={ledger.isLoading} error={ledger.error} retrying={ledger.isFetching} onRetry={() => { void ledger.refetch(); }} mode={view} onOpenManage={() => setWorkspace("manage")} />
            </section>
          )}

          {workspace === "manage" && (
            <section id="expense-manage-panel" role="tabpanel" className="space-y-4">
              <RecurringRuleManager
                rules={recurringRules.data?.rules ?? []}
                loading={recurringRules.isLoading}
                loaded={recurringRules.isSuccess}
                errorMessage={recurringErrorMessage}
                retrying={recurringRules.isFetching}
                onRetry={() => { void recurringRules.refetch(); }}
                month={month}
                amountWon={amountWon}
                onPause={(id) => pauseRule.mutate({ id, value: today() })}
                onResume={(id) => resumeRule.mutate({ id, value: today() })}
                onSkip={(id) => skipRule.mutate({ id, value: month })}
                onFutureAmount={(id) => patchRule.mutate({ id, body: { scope: "future", effectiveMonth: month, patch: { amountWon } } })}
                onDelete={async (id) => {
                  setMessage(null);
                  await deleteRecurring.mutateAsync(id);
                  setMessage("반복 비용을 종료했습니다. 앞으로 다시 발생하지 않으며 과거 비용 기록은 그대로 유지됩니다.");
                }}
              />
              <CategoryManager
                categories={categoryList}
                busy={patchCategory.isPending}
                loading={categories.isLoading}
                loaded={categories.isSuccess}
                errorMessage={categoryErrorMessage}
                retrying={categories.isFetching}
                onRetry={() => { void categories.refetch(); }}
                onRename={renameCategory}
                onArchive={toggleCategoryArchive}
                onDeleteBlocked={() => setMessage("사용 이력을 보존해야 하므로 직접 삭제는 지원하지 않습니다. 보관을 사용해 주세요.")}
              />
            </section>
          )}

          {message && <p role="status" className="mt-4 rounded-lg bg-blue-50 p-3 text-xs font-semibold text-blue-800">{message}</p>}
        </div>

        {workspace === "record" && <footer className="sticky bottom-0 z-20 shrink-0 border-t border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur pc:px-6"><button form="expense-record-form" type="submit" disabled={busy || Boolean(kind === "one_time" ? oneTimeDateError : recurringDateError)} aria-describedby={kind === "one_time" ? "one-time-date-preview" : "recurring-date-preview"} className="min-h-12 w-full rounded-xl bg-blue-600 px-4 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50">{busy ? "저장 중…" : kind === "recurring" ? "반복 비용 저장" : "비용 저장"}</button></footer>}
      </section>
    </div>,
    document.body,
  );
}

function SummaryCard({ label, value, tone = "plain" }: { label: string; value: string; tone?: "plain" | "red" | "dark" }) {
  const style = tone === "dark" ? "bg-slate-900 text-white" : tone === "red" ? "border border-red-100 bg-red-50 text-red-700" : "border border-gray-200 bg-white text-gray-900";
  return <div className={`min-w-0 rounded-lg px-2 py-2 ${style}`}><p className={`truncate text-xs ${tone === "dark" ? "text-slate-300" : "text-gray-500"}`}>{label}</p><strong className="mt-0.5 block truncate text-xs pc:text-sm">{value}</strong></div>;
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

function RecurringRuleManager({
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

function CategoryManager({ categories, busy, loading, loaded, errorMessage, retrying, onRetry, onRename, onArchive, onDeleteBlocked }: QueryStateProps & { categories: ExpenseCategory[]; busy: boolean; onRename: (id: string, name: string) => Promise<void>; onArchive: (id: string, archived: boolean) => Promise<void>; onDeleteBlocked: () => void }) {
  let content;
  if (loading || (!loaded && !errorMessage)) {
    content = <QueryStatePanel message="카테고리를 불러오고 있습니다." />;
  } else if (errorMessage) {
    content = <QueryStatePanel message={errorMessage} error retrying={retrying} onRetry={onRetry} />;
  } else if (categories.length === 0) {
    content = <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-xs text-gray-400">등록된 카테고리가 없습니다. 기록 화면에서 새 카테고리를 추가해 주세요.</p>;
  } else {
    content = <div className="space-y-2">{categories.map((category) => <CategoryRow key={category.id} category={category} busy={busy} onRename={onRename} onArchive={onArchive} onDeleteBlocked={onDeleteBlocked} />)}</div>;
  }
  return <div><div className="mb-2"><h3 className="text-sm font-black text-gray-900">카테고리</h3><p className="text-xs text-gray-500">이름 변경, 보관, 복원을 기록과 함께 안전하게 처리합니다.</p></div>{content}</div>;
}

function CategoryRow({ category, busy, onRename, onArchive, onDeleteBlocked }: { category: ExpenseCategory; busy: boolean; onRename: (id: string, name: string) => Promise<void>; onArchive: (id: string, archived: boolean) => Promise<void>; onDeleteBlocked: () => void }) {
  const [draft, setDraft] = useState(category.name);
  useEffect(() => setDraft(category.name), [category.name]);
  return <details className="rounded-xl border border-gray-200 bg-white"><summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-3 marker:hidden"><span className="min-w-0 truncate text-sm font-bold text-gray-900">{category.name}</span><span className="text-xs text-gray-500">{category.archivedAt ? "보관됨" : "상세·관리"}</span></summary><div className="border-t border-gray-100 bg-slate-50 p-3"><label className="text-xs font-bold text-gray-700">카테고리 이름<input aria-label={`${category.name} 카테고리 이름`} value={draft} onChange={(event) => setDraft(event.target.value)} className={fieldClass} maxLength={40} /></label><div className="mt-3 grid grid-cols-3 gap-2"><button type="button" disabled={busy || !draft.trim() || draft.trim() === category.name} onClick={() => onRename(category.id, draft.trim())} className="min-h-11 rounded-lg border border-gray-200 bg-white text-xs font-bold disabled:opacity-40">이름 변경</button><button type="button" disabled={busy} onClick={() => onArchive(category.id, !category.archivedAt)} className="min-h-11 rounded-lg border border-gray-200 bg-white text-xs font-bold">{category.archivedAt ? "복원" : "보관"}</button><button type="button" onClick={onDeleteBlocked} className="min-h-11 rounded-lg border border-red-100 bg-white text-xs font-bold text-red-600">삭제</button></div></div></details>;
}
