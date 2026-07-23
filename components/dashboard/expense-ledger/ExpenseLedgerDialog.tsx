"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import MoneyInput from "@/components/ui/MoneyInput";
import { formatMoney } from "@/lib/format/money";
import {
  type ExpenseViewMode,
  useCreateCategory,
  useCreateExpense,
  useCreateRecurringRule,
  useExpenseCategories,
  useExpenseLedger,
  usePatchCategory,
  usePatchRecurringRule,
  useRecurringRules,
  useRecurringRuleAction,
} from "@/query/expense-ledger-hooks";
import ExpenseLedgerTable from "./ExpenseLedgerTable";

interface Props {
  open: boolean;
  onClose: () => void;
  dbCostTotal: number;
  additionalCost: number | null;
}

const fieldClass = "mt-1 w-full rounded-md border border-gray-300 px-2.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none";
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const currentMonth = () => today().slice(0, 7);
const shiftMonth = (month: string, delta: number) => {
  const [year = 0, value = 1] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};
const daysInclusive = (start: string, end: string) => Math.max(1, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1);

export default function ExpenseLedgerDialog({ open, onClose, dbCostTotal, additionalCost }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [view, setView] = useState<ExpenseViewMode>("month");
  const [month, setMonth] = useState(currentMonth);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [itemName, setItemName] = useState("");
  const [amountWon, setAmountWon] = useState(0);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [isRange, setIsRange] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [anchorDay, setAnchorDay] = useState(String(new Date().getDate()));
  const [recurringRuleId, setRecurringRuleId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const categories = useExpenseCategories();
  const ledger = useExpenseLedger(view, month, view === "category" ? categoryFilter : undefined);
  const createCategory = useCreateCategory();
  const createExpense = useCreateExpense();
  const createRecurring = useCreateRecurringRule();
  const patchCategory = usePatchCategory();
  const patchRule = usePatchRecurringRule();
  const recurringRules = useRecurringRules();
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

  const selectedCategory = categories.data?.find((category) => category.id === categoryId);
  const allocation = useMemo(() => {
    const days = isRange ? daysInclusive(start, end) : 1;
    return { days, daily: Math.floor(amountWon / days), remainder: amountWon % days };
  }, [amountWon, end, isRange, start]);
  const busy = createExpense.isPending || createRecurring.isPending || createCategory.isPending;
  const activeCategories = categories.data?.filter((category) => !category.archivedAt) ?? [];

  async function addCategory() {
    const name = newCategory.trim();
    if (!name) return;
    setMessage(null);
    try {
      const result = await createCategory.mutateAsync(name);
      setCategoryId(result.category.id);
      setNewCategory("");
      setMessage(`카테고리 “${result.category.name}”를 추가했습니다.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "카테고리를 추가하지 못했습니다."); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (!categoryId || !itemName.trim() || amountWon < 1) {
      setMessage("카테고리, 품목, 부가세 제외 금액을 입력해 주세요.");
      return;
    }
    if (isRange && end < start) { setMessage("종료일은 시작일보다 빠를 수 없습니다."); return; }
    try {
      if (repeat) {
        const result = await createRecurring.mutateAsync({ categoryId, itemName: itemName.trim(), amountWon, anchorDay: Number(anchorDay), startsOn: start, ...(isRange ? { endsOn: end } : {}) });
        setRecurringRuleId(result.rule.id);
        setMessage("매월 반복 비용을 저장했습니다. 아래에서 이번 달 건너뛰기 또는 일시 중지를 할 수 있습니다.");
      } else {
        await createExpense.mutateAsync({ categoryId, itemName: itemName.trim(), amountWon, periodStart: start, ...(isRange ? { periodEnd: end } : {}) });
        setItemName(""); setAmountWon(0); setMessage("비용을 저장했습니다.");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "비용을 저장하지 못했습니다."); }
  }

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:p-6" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="expense-ledger-title" className="my-4 w-full max-w-3xl rounded-2xl bg-white shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b border-gray-100 px-4 py-4 sm:px-6">
          <div><h2 id="expense-ledger-title" className="text-base font-black text-gray-900">비용 원장</h2><p className="mt-1 text-xs text-gray-500">모든 금액은 부가세 제외 금액으로 입력합니다.</p></div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="비용 원장 닫기" className="min-h-11 min-w-11 rounded-full text-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700">×</button>
        </header>
        <div className="space-y-5 p-4 sm:p-6">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-red-100 bg-red-50/40 p-3"><p className="text-xs text-gray-500">DB 비용 합계</p><p className="mt-1 text-base font-bold text-red-600">₩{formatMoney(dbCostTotal)}</p><p className="mt-1 text-[11px] text-gray-400">자동 집계 · 수정 불가</p></div>
            <div className="rounded-lg border border-gray-200 p-3"><p className="text-xs text-gray-500">추가 비용</p><p className="mt-1 text-base font-bold text-gray-900">{additionalCost === null ? "확인 필요" : `₩${formatMoney(additionalCost)}`}</p><p className="mt-1 text-[11px] text-gray-400">일회성 · 반복 비용</p></div>
            <div className="rounded-lg bg-slate-900 p-3 text-white"><p className="text-xs text-slate-300">총비용</p><p className="mt-1 text-base font-bold">{additionalCost === null ? "확인 필요" : `₩${formatMoney(dbCostTotal + additionalCost)}`}</p><p className="mt-1 text-[11px] text-slate-300">DB 비용 + 추가 비용</p></div>
          </div>

          <form onSubmit={submit} className="rounded-xl border border-gray-200 p-4">
            <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-bold text-gray-900">비용 추가</h3><label className="flex items-center gap-2 text-xs font-medium text-gray-700"><input type="checkbox" checked={repeat} onChange={(event) => setRepeat(event.target.checked)} /> 매월 반복</label></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-gray-700">카테고리<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={fieldClass}><option value="">선택하세요</option>{activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              <div className="text-xs font-medium text-gray-700">새 카테고리<div className="mt-1 flex gap-2"><input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} className={`${fieldClass} mt-0`} maxLength={40} placeholder="예: 임차료" /><button type="button" onClick={addCategory} disabled={!newCategory.trim() || createCategory.isPending} className="rounded-md border border-blue-200 px-3 text-xs font-bold text-blue-700 disabled:opacity-50">추가</button></div></div>
              <label className="text-xs font-medium text-gray-700">품목<input value={itemName} onChange={(event) => setItemName(event.target.value)} className={fieldClass} maxLength={100} placeholder="예: 사무실 임대료" /></label>
              <label className="text-xs font-medium text-gray-700">금액 (원, 부가세 제외)<MoneyInput value={amountWon} onChange={setAmountWon} aria-label="부가세 제외 비용 금액" className={fieldClass} placeholder="0" /></label>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div><div className="flex gap-3 text-xs text-gray-700"><label><input type="radio" checked={!isRange} onChange={() => setIsRange(false)} /> 당일</label><label><input type="radio" checked={isRange} onChange={() => setIsRange(true)} /> 기간</label></div><div className="mt-2 grid grid-cols-2 gap-2"><label className="text-xs text-gray-500">{repeat ? "시작일" : "발생일"}<input type="date" value={start} onChange={(event) => setStart(event.target.value)} className={fieldClass} /></label>{isRange && <label className="text-xs text-gray-500">종료일<input type="date" value={end} min={start} onChange={(event) => setEnd(event.target.value)} className={fieldClass} /></label>}</div></div>
              {repeat ? <label className="text-xs font-medium text-gray-700">매월 반영일<select value={anchorDay} onChange={(event) => setAnchorDay(event.target.value)} className={fieldClass}>{Array.from({ length: 31 }, (_, index) => index + 1).map((day) => <option key={day} value={day}>{day}일</option>)}</select><span className="mt-1 block font-normal text-gray-400">29~31일은 해당 월의 마지막 날에 반영됩니다.</span></label> : <div className="rounded-lg bg-slate-50 p-3 text-xs text-gray-600"><p className="font-semibold text-gray-800">일할 인식 미리보기</p><p className="mt-1">{allocation.days}일 × ₩{formatMoney(allocation.daily)}{allocation.remainder > 0 ? ` + 잔여 ₩${formatMoney(allocation.remainder)} (시작일 우선)` : ""}</p><p className="mt-1 text-[11px] text-gray-400">시작일과 종료일을 포함해 월별로 일할 배분합니다.</p></div>}
            </div>
            <div className="mt-4 flex justify-end"><button type="submit" disabled={busy} className="min-h-11 rounded-md bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">{busy ? "저장 중…" : repeat ? "반복 비용 저장" : "비용 추가"}</button></div>
          </form>

          {recurringRuleId && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><p className="font-bold">방금 만든 반복 비용 관리</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => pauseRule.mutate({ id: recurringRuleId, value: today() })} className="rounded border border-amber-300 px-2 py-1">일시 중지</button><button type="button" onClick={() => resumeRule.mutate({ id: recurringRuleId, value: today() })} className="rounded border border-amber-300 px-2 py-1">재개</button><button type="button" onClick={() => skipRule.mutate({ id: recurringRuleId, value: month })} className="rounded border border-amber-300 px-2 py-1">이번 달 건너뛰기</button><button type="button" onClick={() => patchRule.mutate({ id: recurringRuleId, body: { scope: "future", effectiveMonth: month, patch: { amountWon } } })} className="rounded border border-amber-300 px-2 py-1">다음 달부터 현재 금액 적용</button></div></div>}
          {message && <p role="status" className="text-xs text-blue-700">{message}</p>}

          <section className="border-t border-gray-100 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><div role="tablist" aria-label="비용 조회 방식" className="flex rounded-md bg-slate-100 p-1">{(["month", "all", "category"] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={view === value} onClick={() => setView(value)} className={`rounded px-3 py-1.5 text-xs font-bold ${view === value ? "bg-white text-blue-700 shadow-sm" : "text-gray-500"}`}>{value === "month" ? "월별" : value === "all" ? "전체" : "카테고리"}</button>)}</div>{view === "month" && <div className="flex items-center gap-1"><button type="button" aria-label="이전 달" onClick={() => setMonth((value) => shiftMonth(value, -1))} className="min-h-11 min-w-11 rounded border border-gray-200">‹</button><span className="min-w-20 text-center text-sm font-bold">{month.replace("-", ".")}</span><button type="button" aria-label="다음 달" onClick={() => setMonth((value) => shiftMonth(value, 1))} className="min-h-11 min-w-11 rounded border border-gray-200">›</button></div>}</div>
            {view === "category" && <label className="mt-3 block text-xs font-medium text-gray-700">조회 카테고리<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className={fieldClass}><option value="">선택하세요</option>{categories.data?.map((category) => <option key={category.id} value={category.id}>{category.name}{category.archivedAt ? " (보관)" : ""}</option>)}</select></label>}
            <div className="mt-3"><ExpenseLedgerTable data={ledger.data} loading={ledger.isLoading} error={ledger.error} /></div>
          </section>

          <RecurringRuleManager
            rules={recurringRules.data?.rules ?? []}
            loading={recurringRules.isLoading}
            month={month}
            today={today()}
            onPause={(id) => pauseRule.mutate({ id, value: today() })}
            onResume={(id) => resumeRule.mutate({ id, value: today() })}
            onSkip={(id) => skipRule.mutate({ id, value: month })}
            onFutureAmount={(id) => patchRule.mutate({ id, body: { scope: "future", effectiveMonth: month, patch: { amountWon } } })}
          />
          <details className="rounded-lg border border-gray-200 p-3"><summary className="cursor-pointer text-xs font-bold text-gray-700">카테고리 관리</summary><div className="mt-3 space-y-2">{categories.data?.map((category) => <CategoryRow key={category.id} id={category.id} name={category.name} archived={Boolean(category.archivedAt)} onSave={(name) => patchCategory.mutate({ id: category.id, name })} onArchive={(archived) => patchCategory.mutate({ id: category.id, archived })} busy={patchCategory.isPending} />)}</div></details>
        </div>
      </section>
    </div>, document.body,
  );
}

function RecurringRuleManager({ rules, loading, month, today: currentDay, onPause, onResume, onSkip, onFutureAmount }: { rules: Array<{ id: string; categoryName: string; itemName: string; amountWon: number; status: string; currentOccurrence: { occurrenceDate: string; occurrenceMonth: string; status: string } | null; nextOccurrence: { occurrenceDate: string; occurrenceMonth: string; status: string } | null }>; loading: boolean; month: string; today: string; onPause: (id: string) => void; onResume: (id: string) => void; onSkip: (id: string) => void; onFutureAmount: (id: string) => void }) {
  return <details className="rounded-lg border border-gray-200 p-3"><summary className="cursor-pointer text-xs font-bold text-gray-700">반복 비용 관리 {loading ? "(불러오는 중)" : `(${rules.length})`}</summary><div className="mt-3 space-y-2">{rules.length === 0 && !loading ? <p className="text-xs text-gray-400">등록된 반복 비용이 없습니다.</p> : rules.map((rule) => <div key={rule.id} className="rounded-md bg-slate-50 p-2.5 text-xs"><div className="flex items-start justify-between gap-2"><div><p className="font-bold text-gray-800">{rule.itemName} <span className="font-normal text-gray-500">· {rule.categoryName}</span></p><p className="mt-1 text-gray-500">₩{formatMoney(rule.amountWon)} · {rule.status} · 이번 발생 {rule.currentOccurrence ? `${rule.currentOccurrence.occurrenceDate} (${rule.currentOccurrence.status})` : "없음"}</p>{rule.nextOccurrence && <p className="mt-0.5 text-gray-400">다음 발생 {rule.nextOccurrence.occurrenceDate}</p>}</div><div className="flex flex-wrap justify-end gap-1"><button type="button" onClick={() => rule.status === "paused" ? onResume(rule.id) : onPause(rule.id)} className="rounded border border-gray-200 bg-white px-2 py-1">{rule.status === "paused" ? "재개" : "중지"}</button><button type="button" onClick={() => onSkip(rule.id)} className="rounded border border-gray-200 bg-white px-2 py-1">{month} 건너뛰기</button><button type="button" onClick={() => onFutureAmount(rule.id)} className="rounded border border-gray-200 bg-white px-2 py-1">다음 달부터 금액 적용</button></div></div></div>)}</div><p className="mt-2 text-[11px] text-gray-400">오늘 {currentDay} 기준. 이번 발생만의 금액 수정은 반복 내역에서 지원되는 발생 건을 선택해 적용합니다.</p></details>;
}

function CategoryRow({ id: _id, name, archived, onSave, onArchive, busy }: { id: string; name: string; archived: boolean; onSave: (name: string) => void; onArchive: (archived: boolean) => void; busy: boolean }) {
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);
  return <div className="flex items-center gap-2"><input aria-label={`${name} 카테고리 이름`} value={draft} onChange={(event) => setDraft(event.target.value)} className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1.5 text-xs" maxLength={40} /><button type="button" disabled={busy || !draft.trim() || draft.trim() === name} onClick={() => onSave(draft.trim())} className="rounded border border-gray-200 px-2 py-1 text-xs disabled:opacity-40">수정</button><button type="button" disabled={busy} onClick={() => onArchive(!archived)} className="rounded border border-gray-200 px-2 py-1 text-xs">{archived ? "복원" : "보관"}</button></div>;
}
