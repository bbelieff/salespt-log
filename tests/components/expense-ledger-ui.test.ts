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
  { id: "category-marketing", name: "마케팅", isSystem: false, deletedAt: null, archivedAt: null, createdAt: "2026-07-01", updatedAt: "2026-07-01" },
  { id: "category-labor", name: "인건비", isSystem: false, deletedAt: null, archivedAt: null, createdAt: "2026-07-01", updatedAt: "2026-07-01" },
  { id: "category-rent", name: "임차료", isSystem: false, deletedAt: null, archivedAt: null, createdAt: "2026-07-01", updatedAt: "2026-07-01" },
  { id: "category-unclassified", name: "미분류", isSystem: true, deletedAt: null, archivedAt: null, createdAt: "2026-07-01", updatedAt: "2026-07-01" },
];
const recurringRuleFixtures = [
  { id: "rule-active", categoryId: "category-labor", categoryName: "인건비", itemName: "운영 인력", amountWon: 108, status: "active", currentOccurrence: null, nextOccurrence: { occurrenceDate: "2026-08-23", occurrenceMonth: "2026-08", status: "scheduled" } },
  { id: "rule-archived", categoryId: "category-rent", categoryName: "임차료", itemName: "보관된 임대료", amountWon: 72, status: "archived", currentOccurrence: null, nextOccurrence: null },
];
interface QueryMock<T> {
  data: T | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isSuccess: boolean;
  error: Error | null;
  refetch: ReturnType<typeof vi.fn>;
}
let categoryQueryState: QueryMock<typeof categories>;
let recurringQueryState: QueryMock<{ rules: typeof recurringRuleFixtures }>;
let deleteRecurringRuleMutation: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };
let createExpenseMutation: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };
let createRecurringRuleMutation: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };
let deleteCategoryMutation: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };
let reclassifyMutation: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };
let usageQueryState: QueryMock<{ category: { id: string; name: string; isSystem: false; deletedAt: null }; usage: { entryCount: number; ruleCount: number; occurrenceCount: number; overrideOccurrenceCount: number; totalCount: number } }>;
function resetQueryStates() {
  categoryQueryState = { data: categories, isLoading: false, isFetching: false, isSuccess: true, error: null, refetch: vi.fn() };
  recurringQueryState = { data: { rules: recurringRuleFixtures }, isLoading: false, isFetching: false, isSuccess: true, error: null, refetch: vi.fn() };
  deleteRecurringRuleMutation = { mutateAsync: vi.fn().mockResolvedValue({ ok: true }), isPending: false };
  deleteCategoryMutation = { mutateAsync: vi.fn().mockResolvedValue({ ok: true, deletedCategoryId: "category-marketing", unclassifiedCategoryId: "category-unclassified", movedEntryCount: 1, movedRuleCount: 2, movedOccurrenceCount: 3 }), isPending: false };
  reclassifyMutation = { mutateAsync: vi.fn().mockResolvedValue({ ok: true, operationId: "operation", unclassifiedCategoryId: "category-unclassified", targetCategoryId: "category-marketing", movedEntryCount: 1, movedRuleCount: 0, movedOccurrenceCount: 0 }), isPending: false };
  usageQueryState = { data: { category: { id: "category-marketing", name: "마케팅", isSystem: false, deletedAt: null }, usage: { entryCount: 1, ruleCount: 2, occurrenceCount: 3, overrideOccurrenceCount: 1, totalCount: 6 } }, isLoading: false, isFetching: false, isSuccess: true, error: null, refetch: vi.fn() };
  createExpenseMutation = { mutateAsync: vi.fn().mockResolvedValue({ expense: {} }), isPending: false };
  createRecurringRuleMutation = { mutateAsync: vi.fn().mockResolvedValue({ rule: { id: "new-rule" } }), isPending: false };
}
resetQueryStates();
vi.mock("@/query/expense-ledger-hooks", () => {
  const idleMutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  return {
    useExpenseCategories: () => categoryQueryState,
    useExpenseCategoryUsage: () => usageQueryState,
    useExpenseLedger: (view: string) => ({
      data: {
        view,
        month: view === "month" ? "2026-07" : null,
        categories,
        entries: [
          { id: "entry-1", source: "one_time", categoryId: "category-marketing", categoryName: "마케팅", itemName: "광고비", amountWon: 120, periodStart: "2026-07-31", periodEnd: "2026-08-02" },
          { id: "entry-2", source: "recurring", categoryId: "category-labor", categoryName: "인건비", itemName: "운영 인력", amountWon: 108, periodStart: "2026-07-31", periodEnd: "2026-07-31" },
          { id: "entry-3", source: "one_time", categoryId: "category-rent", categoryName: "임차료", itemName: "사무실 임대료", amountWon: 72, periodStart: "2026-07-31", periodEnd: "2026-07-31" },
        ],
        categoryTotals: [
          { categoryId: "category-marketing", categoryName: "마케팅", amountWon: 120 },
          { categoryId: "category-labor", categoryName: "인건비", amountWon: 108 },
          { categoryId: "category-rent", categoryName: "임차료", amountWon: 72 },
        ],
        additionalCostTotal: 300,
      },
      isLoading: false,
      error: null,
    }),
    useCreateCategory: idleMutation,
    useDeleteCategory: () => deleteCategoryMutation,
    useDeleteRecurringRule: () => deleteRecurringRuleMutation,
    useCreateExpense: () => createExpenseMutation,
    useCreateRecurringRule: () => createRecurringRuleMutation,
    usePatchCategory: idleMutation,
    usePatchRecurringRule: idleMutation,
    useReclassifyUnclassified: () => reclassifyMutation,
    useRecurringRules: () => recurringQueryState,
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
  const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find((candidate) => candidate.textContent?.trim() === name);
  if (!button) throw new Error(`button '${name}' is missing`);
  act(() => button.click());
  return button;
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
  if (!details) throw new Error(`recurring rule '${itemName}' is missing`);
  return details;
}
function clickRuleButton(itemName: string, name: string) {
  const button = [...ruleDetails(itemName).querySelectorAll<HTMLButtonElement>("button")].find((candidate) => candidate.textContent?.trim() === name);
  if (!button) throw new Error(`button '${name}' for recurring rule '${itemName}' is missing`);
  act(() => button.click());
  return button;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  vi.clearAllMocks();
  resetQueryStates();
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

  it("renders the compact record hub and view shell with a sticky form CTA", () => {
    render(createElement(ExpenseLedgerDialog, { open: true, onClose: vi.fn(), dbCostTotal: 3_000, additionalCost: 300 }));
    expect(document.body.textContent).toContain("DB 비용₩3,000");
    expect(document.body.textContent).toContain("추가 비용₩300");
    expect(document.body.textContent).toContain("총비용₩3,300");
    expect(document.querySelectorAll('[role="tab"][aria-controls]').length).toBe(2);
    expect([...document.querySelectorAll('[role="tab"]')].some((tab) => tab.textContent === "관리")).toBe(false);
    expect(document.querySelector('button[form="expense-record-form"]')?.textContent).toBe("비용 저장");
    expect(document.body.textContent).not.toContain("방금 만든 반복 비용 관리");
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

  it("shows the full-category view in cost order with share, count, and unclassified", () => {
    render(createElement(ExpenseLedgerDialog, { open: true, onClose: vi.fn(), dbCostTotal: 3_000, additionalCost: 300 }));
    clickButton("조회");
    clickButton("카테고리");
    const table = document.querySelector("table");
    expect(table?.textContent).toContain("카테고리비중항목 수총비용");
    const rows = [...document.querySelectorAll("tbody tr")].map((row) => row.textContent);
    expect(rows).toEqual([
      "마케팅40%1건₩120",
      "인건비36%1건₩108",
      "임차료24%1건₩72",
      "미분류0%0건₩0",
    ]);
  });

  it("uses row disclosure for detail and routes recurring rows to management", () => {
    render(createElement(ExpenseLedgerDialog, { open: true, onClose: vi.fn(), dbCostTotal: 3_000, additionalCost: 300 }));
    clickButton("조회");
    expect(document.querySelectorAll("details summary").length).toBe(3);
    expect(document.body.textContent).toContain("상세·관리");
    clickButton("기록 화면의 반복 규칙으로 이동");
    expect(document.body.textContent).toContain("반복 비용");
    expect(document.body.textContent).toContain("카테고리");
    const archivedRule = [...document.querySelectorAll("details")].find((details) => details.textContent?.includes("보관된 임대료"));
    expect(archivedRule?.textContent).toContain("보관된 규칙은 다시 발생하지 않으며 작업할 수 없습니다.");
    expect(archivedRule?.querySelectorAll("button").length).toBe(0);
  });

  it("active rule delete confirms, calls DELETE, and refreshes to terminal archived state", async () => {
    const dialog = () => createElement(ExpenseLedgerDialog, { open: true, onClose: vi.fn(), dbCostTotal: 3_000, additionalCost: 300 });
    render(dialog());
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
    expect(ruleDetails("중지된 구독").textContent).toContain("재개");
    clickRuleButton("중지된 구독", "삭제/종료");
    await act(async () => { clickRuleButton("중지된 구독", "삭제/종료 확인"); });
    expect(deleteRecurringRuleMutation.mutateAsync).toHaveBeenCalledWith("rule-paused");
  });

  it("delete cancel preserves the recurring rule and all existing actions", () => {
    render(createElement(ExpenseLedgerDialog, { open: true, onClose: vi.fn(), dbCostTotal: 3_000, additionalCost: 300 }));
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

  it("separates category loading, empty, safe 401/403/503 errors, retry, and recovery in the record hub", () => {
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

    categoryQueryState = { ...categoryQueryState, error: new Error("HTTP 503 unavailable") };
    rerender(dialog());
    expect(document.body.textContent).toContain("카테고리를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    expect(document.body.textContent).not.toContain("unavailable");

    categoryQueryState = { data: [], isLoading: false, isFetching: false, isSuccess: true, error: null, refetch: vi.fn() };
    rerender(dialog());
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
  const pickerProps = (overrides = {}) => ({
    categories, value: "category-marketing", busy: false, loading: false, loaded: true, errorMessage: null, retrying: false,
    unclassifiedRefs: [], onRetry: vi.fn(), onChange: vi.fn(),
    onCreate: vi.fn(async (name: string) => ({ ...categories[0]!, id: "new-category", name })),
    onRename: vi.fn(async () => undefined), onDelete: vi.fn(async () => deleteCategoryMutation.mutateAsync("category-marketing")),
    onReclassify: vi.fn(async () => reclassifyMutation.mutateAsync({})), onMessage: vi.fn(), ...overrides,
  });

  it("keeps compact selection/add/rename and performs usage-confirmed real delete while system stays immutable", async () => {
    const onChange = vi.fn();
    const onRename = vi.fn(async () => undefined);
    const onDelete = vi.fn(async () => deleteCategoryMutation.mutateAsync("category-marketing"));
    const onMessage = vi.fn();
    const props = pickerProps({ onChange, onRename, onDelete, onMessage });
    render(createElement(ExpenseCategoryPicker, props));

    const combobox = document.querySelector<HTMLButtonElement>('[role="combobox"]');
    expect(combobox?.getAttribute("aria-expanded")).toBe("false");
    act(() => combobox?.click());
    expect(combobox?.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector('[role="listbox"]')).not.toBeNull();

    const renameInput = document.querySelector<HTMLInputElement>('[aria-label="선택 카테고리 이름 수정"]');
    if (!renameInput) throw new Error("rename-category input is missing");
    changeInput(renameInput, "퍼포먼스 마케팅");
    await act(async () => { clickButton("이름 변경"); });
    expect(onRename).toHaveBeenCalledWith("category-marketing", "퍼포먼스 마케팅");

    const createInput = document.querySelector<HTMLInputElement>('[aria-label="새 카테고리 이름"]')!;
    changeInput(createInput, "소모품"); await act(async () => { clickButton("추가"); });
    expect(props.onCreate).toHaveBeenCalledWith("소모품");
    expect(document.querySelector('[aria-label="미분류 카테고리 삭제"]')).toBeNull();
    const visualDelete = document.querySelector<HTMLButtonElement>('[aria-label="마케팅 카테고리 삭제"]')!;
    expect(visualDelete.className).toContain("min-h-[44px]"); expect(visualDelete.className).toContain("min-w-[44px]"); expect(visualDelete.className).not.toMatch(/min-[hw]-11/); expect(visualDelete.textContent).toBe("×"); act(() => visualDelete.click());
    expect(document.body.textContent).toContain("항목 1건, 반복 2건, 발생 3건이 미분류로 이동합니다.");
    await act(async () => { clickButton("카테고리 삭제 확인"); });
    expect(onDelete).toHaveBeenCalledWith("category-marketing"); expect(onChange).toHaveBeenCalledWith("");
    expect(onMessage).toHaveBeenCalledWith(expect.stringContaining("과거 기록은 유지됩니다"));
  });

  it("reclassifies persisted unclassified items with one or many typed refs and an explicit target", async () => {
    const onReclassify = vi.fn(async (body) => ({ ok: true, operationId: body.operationId, unclassifiedCategoryId: "category-unclassified", targetCategoryId: body.targetCategoryId, movedEntryCount: 0, movedRuleCount: 1, movedOccurrenceCount: 0 }));
    const refs = [
      { kind: "entry" as const, id: "entry-a", label: "영수증", detail: "일회성 · ₩10,000" },
      { kind: "recurringRule" as const, id: "rule-a", label: "구독", detail: "반복 규칙 · ₩20,000" },
    ];
    render(createElement(ExpenseCategoryPicker, pickerProps({ value: "category-unclassified", unclassifiedRefs: refs, onReclassify })));
    act(() => document.querySelector<HTMLButtonElement>('[role="combobox"]')?.click());
    expect(document.body.textContent).toContain("고정 카테고리이며 이름 변경·삭제할 수 없습니다.");
    expect(clickButton("2건 분류하기").disabled).toBe(true);
    act(() => [...document.querySelectorAll<HTMLButtonElement>('button[aria-pressed="true"]')].find((button) => button.textContent?.includes("영수증"))?.click());
    const target = document.querySelector<HTMLSelectElement>('[aria-label="미분류 이동 대상"]')!;
    act(() => { target.value = "category-marketing"; target.dispatchEvent(new Event("change", { bubbles: true })); });
    await act(async () => { clickButton("1건 분류하기"); });
    expect(onReclassify).toHaveBeenCalledWith(expect.objectContaining({ targetCategoryId: "category-marketing", refs: [{ kind: "recurringRule", id: "rule-a" }], operationId: expect.any(String) }));
  });
});
