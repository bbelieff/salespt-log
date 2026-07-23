// @vitest-environment jsdom

import * as React from "react";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import DashboardProgressBanner from "@/components/dashboard/DashboardProgressBanner";
import ExpenseLedgerDialog from "@/components/dashboard/expense-ledger/ExpenseLedgerDialog";

// Vitest preserves JSX in this project while Next supplies the automatic runtime.
// Supply that runtime only to this DOM test; production bundles remain unchanged.
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

vi.mock("@/query/expense-ledger-hooks", () => {
  const idleMutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  return {
    useExpenseCategories: () => ({ data: [], isLoading: false }),
    useExpenseLedger: () => ({
      data: {
        view: "month",
        month: "2026-07",
        categories: [],
        entries: [{
          id: "entry-1",
          source: "one_off",
          categoryId: "category-1",
          categoryName: "임차료",
          itemName: "사무실 임대료",
          amountWon: 66,
          periodStart: "2026-07-31",
          periodEnd: "2026-08-02",
        }],
        categoryTotals: [{ categoryId: "category-1", categoryName: "임차료", amountWon: 66 }],
        additionalCostTotal: 66,
      },
      isLoading: false,
      error: null,
    }),
    useCreateCategory: idleMutation,
    useCreateExpense: idleMutation,
    useCreateRecurringRule: idleMutation,
    usePatchCategory: idleMutation,
    usePatchRecurringRule: idleMutation,
    useRecurringRules: () => ({ data: { rules: [] }, isLoading: false }),
    useRecurringRuleAction: idleMutation,
  };
});

const bannerProps = {
  dbCostTotal: 3_000,
  additionalCost: 500 as number | null,
  onOpenExpenseLedger: vi.fn(),
  today: "7/23",
  weekday: "목",
  currentWeek: 8,
  startDate: "5/15",
  progressPercent: 100,
  graduationDate: "7/4",
  revenue: 10_000,
  cost: 3_500,
  feeIncome: 10_000,
  commissionIncome: 0,
};

let root: Root | undefined;
let container: HTMLDivElement | undefined;

function render(element: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(element));
  return container;
}

function changeInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("HTML input value setter is unavailable");
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  vi.clearAllMocks();
});

describe("expense ledger dashboard UI", () => {
  it("uses a labeled native button as the cost-card trigger", () => {
    const onOpenExpenseLedger = vi.fn();
    const view = render(createElement(DashboardProgressBanner, { ...bannerProps, onOpenExpenseLedger }));

    const trigger = view.querySelector<HTMLButtonElement>('button[aria-label="비용 추가하기: 비용 원장 열기"]');
    expect(trigger).not.toBeNull();
    expect(trigger?.type).toBe("button");

    act(() => trigger?.click());
    expect(onOpenExpenseLedger).toHaveBeenCalledOnce();
  });

  it("does not fabricate a complete additional-cost amount when it is unavailable", () => {
    const view = render(createElement(DashboardProgressBanner, { ...bannerProps, additionalCost: null }));

    expect(view.textContent).toContain("추가 비용을 확인하지 못했습니다. 다시 시도해 주세요.");
    expect(view.textContent).not.toContain("추가 비용 ₩");
    expect(view.textContent).toContain("DB 비용 합계 ₩3,000");
  });

  it("shows the inclusive daily-allocation preview and the exact recognized total returned by the ledger", () => {
    render(createElement(ExpenseLedgerDialog, { open: true, onClose: vi.fn(), dbCostTotal: 3_000, additionalCost: 66 }));

    const rangeRadio = document.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1];
    if (!rangeRadio) throw new Error("range radio is missing");
    act(() => rangeRadio.click());

    const dateInputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
    if (dateInputs.length !== 2) throw new Error("date range inputs are missing");
    changeInput(dateInputs[0]!, "2026-07-31");
    changeInput(dateInputs[1]!, "2026-08-02");

    const amountInput = document.querySelector<HTMLInputElement>('[aria-label="부가세 제외 비용 금액"]');
    if (!amountInput) throw new Error("amount input is missing");
    changeInput(amountInput, "100");

    expect(document.body.textContent).toContain("3일 × ₩33 + 잔여 ₩1 (시작일 우선)");
    expect(document.body.textContent).toContain("2026-07-31 ~ 2026-08-02");
    expect(document.body.textContent).toContain("추가 비용 합계₩66");
  });
});
