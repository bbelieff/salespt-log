// @vitest-environment jsdom

import * as React from "react";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import DashboardProgressBanner from "@/components/dashboard/DashboardProgressBanner";
import ExpenseCategoryPicker from "@/components/dashboard/expense-ledger/ExpenseCategoryPicker";
import ExpenseLedgerDialog from "@/components/dashboard/expense-ledger/ExpenseLedgerDialog";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const categories = [
  { id: "category-marketing", name: "마케팅", archivedAt: null, createdAt: "2026-07-01", updatedAt: "2026-07-01" },
  { id: "category-labor", name: "인건비", archivedAt: null, createdAt: "2026-07-01", updatedAt: "2026-07-01" },
  { id: "category-rent", name: "임차료", archivedAt: null, createdAt: "2026-07-01", updatedAt: "2026-07-01" },
];

const recurringRuleFixtures = [
  { id: "rule-active", categoryName: "인건비", itemName: "운영 인력", amountWon: 108, status: "active", currentOccurrence: null, nextOccurrence: { occurrenceDate: "2026-08-24", occurrenceMonth: "2026-08", status: "scheduled" } },
  { id: "rule-archived", categoryName: "임차료", itemName: "보관된 임대료", amountWon: 72, status: "archived", currentOccurrence: null, nextOccurrence: null },
];

const ledgerFixture = {
  view: "month",
  month: "2026-07",
  selectedScope: { view: "month", month: "2026-07", categoryId: null, label: "2026년 7월" },
  categories,
  entries: [
    { id: "system:db_purchase", source: "db_purchase", categoryId: "system:db_purchase", categoryName: "매입DB", itemName: "매입DB", amountWon: 1_080_000, periodStart: "2026-07-01", periodEnd: "2026-07-31", system: true, readOnly: true, recognitionStatus: "recognized_on_date", recognitionNote: null },
    { id: "system:db_production", source: "db_production", categoryId: "system:db_production", categoryName: "직접생산", itemName: "직접생산", amountWon: 200_000, periodStart: "2026-07-01", periodEnd: "2026-07-31", system: true, readOnly: true, recognitionStatus: "allocated", recognitionNote: "기간에 일할 배분" },
    { id: "system:db_banner", source: "db_banner", categoryId: "system:db_banner", categoryName: "현수막", itemName: "현수막", amountWon: 100_000, periodStart: "2026-07-15", periodEnd: "2026-07-15", system: true, readOnly: true, recognitionStatus: "recognized_on_date", recognitionNote: null },
    { id: "entry-1", source: "one_time", categoryId: "category-marketing", categoryName: "마케팅", itemName: "광고비", amountWon: 120_000, periodStart: "2026-07-31", periodEnd: "2026-08-02", system: false, readOnly: false, recognitionStatus: "allocated", recognitionNote: null },
    { id: "entry-2", source: "recurring", categoryId: "category-labor", categoryName: "인건비", itemName: "운영 인력", amountWon: 108_000, periodStart: "2026-07-31", periodEnd: "2026-07-31", system: false, readOnly: false, recognitionStatus: "recognized_on_date", recognitionNote: null },
    { id: "entry-3", source: "one_time", categoryId: "category-rent", categoryName: "임차료", itemName: "사무실 임대료", amountWon: 72_000, periodStart: "2026-07-31", periodEnd: "2026-07-31", system: false, readOnly: false, recognitionStatus: "recognized_on_start", recognitionNote: null },
  ],
  categoryTotals: [
    { categoryId: "system:db_purchase", categoryName: "매입DB", amountWon: 1_080_000, itemCount: 1, sharePercent: 64.29, system: true, archived: false },
    { categoryId: "system:db_production", categoryName: "직접생산", amountWon: 200_000, itemCount: 1, sharePercent: 11.9, system: true, archived: false },
    { categoryId: "category-marketing", categoryName: "마케팅", amountWon: 120_000, itemCount: 1, sharePercent: 7.14, system: false, archived: false },
    { categoryId: "category-labor", categoryName: "인건비", amountWon: 108_000, itemCount: 1, sharePercent: 6.43, system: false, archived: false },
    { categoryId: "system:db_banner", categoryName: "현수막", amountWon: 100_000, itemCount: 1, sharePercent: 5.95, system: true, archived: false },
    { categoryId: "category-rent", categoryName: "임차료", amountWon: 72_000, itemCount: 1, sharePercent: 4.29, system: false, archived: true },
    { categoryId: "__unclassified__", categoryName: "미분류", amountWon: 0, itemCount: 0, sharePercent: 0, system: false, archived: false },
  ],
  dbCostTotal: 1_380_000,
  additionalCostTotal: 300_000,
  totalCost: 1_680_000,
};

