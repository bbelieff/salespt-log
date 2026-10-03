/**
 * Scope G — existing one-off expense inline edit autosave.
 *
 * Compact coherent group (item name + category + amount + period) for a single
 * one_time entry. All keystrokes stage only; ONE PATCH fires on whole-group
 * blur or Enter when valid. Never writes on hydration, field-to-field focus
 * moves, or invalid drafts. Recurring-generated entries are NOT covered here.
 *
 * DTO: one_time entries carry the VIEW-RANGE APPORTIONED `amountWon` plus the
 * STORED ORIGINAL total in optional `originalAmountWon` (server fills it;
 * absent on old fixtures). The amount input always edits the original total:
 * it is locked only for legacy partial entries without the original field,
 * where writing back the apportioned value would corrupt the stored total.
 */
"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAutosave } from "@/components/autosave/useAutosave";
import { useDirtyEntry } from "@/components/DirtyGuard";
import { isValidIsoDate } from "@/app/(app)/db/_lib/db-autosave";
import type { RecognizedExpense } from "@/types/expense-ledger";

export interface ExpenseEntryPayload {
  categoryId: string;
  itemName: string;
  amountText: string;
  periodStart: string;
  periodEnd: string;
}

/** Stored original total when the server provides it, else the shown amount. */
export function originalTotalOf(entry: RecognizedExpense): number {
  if (entry.source === "one_time" && entry.originalAmountWon != null) return entry.originalAmountWon;
  return entry.amountWon;
}

export function toEntryPayload(entry: RecognizedExpense): ExpenseEntryPayload {
  return {
    categoryId: entry.categoryId,
    itemName: entry.itemName,
    amountText: String(originalTotalOf(entry)),
    periodStart: entry.periodStart,
    periodEnd: entry.periodEnd,
  };
}

