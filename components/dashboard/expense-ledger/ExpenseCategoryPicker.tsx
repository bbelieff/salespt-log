"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  useExpenseCategoryUsage,
  type DeleteExpenseCategoryResult,
  type ExpenseCategoryR6,
  type ExpenseReclassificationRef,
  type ReclassifyExpenseCategoryBody,
  type ReclassifyExpenseCategoryResult,
} from "@/query/expense-ledger-hooks";

export interface ReclassifiableExpenseItem extends ExpenseReclassificationRef {
  label: string;
  detail: string;
}

interface Props {
  categories: ExpenseCategoryR6[];
  value: string;
  busy: boolean;
  loading: boolean;
  loaded: boolean;
  errorMessage: string | null;
  retrying: boolean;
  unclassifiedRefs: ReclassifiableExpenseItem[];
  onRetry: () => void;
  onChange: (id: string) => void;
  onCreate: (name: string) => Promise<ExpenseCategoryR6>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<DeleteExpenseCategoryResult>;
  onReclassify: (body: ReclassifyExpenseCategoryBody) => Promise<ReclassifyExpenseCategoryResult>;
  onMessage: (message: string) => void;
}

const controlClass = "min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-left text-sm text-gray-900 focus:border-blue-500 focus:outline-none";
const refKey = (ref: ExpenseReclassificationRef) => `${ref.kind}:${ref.id}`;
const isSystemCategory = (category: ExpenseCategoryR6) => category.isSystem === true || category.name === "미분류" || category.id.startsWith("system:");
const isDeletedCategory = (category: ExpenseCategoryR6) => Boolean(category.deletedAt || category.archivedAt);

function safeActionError(error: unknown, action: "삭제" | "분류") {
  const code = error instanceof Error ? error.message : "";
  if (/401|unauthenticated/i.test(code)) return `로그인이 만료되어 카테고리 ${action}를 완료하지 못했습니다. 다시 로그인한 뒤 시도해 주세요.`;
  if (/403|forbidden/i.test(code)) return `카테고리 ${action} 권한이 없습니다. 관리자에게 권한을 요청해 주세요.`;
  if (/expense_category_not_found|404/i.test(code)) return "카테고리를 찾을 수 없습니다. 목록을 다시 불러온 뒤 시도해 주세요.";
  if (/expense_category_system_immutable/i.test(code)) return "미분류와 시스템 카테고리는 이름을 바꾸거나 삭제할 수 없습니다.";
  if (/expense_category_deleted/i.test(code)) return "이미 삭제된 카테고리입니다. 목록을 다시 불러와 주세요.";
  if (/expense_reclassification_source_mismatch|expense_category_concurrent_change|expense_idempotency_conflict|409/i.test(code)) return "다른 변경이 먼저 반영되었습니다. 목록을 다시 불러온 뒤 재시도해 주세요.";
  return `카테고리 ${action}를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.`;
}