interface QueryMock<T> { data: T | undefined; isLoading: boolean; isFetching: boolean; isSuccess: boolean; error: Error | null; refetch: ReturnType<typeof vi.fn> }

let categoryQueryState: QueryMock<typeof categories>;
let recurringQueryState: QueryMock<{ rules: typeof recurringRuleFixtures }>;
let ledgerQueryState: QueryMock<typeof ledgerFixture>;
let deleteRecurringRuleMutation: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };
let createExpenseMutation: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean }; let createRecurringRuleMutation: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };

function resetQueryStates() {
  categoryQueryState = { data: categories, isLoading: false, isFetching: false, isSuccess: true, error: null, refetch: vi.fn() };
  recurringQueryState = { data: { rules: recurringRuleFixtures }, isLoading: false, isFetching: false, isSuccess: true, error: null, refetch: vi.fn() };
  ledgerQueryState = { data: ledgerFixture, isLoading: false, isFetching: false, isSuccess: true, error: null, refetch: vi.fn() };
  deleteRecurringRuleMutation = { mutateAsync: vi.fn().mockResolvedValue({ ok: true }), isPending: false };
  createExpenseMutation = { mutateAsync: vi.fn().mockResolvedValue({ expense: {} }), isPending: false };
  createRecurringRuleMutation = { mutateAsync: vi.fn().mockResolvedValue({ rule: { id: "new-rule" } }), isPending: false };
}

resetQueryStates();

vi.mock("@/query/expense-ledger-hooks", () => {
  const idleMutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  return {
    useExpenseCategories: () => categoryQueryState,
    useExpenseLedger: () => ledgerQueryState,
    useCreateCategory: idleMutation,
    useDeleteRecurringRule: () => deleteRecurringRuleMutation,
    useCreateExpense: () => createExpenseMutation,
    useCreateRecurringRule: () => createRecurringRuleMutation,
    usePatchCategory: idleMutation,
    usePatchRecurringRule: idleMutation,
    useRecurringRules: () => recurringQueryState,
    useRecurringRuleAction: idleMutation,
  };
});

const bannerProps = { dbCostTotal: 3_000, additionalCost: 500 as number | null, onOpenExpenseLedger: vi.fn(), today: "7/23", weekday: "목", currentWeek: 8, startDate: "5/15", progressPercent: 100, graduationDate: "7/4", revenue: 10_000, cost: 3_500, feeIncome: 10_000, commissionIncome: 0 };

let root: Root | undefined; let container: HTMLDivElement | undefined;

function render(element: ReactNode) { container = document.createElement("div"); document.body.append(container); root = createRoot(container); act(() => root?.render(element)); return container; }
function rerender(element: ReactNode) { act(() => root?.render(element)); }

function changeInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("HTML input value setter is unavailable");
  act(() => { setter.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
}

function clickButton(name: string) {
  const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find((candidate) => candidate.textContent?.trim() === name);
  if (!button) throw new Error(`button '${name}' is missing`);
  act(() => button.click()); return button;
}

function prepareRequiredExpenseFields() {
  const combobox = document.querySelector<HTMLButtonElement>('[role="combobox"]');
  act(() => combobox?.click());
  const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((candidate) => candidate.textContent?.includes("마케팅"));
  act(() => option?.click());
  changeInput(document.querySelector<HTMLInputElement>('input[placeholder="예: 사무실 임차료"]')!, "검증 비용");
  changeInput(document.querySelector<HTMLInputElement>('[aria-label="부가세 제외 비용 금액"]')!, "100");
}

function clearDateWithKeyboard(input: HTMLInputElement) { act(() => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }))); changeInput(input, ""); }
async function submitRecordForm() { await act(async () => { document.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }); }

