/**
 * Scope G — compact inline editor for one existing one_time expense entry.
 *
 * Lives inside the existing row <details>; no card, no Save/Cancel footer,
 * no extra padding. Money/category/date (+name) form one coherent group:
 * keystrokes stage only, ONE PATCH on group blur or Enter. Inputs never
 * disable for request state; per-row queue + frozen expense.id target prevent
 * cross-entry stale writes. Small AutosaveStatus line with retry/undo.
 */
"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format/money";
import type { RecognizedExpense } from "@/types/expense-ledger";
import AutosaveStatus from "@/components/autosave/AutosaveStatus";
import { isPartiallyRecognized, useExpenseEntryAutosave } from "./useExpenseEntryAutosave";

interface Props {
  entry: RecognizedExpense;
  categories: Array<{ id: string; name: string }>;
  view: string;
  month: string | null;
}

const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 focus:border-blue-500 focus:outline-none";

export default function ExpenseEntryEditor({ entry, categories, view, month }: Props) {
  const auto = useExpenseEntryAutosave({
    entry,
    view,
    month,
    categoryIds: categories.map((c) => c.id),
  });
  const { draft } = auto;
  const [groupError, setGroupError] = useState<string | null>(null);

  const stage = (patch: Partial<typeof draft>) => {
    setGroupError(null);
    auto.stageField(patch);
  };

  const commit = () => setGroupError(auto.commitGroup());

  const onGroupBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    // Field-to-field moves stay inside the group: no save yet.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    commit();
  };

  const onGroupKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
      commit();
    }
  };

  const categoryOptions = categories.some((c) => c.id === entry.categoryId)
    ? categories
    : [...categories, { id: entry.categoryId, name: entry.categoryName || "미분류" }];

  const hasOriginal = entry.source === "one_time" && entry.originalAmountWon != null;
  const showSplit = !auto.amountLocked && hasOriginal && isPartiallyRecognized(entry, view, month);

  return (
    <div onBlur={onGroupBlur} onKeyDown={onGroupKeyDown} className="mt-2 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-2 block">
          <span className="mb-0.5 block text-xs text-gray-500">항목</span>
          <input
            type="text"
            aria-label="항목 이름"
            className={inputCls}
            value={draft.itemName}
            onChange={(e) => stage({ itemName: e.target.value })}
            maxLength={100}
          />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-xs text-gray-500">카테고리</span>
          <select
            aria-label="카테고리"
            className={inputCls}
            value={draft.categoryId}
            onChange={(e) => stage({ categoryId: e.target.value })}
          >
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-0.5 block text-xs text-gray-500">금액(원)</span>
          <input
            type="text"
            inputMode="numeric"
            aria-label="금액(원)"
            className={inputCls}
            value={draft.amountText}
            disabled={auto.amountLocked}
            title={auto.amountLocked ? "여러 달에 걸친 비용이라 원본 전액을 유지합니다" : undefined}
            onChange={(e) => stage({ amountText: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-xs text-gray-500">시작일</span>
          <input
            type="date"
            aria-label="시작일"
            className={inputCls}
            value={draft.periodStart}
            onChange={(e) => stage({ periodStart: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-xs text-gray-500">종료일</span>
          <input
            type="date"
            aria-label="종료일"
            className={inputCls}
            value={draft.periodEnd}
            onChange={(e) => stage({ periodEnd: e.target.value })}
          />
        </label>
      </div>
      {groupError && <p role="alert" className="text-xs font-semibold text-red-600">{groupError}</p>}
      {auto.amountLocked && (
        <p className="text-xs text-gray-400">
          이 범위 인식액 ₩{formatMoney(entry.amountWon)} · 여러 달에 걸친 비용이라 금액은 원본 전액 그대로 유지됩니다.
        </p>
      )}
      {showSplit && (
        <p className="text-xs text-gray-400">
          전액 ₩{formatMoney(entry.originalAmountWon ?? entry.amountWon)} · 이 범위 인식액 ₩{formatMoney(entry.amountWon)}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-400">벗어나거나 Enter를 누르면 저장됩니다.</span>
        <AutosaveStatus
          status={auto.status}
          error={auto.error}
          savedAt={auto.savedAt}
          onRetry={auto.retry}
          canUndo={auto.canUndo}
          onUndo={auto.undo}
        />
      </div>
    </div>
  );
}