function operationId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export default function ExpenseCategoryPicker(props: Props) {
  const { categories, value, busy, loading, loaded, errorMessage, retrying, unclassifiedRefs, onRetry, onChange, onCreate, onRename, onDelete, onReclassify, onMessage } = props;
  const listId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [createName, setCreateName] = useState("");
  const [renameName, setRenameName] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [selectedRefs, setSelectedRefs] = useState<string[]>([]);
  const [targetId, setTargetId] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const usage = useExpenseCategoryUsage(deleteId);

  const visible = useMemo(() => categories.filter((category) => !isDeletedCategory(category) && !hiddenIds.includes(category.id) && !category.id.startsWith("system:db_")), [categories, hiddenIds]);
  const selected = visible.find((category) => category.id === value);
  const deleteCategory = visible.find((category) => category.id === deleteId);
  const ordinary = visible.filter((category) => !isSystemCategory(category));
  const unclassified = visible.find(isSystemCategory);
  const normalizedQuery = query.trim().normalize("NFKC").toLocaleLowerCase("ko-KR");
  const filtered = visible.filter((category) => category.name.normalize("NFKC").toLocaleLowerCase("ko-KR").includes(normalizedQuery));
  const selectedItems = unclassifiedRefs.filter((item) => selectedRefs.includes(refKey(item)));

  useEffect(() => setRenameName(selected && !isSystemCategory(selected) ? selected.name : ""), [selected]);
  useEffect(() => { if (open) searchRef.current?.focus(); }, [open]);
  useEffect(() => { if (open) setSelectedRefs(unclassifiedRefs.map(refKey)); }, [open, unclassifiedRefs]);

  async function createCategory() {
    const name = createName.trim();
    if (!name) return;
    setActionBusy(true); setActionError(null);
    try {
      const category = await onCreate(name);
      onChange(category.id); setCreateName(""); onMessage(`카테고리 '${category.name}'을 추가했습니다.`);
    } catch (error) { setActionError(safeActionError(error, "분류")); } finally { setActionBusy(false); }
  }

  async function renameCategory() {
    const name = renameName.trim();
    if (!selected || isSystemCategory(selected) || !name || name === selected.name) return;
    setActionBusy(true); setActionError(null);
    try { await onRename(selected.id, name); onMessage(`카테고리 이름을 '${name}'으로 바꿨습니다.`); }
    catch (error) { setActionError(safeActionError(error, "분류")); }
    finally { setActionBusy(false); }
  }

  async function deleteSelectedCategory() {
    if (!deleteCategory || isSystemCategory(deleteCategory)) return;
    setActionBusy(true); setActionError(null);
    try {
      const result = await onDelete(deleteCategory.id);
      setHiddenIds((ids) => [...ids, deleteCategory.id]);
      if (value === deleteCategory.id) onChange("");
      setDeleteId("");
      onMessage(`${deleteCategory.name}을 삭제하고 항목 ${result.movedEntryCount}건, 반복 ${result.movedRuleCount}건, 발생 ${result.movedOccurrenceCount}건을 미분류로 옮겼습니다. 과거 기록은 유지됩니다.`);
    } catch (error) { setActionError(safeActionError(error, "삭제")); }
    finally { setActionBusy(false); }
  }

  async function reclassify() {
    if (!targetId || selectedItems.length === 0) return;
    setActionBusy(true); setActionError(null);
    try {
      const result = await onReclassify({ operationId: operationId(), targetCategoryId: targetId, refs: selectedItems.map(({ kind, id }) => ({ kind, id })) });
      setSelectedRefs([]);
      onMessage(`미분류 ${result.movedEntryCount + result.movedRuleCount + result.movedOccurrenceCount}건을 선택한 카테고리로 옮겼습니다.`);
    } catch (error) { setActionError(safeActionError(error, "분류")); }
    finally { setActionBusy(false); }
  }

  if (loading || (!loaded && !errorMessage)) return <div role="status" className="rounded-lg border border-gray-200 bg-slate-50 p-3 text-xs font-semibold text-gray-600">카테고리를 불러오고 있습니다.</div>;
  if (errorMessage) return <div role="alert" className="rounded-lg border border-red-100 bg-red-50 p-3 text-xs text-red-800"><p className="font-semibold">{errorMessage}</p><button type="button" disabled={retrying} onClick={onRetry} className="mt-3 min-h-11 rounded-lg border border-red-200 bg-white px-4 font-bold disabled:opacity-50">{retrying ? "다시 불러오는 중…" : "다시 시도"}</button></div>;

  return (
    <div className="relative">
      <button type="button" role="combobox" aria-controls={listId} aria-expanded={open} aria-haspopup="listbox" aria-label="비용 카테고리" onClick={() => { setOpen((value) => !value); setActionError(null); }} className={`${controlClass} flex items-center justify-between gap-3 font-semibold`}>
        <span className={selected ? "" : "text-gray-400"}>{selected?.name ?? (visible.length === 0 ? "첫 카테고리를 추가하세요" : "카테고리를 선택하세요")}</span><span aria-hidden="true" className="text-gray-400">⌄</span>
      </button>
      {visible.length === 0 && <p className="mt-2 text-xs text-gray-500">등록된 카테고리가 없습니다. 목록을 열어 새 카테고리를 추가해 주세요.</p>}

      {open && <div className="absolute left-0 right-0 z-30 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 shadow-xl" onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setOpen(false); } }}>
        <label className="block text-xs font-semibold text-gray-600">카테고리 검색<input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-3 text-sm" placeholder="이름 검색" /></label>
        <div id={listId} role="listbox" aria-label="카테고리 선택" className="mt-2 max-h-40 space-y-1 overflow-y-auto">
          {filtered.length === 0 ? <p className="px-2 py-3 text-xs text-gray-400">일치하는 카테고리가 없습니다.</p> : filtered.map((category) => {
            const system = isSystemCategory(category);
            return <div key={category.id} className="flex items-center gap-1 rounded-lg border border-transparent hover:border-gray-100">
              <button type="button" role="option" aria-selected={category.id === value} onClick={() => onChange(category.id)} className={`min-h-11 min-w-0 flex-1 rounded-lg px-3 text-left text-sm ${category.id === value ? "bg-blue-50 font-bold text-blue-700" : "hover:bg-slate-50"}`}>{category.name}{system && <span className="ml-2 text-xs font-normal text-gray-400">고정</span>}</button>
              {!system && <button type="button" aria-label={`${category.name} 카테고리 삭제`} onClick={() => { setDeleteId(category.id); setActionError(null); }} className="min-h-[44px] min-w-[44px] rounded-lg text-xl font-bold text-red-600 hover:bg-red-50">×</button>}
            </div>;
          })}
        </div>

        <div className="mt-3 border-t border-gray-100 pt-3"><p className="text-xs font-bold text-gray-700">새 카테고리</p><div className="mt-1 flex gap-2"><input aria-label="새 카테고리 이름" value={createName} onChange={(event) => setCreateName(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-sm" maxLength={40} placeholder="예: 소모품" /><button type="button" disabled={busy || actionBusy || !createName.trim()} onClick={() => void createCategory()} className="min-h-11 rounded-lg border border-blue-200 px-3 text-xs font-bold text-blue-700 disabled:opacity-40">추가</button></div></div>

        {selected && !isSystemCategory(selected) && <div className="mt-3 border-t border-gray-100 pt-3"><p className="text-xs font-bold text-gray-700">선택 카테고리 이름</p><div className="mt-1 flex gap-2"><input aria-label="선택 카테고리 이름 수정" value={renameName} onChange={(event) => setRenameName(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-sm" maxLength={40} /><button type="button" disabled={busy || actionBusy || !renameName.trim() || renameName.trim() === selected.name} onClick={() => void renameCategory()} className="min-h-11 rounded-lg border border-gray-200 px-3 text-xs font-bold disabled:opacity-40">이름 변경</button></div></div>}

        {deleteCategory && <section aria-label={`${deleteCategory.name} 카테고리 삭제 확인`} className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900">
          <p className="font-bold">{deleteCategory.name}을 삭제할까요?</p>
          {usage.isLoading ? <p role="status" className="mt-2">사용량을 확인하고 있습니다.</p> : usage.error ? <div role="alert" className="mt-2"><p>{safeActionError(usage.error, "삭제")}</p><button type="button" onClick={() => { void usage.refetch(); }} className="mt-2 min-h-11 rounded-lg border border-red-200 bg-white px-3 font-bold">사용량 다시 확인</button></div> : usage.data && <p className="mt-2 leading-relaxed">항목 {usage.data.usage.entryCount}건, 반복 {usage.data.usage.ruleCount}건, 발생 {usage.data.usage.occurrenceCount}건이 미분류로 이동합니다. 기록과 금액은 삭제되지 않습니다.</p>}
          {actionError && <p role="alert" className="mt-2 rounded-lg bg-white p-2 font-semibold">{actionError}</p>}
          <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={actionBusy} onClick={() => { setDeleteId(""); setActionError(null); }} className="min-h-11 rounded-lg border border-gray-300 bg-white font-bold">취소</button><button type="button" disabled={actionBusy || !usage.data} onClick={() => void deleteSelectedCategory()} className="min-h-11 rounded-lg bg-red-600 px-2 font-bold text-white disabled:opacity-50">{actionBusy ? "삭제 중…" : actionError ? "삭제 다시 시도" : "카테고리 삭제 확인"}</button></div>
        </section>}

        {unclassified && <section className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950"><div className="flex items-start justify-between gap-3"><div><p className="font-black">미분류</p><p className="mt-1 text-amber-800">고정 카테고리이며 이름 변경·삭제할 수 없습니다.</p></div><span className="shrink-0 font-bold">{unclassifiedRefs.length}건</span></div>
          {unclassifiedRefs.length > 0 && <><div className="mt-3 max-h-36 space-y-1 overflow-y-auto">{unclassifiedRefs.map((item) => { const key = refKey(item); const checked = selectedRefs.includes(key); return <button key={key} type="button" aria-pressed={checked} onClick={() => setSelectedRefs((keys) => checked ? keys.filter((value) => value !== key) : [...keys, key])} className={`min-h-11 w-full rounded-lg border px-3 text-left ${checked ? "border-amber-400 bg-white" : "border-transparent bg-amber-100/60"}`}><span className="block font-bold">{item.label}</span><span className="block text-amber-700">{item.detail}</span></button>; })}</div>
          <div className="mt-2 flex gap-2"><button type="button" onClick={() => setSelectedRefs(unclassifiedRefs.map(refKey))} className="min-h-11 flex-1 rounded-lg border border-amber-300 bg-white font-bold">전체 선택</button><button type="button" onClick={() => setSelectedRefs([])} className="min-h-11 flex-1 rounded-lg border border-amber-300 bg-white font-bold">선택 해제</button></div>
          <select aria-label="미분류 이동 대상" value={targetId} onChange={(event) => setTargetId(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-amber-300 bg-white px-3"><option value="">이동할 카테고리 선택</option>{ordinary.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
          <button type="button" disabled={busy || actionBusy || !targetId || selectedItems.length === 0} onClick={() => void reclassify()} className="mt-2 min-h-11 w-full rounded-lg bg-amber-700 px-3 font-black text-white disabled:opacity-40">{selectedItems.length}건 분류하기</button></>}
        </section>}
        {actionError && !deleteCategory && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-800">{actionError}</p>}
      </div>}
    </div>
  );
}