function ruleDetails(itemName: string) {
  const details = [...document.querySelectorAll<HTMLDetailsElement>("details")].find((candidate) => candidate.textContent?.includes(itemName));
  if (!details) throw new Error(`recurring rule '${itemName}' is missing`); return details;
}

function clickRuleButton(itemName: string, name: string) {
  const button = [...ruleDetails(itemName).querySelectorAll<HTMLButtonElement>("button")].find((candidate) => candidate.textContent?.trim() === name);
  if (!button) throw new Error(`button '${name}' for recurring rule '${itemName}' is missing`);
  act(() => button.click()); return button;
}

afterEach(() => { act(() => root?.unmount()); container?.remove(); root = undefined; container = undefined; vi.clearAllMocks(); resetQueryStates(); });

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

  it("uses selected-month totals in cards instead of course-to-date props", () => {
    render(createElement(ExpenseLedgerDialog, { open: true, onClose: vi.fn(), dbCostTotal: 9, additionalCost: 9 }));
    expect(document.body.textContent).toContain("2026년 7월");
    expect(document.body.textContent).toContain("DB 비용₩1,380,000");
    expect(document.body.textContent).toContain("추가 비용₩300,000");
    expect(document.body.textContent).toContain("총비용₩1,680,000");
    expect(document.body.textContent).not.toContain("총비용₩18");
    expect(document.querySelectorAll('[role="tab"][aria-controls]').length).toBe(3);
    expect(document.querySelector('button[form="expense-record-form"]')?.textContent).toBe("비용 저장");
  });

  it("keeps DB-only 1,080,000 plus zero additional cost nonempty and reconciled", () => {
    ledgerQueryState = { ...ledgerQueryState, data: { ...ledgerFixture, entries: [ledgerFixture.entries[0]!], categoryTotals: [ledgerFixture.categoryTotals[0]!], dbCostTotal: 1_080_000, additionalCostTotal: 0, totalCost: 1_080_000 } };
    render(createElement(ExpenseLedgerDialog, { open: true, onClose: vi.fn(), dbCostTotal: 0, additionalCost: 0 }));
    clickButton("조회");
    expect(document.body.textContent).toContain("매입DB");
    expect(document.body.textContent).toContain("₩1,080,000");
    expect(document.body.textContent).not.toContain("해당 조건의 비용이 없습니다.");
    expect(document.body.textContent).toContain("DB 비용₩1,080,000추가 비용₩0총비용₩1,080,000");
  });

  it("keeps one-time inclusive allocation but separates recurring start, optional end, and day 1-31 clamp", () => {
    render(createElement(ExpenseLedgerDialog, { open: true, onClose: vi.fn(), dbCostTotal: 3_000, additionalCost: 300 }));
    clickButton("기간");
    const oneTimeDates = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
    expect(oneTimeDates.length).toBe(2);
    changeInput(oneTimeDates[0]!, "2026-07-31");
    changeInput(oneTimeDates[1]!, "2026-08-02");
    const amountInput = document.querySelector<HTMLInputElement>('[aria-label="부가세 제외 비용 금액"]');
    if (!amountInput) throw new Error("amount input is missing");
    changeInput(amountInput, "100");
    expect(document.body.textContent).toContain("3일 × ₩33 + 잔여 ₩1 (시작일 우선)");

    clickButton("매월 반복");
    expect(document.body.textContent).toContain("반복 시작일");
    expect(document.body.textContent).toContain("반복 종료일 (선택)");
    expect([...document.querySelectorAll("button")].some((button) => button.textContent?.trim() === "당일")).toBe(false);
    const select = document.querySelector<HTMLSelectElement>("select");
    if (!select) throw new Error("anchor-day select is missing");
    act(() => { select.value = "31"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    const recurringDates = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
    changeInput(recurringDates[0]!, "2026-02-01");
    expect(document.body.textContent).toContain("첫 반영 예정일 2026-02-28");
    expect(document.body.textContent).toContain("말일로 자동 보정");
  });

  it("blocks keyboard-cleared one-time day and invalid period dates, then recovers preview and submission", async () => {
    render(createElement(ExpenseLedgerDialog, { open: true, onClose: vi.fn(), dbCostTotal: 3_000, additionalCost: 300 })); prepareRequiredExpenseFields();
    let dates = document.querySelectorAll<HTMLInputElement>('input[type="date"]'); clearDateWithKeyboard(dates[0]!);
    expect(dates[0]?.required).toBe(true); expect(dates[0]?.getAttribute("aria-invalid")).toBe("true");
    expect(document.body.textContent).toContain("발생일을 올바르게 입력해 주세요."); expect(document.body.textContent).not.toMatch(/NaN|-24/);
    expect(document.querySelector<HTMLButtonElement>('button[form="expense-record-form"]')?.disabled).toBe(true); await submitRecordForm(); expect(createExpenseMutation.mutateAsync).not.toHaveBeenCalled();
    clickButton("기간"); dates = document.querySelectorAll<HTMLInputElement>('input[type="date"]'); changeInput(dates[0]!, "2026-07-31"); clearDateWithKeyboard(dates[1]!);
    expect(dates[1]?.required).toBe(true); expect(document.body.textContent).toContain("기간 종료일을 올바르게 입력해 주세요.");
    changeInput(dates[1]!, "2026-07-30"); expect(document.body.textContent).toContain("종료일은 시작일보다 빠를 수 없습니다."); await submitRecordForm(); expect(createExpenseMutation.mutateAsync).not.toHaveBeenCalled();
    changeInput(dates[1]!, "2026-08-02"); expect(document.body.textContent).toContain("3일 × ₩33 + 잔여 ₩1 (시작일 우선)");
    await submitRecordForm(); expect(createExpenseMutation.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ periodStart: "2026-07-31", periodEnd: "2026-08-02" }));
  });

  it("blocks cleared or reversed recurring boundaries while preserving optional end and recovered clamp submission", async () => {
    render(createElement(ExpenseLedgerDialog, { open: true, onClose: vi.fn(), dbCostTotal: 3_000, additionalCost: 300 })); prepareRequiredExpenseFields(); clickButton("매월 반복");
    const dates = document.querySelectorAll<HTMLInputElement>('input[type="date"]'); clearDateWithKeyboard(dates[0]!);
    expect(dates[0]?.required).toBe(true); expect(dates[0]?.getAttribute("aria-invalid")).toBe("true"); expect(document.body.textContent).toContain("반복 시작일을 올바르게 입력해 주세요.");
    expect(document.body.textContent).not.toMatch(/NaN|-24/); await submitRecordForm(); expect(createRecurringRuleMutation.mutateAsync).not.toHaveBeenCalled();
    changeInput(dates[0]!, "2026-02-01"); clearDateWithKeyboard(dates[1]!); expect(dates[1]?.required).toBe(false); expect(dates[1]?.getAttribute("aria-invalid")).toBe("false");
    const select = document.querySelector<HTMLSelectElement>("select")!; act(() => { select.value = "31"; select.dispatchEvent(new Event("change", { bubbles: true })); }); expect(document.body.textContent).toContain("첫 반영 예정일 2026-02-28");
    changeInput(dates[1]!, "2026-01-31"); expect(document.body.textContent).toContain("반복 종료일은 시작일보다 빠를 수 없습니다."); await submitRecordForm(); expect(createRecurringRuleMutation.mutateAsync).not.toHaveBeenCalled();
    changeInput(dates[1]!, "2026-03-31"); await submitRecordForm();
    expect(createRecurringRuleMutation.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ startsOn: "2026-02-01", endsOn: "2026-03-31", anchorDay: 31 }));
  });

  it("uses frozen system and user category totals in cost order", () => {
    render(createElement(ExpenseLedgerDialog, { open: true, onClose: vi.fn(), dbCostTotal: 3_000, additionalCost: 300 }));
    clickButton("조회");
    clickButton("카테고리");
    const table = document.querySelector("table");
    expect(table?.textContent).toContain("카테고리비중항목 수총비용");
    const rows = [...document.querySelectorAll("tbody tr")].map((row) => row.textContent);
    expect(rows).toEqual([
      "매입DB시스템64.3%1건₩1,080,000",
      "직접생산시스템11.9%1건₩200,000",
      "마케팅7.1%1건₩120,000",
      "인건비6.4%1건₩108,000",
      "현수막시스템6%1건₩100,000",
      "임차료보관4.3%1건₩72,000",
      "미분류0%0건₩0",
    ]);
  });

  it("renders system rows read-only with no mutation surfaces and keeps recurring management", () => {
    render(createElement(ExpenseLedgerDialog, { open: true, onClose: vi.fn(), dbCostTotal: 3_000, additionalCost: 300 }));
    clickButton("조회");
    expect(document.querySelectorAll("details summary").length).toBe(6);
    const purchase = [...document.querySelectorAll("details")].find((details) => details.textContent?.includes("매입DB"));
    expect(purchase?.textContent).toContain("자동 집계 · 읽기 전용");
    expect(purchase?.querySelectorAll("button").length).toBe(0);
    expect(document.body.textContent).toContain("상세·관리");
    clickButton("반복 규칙 관리로 이동");
    expect(document.body.textContent).toContain("반복 비용");
    expect(document.body.textContent).toContain("카테고리");
    const archivedRule = [...document.querySelectorAll("details")].find((details) => details.textContent?.includes("보관된 임대료"));
    expect(archivedRule?.textContent).toContain("보관된 규칙은 다시 발생하지 않으며 작업할 수 없습니다.");
    expect(archivedRule?.querySelectorAll("button").length).toBe(0);
  });

  it("separates ledger loading, safe error retry, successful empty, and recovery", () => {
    const retry = vi.fn();
    const dialog = () => createElement(ExpenseLedgerDialog, { open: true, onClose: vi.fn(), dbCostTotal: 9, additionalCost: 9 });
    ledgerQueryState = { data: undefined, isLoading: true, isFetching: true, isSuccess: false, error: null, refetch: retry };
    render(dialog()); clickButton("조회");
    expect(document.body.textContent).toContain("비용 내역을 불러오는 중입니다.");
    expect(document.body.textContent).not.toContain("해당 조건의 비용이 없습니다.");
    ledgerQueryState = { data: undefined, isLoading: false, isFetching: false, isSuccess: false, error: new Error("HTTP 503 database-secret"), refetch: retry };
    rerender(dialog());
    expect(document.body.textContent).toContain("비용 내역을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    expect(document.body.textContent).not.toContain("database-secret");
    clickButton("다시 시도"); expect(retry).toHaveBeenCalledOnce();
    ledgerQueryState = { data: { ...ledgerFixture, entries: [], categoryTotals: [], dbCostTotal: 0, additionalCostTotal: 0, totalCost: 0 }, isLoading: false, isFetching: false, isSuccess: true, error: null, refetch: retry };
    rerender(dialog()); expect(document.body.textContent).toContain("해당 조건의 비용이 없습니다.");
    ledgerQueryState = { ...ledgerQueryState, data: ledgerFixture };
    rerender(dialog()); expect(document.body.textContent).toContain("매입DB"); expect(document.body.textContent).not.toContain("해당 조건의 비용이 없습니다.");
  });

  it("active rule delete confirms, calls DELETE, and refreshes to terminal archived state", async () => {
    const dialog = () => createElement(ExpenseLedgerDialog, { open: true, onClose: vi.fn(), dbCostTotal: 3_000, additionalCost: 300 });
    render(dialog());
    clickButton("관리");
    clickRuleButton("운영 인력", "삭제/종료");
    expect(ruleDetails("운영 인력").querySelector('[role="alertdialog"]')?.textContent).toContain("앞으로의 비용 발생은 중단되지만 과거 비용 기록은 그대로 유지됩니다.");

    await act(async () => { clickRuleButton("운영 인력", "삭제/종료 확인"); });
    expect(deleteRecurringRuleMutation.mutateAsync).toHaveBeenCalledWith("rule-active");
    expect(document.body.textContent).toContain("반복 비용을 종료했습니다. 앞으로 다시 발생하지 않으며 과거 비용 기록은 그대로 유지됩니다.");

    recurringQueryState = {
      data: { rules: recurringRuleFixtures.map((rule) => rule.id === "rule-active" ? { ...rule, status: "archived" } : rule) },
      isLoading: false,
      isFetching: false,
      isSuccess: true,
      error: null,
      refetch: vi.fn(),
    };
    rerender(dialog());
    expect(ruleDetails("운영 인력").textContent).toContain("종료·보관된 규칙은 다시 발생하지 않으며 작업할 수 없습니다.");
    expect(ruleDetails("운영 인력").querySelectorAll("button").length).toBe(0);
  });

  it("paused rule delete uses the same terminal soft-archive path", async () => {
    recurringQueryState = {
      data: { rules: [{ ...recurringRuleFixtures[0]!, id: "rule-paused", itemName: "중지된 구독", status: "paused" }] },
      isLoading: false,
      isFetching: false,
      isSuccess: true,
      error: null,
      refetch: vi.fn(),
    };
    render(createElement(ExpenseLedgerDialog, { open: true, onClose: vi.fn(), dbCostTotal: 3_000, additionalCost: 300 }));
    clickButton("관리");
    expect(ruleDetails("중지된 구독").textContent).toContain("재개");
    clickRuleButton("중지된 구독", "삭제/종료");
    await act(async () => { clickRuleButton("중지된 구독", "삭제/종료 확인"); });
    expect(deleteRecurringRuleMutation.mutateAsync).toHaveBeenCalledWith("rule-paused");
  });

  it("delete cancel preserves the recurring rule and all existing actions", () => {
    render(createElement(ExpenseLedgerDialog, { open: true, onClose: vi.fn(), dbCostTotal: 3_000, additionalCost: 300 }));
    clickButton("관리");
    clickRuleButton("운영 인력", "삭제/종료");
    clickRuleButton("운영 인력", "취소");
    expect(deleteRecurringRuleMutation.mutateAsync).not.toHaveBeenCalled();
    expect(ruleDetails("운영 인력").querySelector('[role="alertdialog"]')).toBeNull();
    expect(ruleDetails("운영 인력").textContent).toContain("일시 중지");
    expect(ruleDetails("운영 인력").textContent).toContain("건너뛰기");
    expect(ruleDetails("운영 인력").textContent).toContain("다음 달부터 적용");
    expect(ruleDetails("운영 인력").textContent).toContain("삭제/종료");
  });

  it("delete 401, 403, and 503 failures show safe Korean recovery and retry without raw details", async () => {
    deleteRecurringRuleMutation.mutateAsync
      .mockRejectedValueOnce(new Error("HTTP 401 private-auth-detail"))
      .mockRejectedValueOnce(new Error("HTTP 403 forbidden raw-policy"))
      .mockRejectedValueOnce(new Error("HTTP 503 database-secret"))
      .mockResolvedValueOnce({ ok: true });
    render(createElement(ExpenseLedgerDialog, { open: true, onClose: vi.fn(), dbCostTotal: 3_000, additionalCost: 300 }));
    clickButton("관리");
    clickRuleButton("운영 인력", "삭제/종료");

    await act(async () => { clickRuleButton("운영 인력", "삭제/종료 확인"); });
    expect(ruleDetails("운영 인력").textContent).toContain("로그인이 만료되어 반복 비용을 종료하지 못했습니다.");
    expect(document.body.textContent).not.toContain("private-auth-detail");

    await act(async () => { clickRuleButton("운영 인력", "종료 다시 시도"); });
    expect(ruleDetails("운영 인력").textContent).toContain("반복 비용을 종료할 권한이 없습니다.");
    expect(document.body.textContent).not.toContain("raw-policy");

    await act(async () => { clickRuleButton("운영 인력", "종료 다시 시도"); });
    expect(ruleDetails("운영 인력").textContent).toContain("반복 비용을 종료하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    expect(document.body.textContent).not.toContain("database-secret");

    await act(async () => { clickRuleButton("운영 인력", "종료 다시 시도"); });
    expect(deleteRecurringRuleMutation.mutateAsync).toHaveBeenCalledTimes(4);
    expect(document.body.textContent).toContain("반복 비용을 종료했습니다.");
  });

  it("archived terminal rule exposes no delete, pause, resume, skip, or future-amount mutation", () => {
    recurringQueryState = {
      data: { rules: [recurringRuleFixtures[1]!] },
      isLoading: false,
      isFetching: false,
      isSuccess: true,
      error: null,
      refetch: vi.fn(),
    };
    render(createElement(ExpenseLedgerDialog, { open: true, onClose: vi.fn(), dbCostTotal: 3_000, additionalCost: 300 }));
    clickButton("관리");
    const archived = ruleDetails("보관된 임대료");
    expect(archived.textContent).toContain("과거 비용 기록은 그대로 유지됩니다.");
    expect(archived.querySelectorAll("button").length).toBe(0);
    for (const action of ["삭제/종료", "일시 중지", "재개", "건너뛰기", "다음 달부터 적용"]) {
      expect(archived.textContent).not.toContain(action);
    }
  });

  it("separates recurring loading, empty, safe 401/403/503 errors, retry, and recovery", () => {
    const dialog = () => createElement(ExpenseLedgerDialog, { open: true, onClose: vi.fn(), dbCostTotal: 3_000, additionalCost: 300 });
    recurringQueryState = { data: undefined, isLoading: true, isFetching: true, isSuccess: false, error: null, refetch: vi.fn() };
    render(dialog());
    clickButton("관리");
    expect(document.body.textContent).toContain("반복 비용을 불러오고 있습니다.");
    expect(document.body.textContent).not.toContain("등록된 반복 비용이 없습니다.");
    expect(document.body.textContent).not.toContain("0건");

    const retry = vi.fn();
    recurringQueryState = { data: undefined, isLoading: false, isFetching: false, isSuccess: false, error: new Error("HTTP 401 secret detail"), refetch: retry };
    rerender(dialog());
    expect(document.body.textContent).toContain("로그인이 만료되어 반복 비용을");
    expect(document.body.textContent).not.toContain("secret detail");
    expect(document.body.textContent).not.toContain("등록된 반복 비용이 없습니다.");
    clickButton("다시 시도");
    expect(retry).toHaveBeenCalledOnce();

    recurringQueryState = { ...recurringQueryState, error: new Error("HTTP 403 forbidden") };
    rerender(dialog());
    expect(document.body.textContent).toContain("반복 비용을 볼 권한이 없습니다.");
    expect(document.body.textContent).not.toContain("HTTP 403");

    recurringQueryState = { ...recurringQueryState, error: new Error("HTTP 503 database unavailable") };
    rerender(dialog());
    expect(document.body.textContent).toContain("반복 비용을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    expect(document.body.textContent).not.toContain("database unavailable");

    recurringQueryState = { data: { rules: [] }, isLoading: false, isFetching: false, isSuccess: true, error: null, refetch: vi.fn() };
    rerender(dialog());
    expect(document.body.textContent).toContain("0건");
    expect(document.body.textContent).toContain("등록된 반복 비용이 없습니다.");

    recurringQueryState = { data: { rules: [recurringRuleFixtures[0]!] }, isLoading: false, isFetching: false, isSuccess: true, error: null, refetch: vi.fn() };
    rerender(dialog());
    expect(document.body.textContent).toContain("1건");
    expect(document.body.textContent).toContain("운영 인력");
  });

  it("separates category loading, empty, safe 401/403/503 errors, retry, and recovery in record and manage", () => {
    const dialog = () => createElement(ExpenseLedgerDialog, { open: true, onClose: vi.fn(), dbCostTotal: 3_000, additionalCost: 300 });
    categoryQueryState = { data: undefined, isLoading: true, isFetching: true, isSuccess: false, error: null, refetch: vi.fn() };
    render(dialog());
    expect(document.body.textContent).toContain("카테고리를 불러오고 있습니다.");
    expect(document.querySelector('[role="combobox"][aria-label="비용 카테고리"]')).toBeNull();
    expect(document.body.textContent).not.toContain("등록된 카테고리가 없습니다.");

    const retry = vi.fn();
    categoryQueryState = { data: undefined, isLoading: false, isFetching: false, isSuccess: false, error: new Error("HTTP 401 private"), refetch: retry };
    rerender(dialog());
    expect(document.body.textContent).toContain("로그인이 만료되어 카테고리를");
    expect(document.body.textContent).not.toContain("private");
    clickButton("다시 시도");
    expect(retry).toHaveBeenCalledOnce();

    categoryQueryState = { ...categoryQueryState, error: new Error("HTTP 403 forbidden") };
    rerender(dialog());
    expect(document.body.textContent).toContain("카테고리를 볼 권한이 없습니다.");
    expect(document.body.textContent).not.toContain("HTTP 403");
    clickButton("관리");
    expect(document.body.textContent).toContain("카테고리를 볼 권한이 없습니다.");

    categoryQueryState = { ...categoryQueryState, error: new Error("HTTP 503 unavailable") };
    rerender(dialog());
    expect(document.body.textContent).toContain("카테고리를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    expect(document.body.textContent).not.toContain("unavailable");

    categoryQueryState = { data: [], isLoading: false, isFetching: false, isSuccess: true, error: null, refetch: vi.fn() };
    rerender(dialog());
    expect(document.body.textContent).toContain("등록된 카테고리가 없습니다. 기록 화면에서 새 카테고리를 추가해 주세요.");
    clickButton("기록");
    expect(document.body.textContent).toContain("등록된 카테고리가 없습니다. 목록을 열어 새 카테고리를 추가해 주세요.");
    expect(document.querySelector('[role="combobox"][aria-label="비용 카테고리"]')).not.toBeNull();

    categoryQueryState = { data: categories, isLoading: false, isFetching: false, isSuccess: true, error: null, refetch: vi.fn() };
    rerender(dialog());
    const combobox = document.querySelector<HTMLButtonElement>('[role="combobox"][aria-label="비용 카테고리"]');
    act(() => combobox?.click());
    expect(document.body.textContent).toContain("마케팅");
  });
});

describe("expense category combobox", () => {
  it("supports selection, add, rename, archive, and blocks delete with archive guidance", async () => {
    const onChange = vi.fn();
    const onCreate = vi.fn(async (name: string) => ({ ...categories[0]!, id: "new-category", name }));
    const onRename = vi.fn(async () => undefined);
    const onArchive = vi.fn(async () => undefined);
    const onMessage = vi.fn();
    render(createElement(ExpenseCategoryPicker, {
      categories,
      value: "category-marketing",
      busy: false,
      loading: false,
      loaded: true,
      errorMessage: null,
      retrying: false,
      onRetry: vi.fn(),
      onChange,
      onCreate,
      onRename,
      onArchive,
      onMessage,
    }));

    const combobox = document.querySelector<HTMLButtonElement>('[role="combobox"]');
    expect(combobox?.getAttribute("aria-expanded")).toBe("false");
    act(() => combobox?.click());
    expect(combobox?.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector('[role="listbox"]')).not.toBeNull();

    const createInput = document.querySelector<HTMLInputElement>('[aria-label="새 카테고리 이름"]');
    if (!createInput) throw new Error("create-category input is missing");
    changeInput(createInput, "소모품");
    await act(async () => { clickButton("추가"); });
    expect(onCreate).toHaveBeenCalledWith("소모품");
    expect(onChange).toHaveBeenCalledWith("new-category");

    act(() => combobox?.click());
    const renameInput = document.querySelector<HTMLInputElement>('[aria-label="선택 카테고리 이름 수정"]');
    if (!renameInput) throw new Error("rename-category input is missing");
    changeInput(renameInput, "퍼포먼스 마케팅");
    await act(async () => { clickButton("이름 수정"); });
    expect(onRename).toHaveBeenCalledWith("category-marketing", "퍼포먼스 마케팅");
    await act(async () => { clickButton("보관"); });
    expect(onArchive).toHaveBeenCalledWith("category-marketing");
    clickButton("삭제");
    expect(onMessage).toHaveBeenCalledWith(expect.stringContaining("대신 보관"));
  });
});
