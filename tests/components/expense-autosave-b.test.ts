// @vitest-environment jsdom

/**
 * Scope B autosave — expense ledger behavioral regressions.
 *
 * Real component behavior: one-off costs auto-record exactly once after
 * deliberate completed input (debounce / group blur / submit race), never from
 * hydration/defaults/empty/partial/invalid; failure preserves input with a
 * visible retry; recurring rules stay explicit; category rename autosaves on
 * blur/Enter while the input stays editable during saving.
 */
import * as React from "react";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExpenseLedgerDialog from "@/components/dashboard/expense-ledger/ExpenseLedgerDialog";
import ExpenseCategoryPicker from "@/components/dashboard/expense-ledger/ExpenseCategoryPicker";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const categories = [
  { id: "category-marketing", name: "마케팅", isSystem: false, deletedAt: null, archivedAt: null, createdAt: "2026-07-01", updatedAt: "2026-07-01" },
  { id: "category-unclassified", name: "미분류", isSystem: true, deletedAt: null, archivedAt: null, createdAt: "2026-07-01", updatedAt: "2026-07-01" },
];

let createExpenseMutation!: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };
let createRecurringRuleMutation!: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };
let patchCategoryMutation!: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };

vi.mock("@/query/expense-ledger-hooks", () => {
  const idleMutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(async () => undefined), isPending: false });
  return {
    useExpenseCategories: () => ({ data: categories, isLoading: false, isFetching: false, isSuccess: true, error: null, refetch: vi.fn() }),
    useExpenseCategoryUsage: () => ({ data: undefined, isLoading: false, isFetching: false, isSuccess: false, error: null, refetch: vi.fn() }),
    useExpenseLedger: () => ({ data: { view: "month", month: "2026-09", categories, entries: [], categoryTotals: [], additionalCostTotal: 0 }, isLoading: false, error: null }),
    useCreateCategory: idleMutation,
    useDeleteCategory: idleMutation,
    useDeleteRecurringRule: idleMutation,
    useCreateExpense: () => createExpenseMutation,
    usePatchExpense: idleMutation,
    useCreateRecurringRule: () => createRecurringRuleMutation,
    usePatchCategory: () => patchCategoryMutation,
    usePatchRecurringRule: idleMutation,
    useReclassifyUnclassified: idleMutation,
    useRecurringRules: () => ({ data: { rules: [] }, isLoading: false, isFetching: false, isSuccess: true, error: null, refetch: vi.fn() }),
    useRecurringRuleAction: idleMutation,
  };
});

const dialogProps = { open: true, onClose: vi.fn(), dbCostTotal: 3_000, additionalCost: 300 };

let root: Root | undefined;
let container: HTMLDivElement | undefined;

function render(element: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(element));
}
function rerender(element: ReactNode) {
  act(() => root?.render(element));
}
function changeInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("HTML input value setter is unavailable");
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
function clickButton(name: string) {
  const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (candidate) => candidate.textContent?.trim() === name,
  );
  if (!button) throw new Error(`button '${name}' is missing`);
  act(() => button.click());
  return button;
}
/** Deliberately complete the one-off group: category + item + amount (dates default to today). */
function fillOneTime() {
  act(() => document.querySelector<HTMLButtonElement>('[role="combobox"]')?.click());
  const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((candidate) =>
    candidate.textContent?.includes("마케팅"),
  );
  act(() => option?.click());
  changeInput(document.querySelector<HTMLInputElement>('input[placeholder="예: 사무실 임차료"]')!, "검증 비용");
  changeInput(document.querySelector<HTMLInputElement>('[aria-label="부가세 제외 비용 금액"]')!, "100000");
}
/** Focus leaves the whole record form (not a hop between its fields). */
function blurRecordForm() {
  const form = document.querySelector('form#expense-record-form');
  if (!form) throw new Error("expense record form is missing");
  const outside = document.createElement("button");
  document.body.append(outside);
  act(() => {
    form.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: outside }));
  });
  outside.remove();
}
function advance(ms: number) {
  return act(async () => {
    vi.advanceTimersByTime(ms);
  });
}
function settle() {
  return act(async () => {});
}