function lastDayOfMonth(month: string): string {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

function todayLocal(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * True when entry.amountWon is only the view-range recognized portion, not
 * the stored original total (period extends beyond the view range).
 */
export function isPartiallyRecognized(
  entry: Pick<RecognizedExpense, "periodStart" | "periodEnd">,
  view: string,
  month: string | null,
): boolean {
  if (view === "month" && month) {
    return entry.periodStart < `${month}-01` || entry.periodEnd > lastDayOfMonth(month);
  }
  return entry.periodEnd > todayLocal();
}

/**
 * Amount is locked ONLY for legacy partial entries that lack the original
 * total (old fixtures without `originalAmountWon`). When the original is
 * present the full total is editable even for prorated months.
 */
export function isExpenseAmountLocked(
  entry: RecognizedExpense,
  view: string,
  month: string | null,
): boolean {
  const hasOriginal = entry.source === "one_time" && entry.originalAmountWon != null;
  if (hasOriginal) return false;
  return isPartiallyRecognized(entry, view, month);
}

export interface EntryCheck {
  ok: boolean;
  error: string | null;
  amountWon: number | null;
}

export function validateExpenseEntryDraft(
  draft: ExpenseEntryPayload,
  opts: { amountLocked: boolean; categoryIds: Set<string> },
): EntryCheck {
  const name = draft.itemName.trim();
  if (name.length < 1 || name.length > 100) {
    return { ok: false, error: "항목 이름을 1~100자로 입력해 주세요.", amountWon: null };
  }
  if (!draft.categoryId || !opts.categoryIds.has(draft.categoryId)) {
    return { ok: false, error: "카테고리를 선택해 주세요.", amountWon: null };
  }
  let amountWon: number | null = null;
  if (!opts.amountLocked) {
    const raw = draft.amountText.trim();
    if (!/^\d+$/.test(raw)) {
      return { ok: false, error: "금액을 1원 이상 숫자로 입력해 주세요.", amountWon: null };
    }
    const n = Number(raw);
    if (!Number.isSafeInteger(n) || n < 1) {
      return { ok: false, error: "금액을 1원 이상 숫자로 입력해 주세요.", amountWon: null };
    }
    amountWon = n;
  }
  if (!isValidIsoDate(draft.periodStart)) {
    return { ok: false, error: "시작일을 올바르게 입력해 주세요.", amountWon };
  }
  if (!isValidIsoDate(draft.periodEnd)) {
    return { ok: false, error: "종료일을 올바르게 입력해 주세요.", amountWon };
  }
  if (draft.periodEnd < draft.periodStart) {
    return { ok: false, error: "종료일은 시작일보다 빠를 수 없습니다.", amountWon };
  }
  return { ok: true, error: null, amountWon };
}

export interface ParsedEntry {
  categoryId: string;
  itemName: string;
  amountWon: number | null;
  periodStart: string;
  periodEnd: string;
}

/**
 * Minimal PATCH body: only changed fields. Dates are always paired so a
 * start-only change never collapses the stored end (server defaults a missing
 * periodEnd to periodStart). amountWon is never sent while locked.
 */
export function buildExpensePatch(
  draft: ParsedEntry,
  base: ParsedEntry,
  amountLocked: boolean,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (draft.itemName !== base.itemName) body.itemName = draft.itemName;
  if (draft.categoryId !== base.categoryId) body.categoryId = draft.categoryId;
  if (!amountLocked && draft.amountWon !== null && draft.amountWon !== base.amountWon) {
    body.amountWon = draft.amountWon;
  }
  if (draft.periodStart !== base.periodStart || draft.periodEnd !== base.periodEnd) {
    body.periodStart = draft.periodStart;
    body.periodEnd = draft.periodEnd;
  }
  return body;
}

function friendlyPatchError(e: unknown): string {
  const m = e instanceof Error ? e.message : "";
  if (m.includes("expense_entry_not_found")) return "이미 삭제된 비용이에요.";
  if (m.includes("expense_category_not_found")) return "카테고리를 다시 선택해 주세요.";
  if (m.includes("expense_invalid_period")) return "인식 기간이 너무 깁니다.";
  if (m.includes("invalid_request")) return "입력을 확인해 주세요.";
  if (/HTTP \d+/.test(m) || !m) return "비용을 저장하지 못했습니다. 입력은 그대로 있어요.";
  return m;
}

async function patchExpenseEntry(id: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`/api/expenses/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const detail = typeof (data as { error?: unknown }).error === "string"
      ? (data as { error: string }).error
      : `HTTP ${res.status}`;
    throw new Error(detail);
  }
}

interface Options {
  entry: RecognizedExpense;
  view: string;
  month: string | null;
  categoryIds: string[];
}

/**
 * Query client when mounted under a provider (production always is); null in
 * provider-less hosts such as other scopes' unit tests — invalidation is
 * then skipped and the editor still edits safely.
 */
function useOptionalQueryClient() {
  try {
    return useQueryClient();
  } catch {
    return null;
  }
}

export function useExpenseEntryAutosave({ entry, view, month, categoryIds }: Options) {
  const client = useOptionalQueryClient();
  const categorySet = useMemo(() => new Set(categoryIds), [categoryIds]);
  const amountLocked = isExpenseAmountLocked(entry, view, month);

  const baseRef = useRef<ParsedEntry | null>(null);
  baseRef.current = {
    categoryId: entry.categoryId,
    itemName: entry.itemName.trim(),
    amountWon: /^\d+$/.test(String(originalTotalOf(entry))) ? Number(originalTotalOf(entry)) : null,
    periodStart: entry.periodStart,
    periodEnd: entry.periodEnd,
  };
  const lockedRef = useRef(amountLocked);
  lockedRef.current = amountLocked;
  const categorySetRef = useRef(categorySet);
  categorySetRef.current = categorySet;

  const save = useCallback(async ({ target, payload }: {
    target: Record<string, string | number | boolean | null | undefined>;
    payload: ExpenseEntryPayload;
  }) => {
    const base = baseRef.current!;
    const parsed: ParsedEntry = {
      categoryId: payload.categoryId,
      itemName: payload.itemName.trim(),
      amountWon: /^\d+$/.test(payload.amountText.trim()) ? Number(payload.amountText.trim()) : null,
      periodStart: payload.periodStart,
      periodEnd: payload.periodEnd,
    };
    const body = buildExpensePatch(parsed, base, lockedRef.current);
    if (Object.keys(body).length === 0) return;
    try {
      await patchExpenseEntry(String(target.id), body);
    } catch (e) {
      throw new Error(friendlyPatchError(e));
    }
    // Server ACKed: refresh ledger + dashboard caches. Refetch merges through
    // syncServer below, so pending newer edits are never clobbered.
    void client?.invalidateQueries({ queryKey: ["expense-ledger"] });
    void client?.invalidateQueries({ queryKey: ["dashboard"] });
  }, [client]);

  const auto = useAutosave<ExpenseEntryPayload>({
    target: { kind: "expense-entry", id: entry.id },
    initial: toEntryPayload(entry),
    save,
  });

  // Refetch merge: adopt the new server baseline, keep an unsent draft.
  const serverKey = JSON.stringify(toEntryPayload(entry));
  const firstKey = useRef(serverKey);
  useEffect(() => {
    if (serverKey === firstKey.current) return;
    firstKey.current = serverKey;
    auto.syncServer(toEntryPayload(entry));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey]);

  const validate = useCallback((draft: ExpenseEntryPayload) =>
    validateExpenseEntryDraft(draft, { amountLocked: lockedRef.current, categoryIds: categorySetRef.current }),
  [ ]);

  const stageField = useCallback((patch: Partial<ExpenseEntryPayload>) => {
    auto.stage({ ...auto.draft, ...patch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto.draft, auto.stage]);

  /**
   * Whole-group commit (blur leaving the group, or Enter). Returns the
   * validation message when invalid (nothing scheduled, no PATCH), else null.
   */
  const commitGroup = useCallback((): string | null => {
    const check = validate(auto.draft);
    if (!check.ok) {
      auto.commit(false, check.error ?? "입력을 확인해 주세요.");
      return check.error ?? "입력을 확인해 주세요.";
    }
    auto.commit(true);
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto.draft, auto.commit, validate]);

  const discardEdits = useCallback(() => {
    auto.discard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto.discard]);

  // Save-and-leave: validate first, then commit the staged group and flush.
  // Invalid/failed leaves keep the draft for retry; nothing is discarded here.
  useDirtyEntry(`expense-entry:${entry.id}`, auto.dirty, async () => {
    const check = validate(auto.draft);
    if (!check.ok) throw new Error(check.error ?? "입력을 확인해 주세요.");
    auto.commit(true);
    await auto.flush();
  }, discardEdits, "비용 항목 수정");

  return {
    draft: auto.draft,
    status: auto.status,
    error: auto.error,
    dirty: auto.dirty,
    savedAt: auto.savedAt,
    canUndo: auto.canUndo,
    amountLocked,
    stageField,
    commitGroup,
    retry: auto.retry,
    undo: auto.undo,
  };
}
