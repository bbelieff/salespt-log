/**
 * Scope B autosave core — expense ledger one-off costs.
 *
 * Pure status checks for deliberate one-off creation. Recurring rules,
 * reclassification, deletes, and future-installment changes stay explicit and
 * are NOT covered here. Shared identity/signature helpers live in the DB
 * scope-local module (same scope B ownership).
 */
import { isValidIsoDate } from "@/app/(app)/db/_lib/db-autosave";

export type ExpenseDraftStatus = "empty" | "partial" | "invalid" | "valid";

export interface ExpenseDraftCheck {
  status: ExpenseDraftStatus;
  reason: string | null;
}

export interface OneTimeExpenseDraft {
  categoryId: string;
  itemName: string;
  amountWon: number;
  start: string;
  end: string;
  range: boolean;
}

/**
 * One-off creation gate. Initial-hydration defaults (no category, blank name,
 * zero amount) are "empty" and never create. Malformed/incoherent dates are
 * "invalid" and never sent. Everything in between is "partial" (kept, not sent).
 */
export function oneTimeExpenseCheck(draft: OneTimeExpenseDraft): ExpenseDraftCheck {
  if (!isValidIsoDate(draft.start)) {
    return { status: "invalid", reason: "발생일을 올바르게 입력해 주세요." };
  }
  if (draft.range) {
    if (!isValidIsoDate(draft.end)) {
      return { status: "invalid", reason: "기간 종료일을 올바르게 입력해 주세요." };
    }
    if (draft.end < draft.start) {
      return { status: "invalid", reason: "종료일은 시작일보다 빠를 수 없습니다." };
    }
  }
  const touched =
    draft.categoryId !== "" ||
    draft.itemName.trim() !== "" ||
    (Number.isFinite(draft.amountWon) && draft.amountWon !== 0);
  if (!touched) return { status: "empty", reason: null };
  if (!draft.categoryId || draft.itemName.trim() === "") {
    return { status: "partial", reason: "카테고리, 항목을 입력해 주세요." };
  }
  if (!Number.isFinite(draft.amountWon) || draft.amountWon < 1) {
    return { status: "partial", reason: "부가세 제외 금액을 입력해 주세요." };
  }
  return { status: "valid", reason: null };
}

/** Category rename autosaves only when the name actually changed and is usable. */
export function shouldAutosaveRename(selectedName: string, renameName: string): boolean {
  const next = renameName.trim();
  return next !== "" && next !== selectedName && next.length <= 40;
}