beforeEach(() => {
  vi.useFakeTimers();
  createExpenseMutation = { mutateAsync: vi.fn(async () => ({ expense: { id: "e1" } })), isPending: false };
  createRecurringRuleMutation = { mutateAsync: vi.fn(async () => ({ rule: { id: "r1" } })), isPending: false };
  patchCategoryMutation = { mutateAsync: vi.fn(async () => ({})), isPending: false };
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("one-off expense autosave", () => {
  it("retains the operation key and draft after a failed create, close, and reopen", async () => {
    createExpenseMutation.mutateAsync.mockRejectedValueOnce(new Error("lost ACK"));
    render(createElement(ExpenseLedgerDialog, dialogProps));
    fillOneTime(); blurRecordForm(); await settle();
    const firstKey = createExpenseMutation.mutateAsync.mock.calls[0]?.[0]?.idempotencyKey;
    expect(firstKey).toBeTruthy();
    rerender(createElement(ExpenseLedgerDialog, { ...dialogProps, open: false }));
    rerender(createElement(ExpenseLedgerDialog, dialogProps));
    await advance(1000);
    expect(createExpenseMutation.mutateAsync).toHaveBeenCalledTimes(1);
    expect(document.querySelector<HTMLInputElement>('input[placeholder="예: 사무실 임차료"]')?.value).toBe("검증 비용");
    blurRecordForm(); await settle();
    expect(createExpenseMutation.mutateAsync).toHaveBeenCalledTimes(2);
    expect(createExpenseMutation.mutateAsync.mock.calls[1]?.[0]?.idempotencyKey).toBe(firstKey);
  });

  it("has no generic save footer and never creates from initial render", async () => {
    render(createElement(ExpenseLedgerDialog, dialogProps));
    expect(document.querySelector('button[form="expense-record-form"]')).toBeNull();
    expect(document.body.textContent).not.toContain("비용 저장");
    await advance(3000);
    blurRecordForm();
    await settle();
    expect(createExpenseMutation.mutateAsync).not.toHaveBeenCalled();
  });

  it("records a deliberately completed group exactly once across blur, debounce, and submit", async () => {
    render(createElement(ExpenseLedgerDialog, dialogProps));
    fillOneTime();
    blurRecordForm();
    await settle();
    expect(createExpenseMutation.mutateAsync).toHaveBeenCalledTimes(1);
    expect(createExpenseMutation.mutateAsync.mock.calls[0]?.[0]).toMatchObject({
      categoryId: "category-marketing",
      itemName: "검증 비용",
      amountWon: 100000,
      idempotencyKey: expect.any(String),
    });
    // Repeated exits and timer runs with the same bytes never duplicate.
    blurRecordForm();
    await advance(3000);
    blurRecordForm();
    await act(async () => {
      document.querySelector("form#expense-record-form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(createExpenseMutation.mutateAsync).toHaveBeenCalledTimes(1);
    // Success clears the item/amount so the next deliberate input is a new record.
    expect(document.querySelector<HTMLInputElement>('input[placeholder="예: 사무실 임차료"]')?.value).toBe("");
  });

  it("does not create while typing; a completed group exit creates once", async () => {
    render(createElement(ExpenseLedgerDialog, dialogProps));
    fillOneTime();
    await advance(1000);
    expect(createExpenseMutation.mutateAsync).not.toHaveBeenCalled();
    blurRecordForm();
    await settle();
    expect(createExpenseMutation.mutateAsync).toHaveBeenCalledTimes(1);
  });

  it("never creates from partial or invalid input and preserves it", async () => {
    render(createElement(ExpenseLedgerDialog, dialogProps));
    changeInput(document.querySelector<HTMLInputElement>('input[placeholder="예: 사무실 임차료"]')!, "미완성");
    await advance(2000);
    blurRecordForm();
    await settle();
    expect(createExpenseMutation.mutateAsync).not.toHaveBeenCalled();
    expect(document.querySelector<HTMLInputElement>('input[placeholder="예: 사무실 임차료"]')?.value).toBe("미완성");

    const dates = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
    changeInput(dates[0]!, "");
    expect(document.body.textContent).toContain("발생일을 올바르게 입력해 주세요.");
    await advance(2000);
    blurRecordForm();
    await settle();
    expect(createExpenseMutation.mutateAsync).not.toHaveBeenCalled();
  });

  it("keeps the input and offers retry after failure, then succeeds once", async () => {
    createExpenseMutation.mutateAsync.mockRejectedValueOnce(new Error("ledger busy"));
    render(createElement(ExpenseLedgerDialog, dialogProps));
    fillOneTime();
    blurRecordForm();
    await settle();
    expect(createExpenseMutation.mutateAsync).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain("다시 시도");
    expect(document.querySelector<HTMLInputElement>('input[placeholder="예: 사무실 임차료"]')?.value).toBe("검증 비용");
    await act(async () => {
      clickButton("다시 시도");
    });
    expect(createExpenseMutation.mutateAsync).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).toContain("비용을 기록했습니다.");
  });

  it("does not resurrect a stale touched draft after close and reopen without new edits", async () => {
    const dialog = (open: boolean) => createElement(ExpenseLedgerDialog, { ...dialogProps, open });
    render(dialog(true));
    changeInput(document.querySelector<HTMLInputElement>('input[placeholder="예: 사무실 임차료"]')!, "보류");
    rerender(dialog(false));
    rerender(dialog(true));
    await advance(2000);
    blurRecordForm();
    await settle();
    expect(createExpenseMutation.mutateAsync).not.toHaveBeenCalled();
    // Completing the draft after reopen is a new deliberate input → records once.
    fillOneTime();
    blurRecordForm();
    await settle();
    expect(createExpenseMutation.mutateAsync).toHaveBeenCalledTimes(1);
  });
});

describe("recurring rules stay explicit", () => {
  it("never auto-creates on blur and registers once through the compact semantic action", async () => {
    render(createElement(ExpenseLedgerDialog, dialogProps));
    fillOneTime();
    clickButton("매월 반복");
    await advance(2000);
    blurRecordForm();
    await settle();
    expect(createRecurringRuleMutation.mutateAsync).not.toHaveBeenCalled();
    expect(createExpenseMutation.mutateAsync).not.toHaveBeenCalled();
    const register = [...document.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "매월 반복 등록",
    );
    expect(register).not.toBeUndefined();
    await act(async () => {
      register?.click();
    });
    expect(createRecurringRuleMutation.mutateAsync).toHaveBeenCalledTimes(1);
    expect(createRecurringRuleMutation.mutateAsync.mock.calls[0]?.[0]).toMatchObject({
      itemName: "검증 비용",
      idempotencyKey: expect.any(String),
    });
  });
});

describe("category rename autosave", () => {
  const pickerProps = () => ({
    categories,
    value: "category-marketing",
    busy: false,
    loading: false,
    loaded: true,
    errorMessage: null,
    retrying: false,
    unclassifiedRefs: [],
    onRetry: vi.fn(),
    onChange: vi.fn(),
    onCreate: vi.fn(async (name: string) => ({ ...categories[0]!, id: "new-category", name })),
    onRename: vi.fn(async () => undefined),
    onDelete: vi.fn(async () => ({ ok: true as const, deletedCategoryId: "category-marketing", unclassifiedCategoryId: "category-unclassified", movedEntryCount: 0, movedRuleCount: 0, movedOccurrenceCount: 0 })),
    onReclassify: vi.fn(async () => ({ ok: true as const, operationId: "test-operation", unclassifiedCategoryId: "category-unclassified", targetCategoryId: "category-marketing", movedEntryCount: 0, movedRuleCount: 0, movedOccurrenceCount: 0 })),
    onMessage: vi.fn(),
  });

  it("has no rename button and autosaves on blur while staying editable", async () => {
    const onRename = vi.fn(async () => undefined);
    render(createElement(ExpenseCategoryPicker, { ...pickerProps(), onRename }));
    act(() => document.querySelector<HTMLButtonElement>('[role="combobox"]')?.click());
    expect([...document.querySelectorAll("button")].some((b) => b.textContent?.trim() === "이름 변경")).toBe(false);
    const input = document.querySelector<HTMLInputElement>('[aria-label="선택 카테고리 이름 수정"]')!;
    // Untouched blur sends nothing.
    act(() => {
      input.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: document.body }));
    });
    await settle();
    expect(onRename).not.toHaveBeenCalled();
    changeInput(input, "퍼포먼스 마케팅");
    expect(input.disabled).toBe(false);
    act(() => {
      input.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: document.body }));
    });
    await settle();
    expect(onRename).toHaveBeenCalledWith("category-marketing", "퍼포먼스 마케팅");
  });

  it("keeps the text and surfaces the error when rename fails", async () => {
    const onRename = vi.fn(async () => {
      throw new Error("HTTP 503 database unavailable");
    });
    render(createElement(ExpenseCategoryPicker, { ...pickerProps(), onRename }));
    act(() => document.querySelector<HTMLButtonElement>('[role="combobox"]')?.click());
    const input = document.querySelector<HTMLInputElement>('[aria-label="선택 카테고리 이름 수정"]')!;
    changeInput(input, "실패 이름");
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await settle();
    expect(onRename).toHaveBeenCalledWith("category-marketing", "실패 이름");
    expect(document.body.textContent).toContain("카테고리 분류를 완료하지 못했습니다.");
    expect(document.body.textContent).not.toContain("database unavailable");
    expect(input.value).toBe("실패 이름");
  });
});
