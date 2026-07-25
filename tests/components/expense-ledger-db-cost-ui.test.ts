// @vitest-environment jsdom

import * as React from "react";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import ExpenseCategoryPicker from "@/components/dashboard/expense-ledger/ExpenseCategoryPicker";
import ExpenseLedgerDialog from "@/components/dashboard/expense-ledger/ExpenseLedgerDialog";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

type FrozenSource = "one_time" | "recurring" | "db_purchase" | "db_production" | "db_banner";
type RecognitionStatus = "allocated" | "recognized_on_date" | "recognized_on_start" | "unallocated";
type FrozenView = "month" | "all" | "category";

interface FrozenEntry {
  source: FrozenSource;
  id: string;
  categoryId: string;
  categoryName: string;
  itemName: string;
  amountWon: number;
  periodStart: string;
  periodEnd: string;
  system: boolean;
  readOnly: boolean;
  recognitionStatus: RecognitionStatus;
  recognitionNote: string | null;
}

interface FrozenCategoryTotal {
  categoryId: string;
  categoryName: string;
  amountWon: number;
  itemCount: number;
  sharePercent: number;
  system: boolean;
  archived: boolean;
}

interface FrozenLedgerView {
  view: FrozenView;
  month: string | null;
  categories: typeof editableCategories;
  entries: FrozenEntry[];
  categoryTotals: FrozenCategoryTotal[];
  dbCostTotal: number;
  additionalCostTotal: number;
  totalCost: number;
  selectedScope: { view: FrozenView; month: string | null; categoryId: string | null; label: string };
}

interface LedgerQueryState {
  data: FrozenLedgerView | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isSuccess: boolean;
  error: Error | null;
  refetch: ReturnType<typeof vi.fn>;
}

const editableCategories = [
  { id: "category-marketing", name: "마케팅", archivedAt: "2026-07-20", createdAt: "2026-07-01", updatedAt: "2026-07-20" },
  { id: "category-unclassified", name: "미분류", archivedAt: null, createdAt: "2026-07-01", updatedAt: "2026-07-01" },
];

const systemEntry = (
  source: Extract<FrozenSource, `db_${string}`>,
  id: string,
  categoryName: string,
  itemName: string,
  amountWon: number,
  recognitionStatus: RecognitionStatus,
  recognitionNote: string | null,
  periodStart = "2026-07-10",
  periodEnd = periodStart,
): FrozenEntry => ({
  source,
  id,
  categoryId: `system:${source}`,
  categoryName,
  itemName,
  amountWon,
  periodStart,
  periodEnd,
  system: true,
  readOnly: true,
  recognitionStatus,
  recognitionNote,
});

describe("R6 category lifecycle recovery states", () => {
  const r6Categories = [
    { id: "category-active", name: "운영비", isSystem: false, deletedAt: null, archivedAt: null, createdAt: "2026-07-01", updatedAt: "2026-07-01" },
    { id: "category-unclassified", name: "미분류", isSystem: true, deletedAt: null, archivedAt: null, createdAt: "2026-07-01", updatedAt: "2026-07-01" },
  ];
  const picker = (onDelete = vi.fn().mockResolvedValue({ ok: true, deletedCategoryId: "category-active", unclassifiedCategoryId: "category-unclassified", movedEntryCount: 2, movedRuleCount: 1, movedOccurrenceCount: 3 })) => createElement(ExpenseCategoryPicker, {
    categories: r6Categories, value: "category-active", busy: false, loading: false, loaded: true, errorMessage: null, retrying: false, unclassifiedRefs: [],
    onRetry: vi.fn(), onChange: vi.fn(), onCreate: vi.fn(async (name: string) => ({ ...r6Categories[0]!, name })), onRename: vi.fn(async () => undefined), onDelete,
    onReclassify: vi.fn(async () => ({ ok: true as const, operationId: "operation", unclassifiedCategoryId: "category-unclassified", targetCategoryId: "category-active", movedEntryCount: 0, movedRuleCount: 0, movedOccurrenceCount: 0 })), onMessage: vi.fn(),
  });

  it("distinguishes usage loading and safe 401/403/404/409/5xx retry states", () => {
    usageQueryState = { data: undefined, isLoading: true, isFetching: true, isSuccess: false, error: null, refetch: vi.fn() };
    render(picker()); act(() => document.querySelector<HTMLButtonElement>('[role="combobox"]')?.click()); act(() => document.querySelector<HTMLButtonElement>('[aria-label="운영비 카테고리 삭제"]')?.click());
    expect(document.body.textContent).toContain("사용량을 확인하고 있습니다.");
    const cases = [
      ["HTTP 401 secret", "로그인이 만료되어"], ["HTTP 403 secret", "권한이 없습니다"],
      ["expense_category_not_found raw", "카테고리를 찾을 수 없습니다"], ["expense_category_deleted raw", "이미 삭제된 카테고리"], ["HTTP 503 database-secret", "잠시 후 다시 시도해 주세요"],
    ];
    const retry = vi.fn();
    for (const [code, message] of cases) {
      usageQueryState = { data: undefined, isLoading: false, isFetching: false, isSuccess: false, error: new Error(code), refetch: retry };
      rerender(picker()); expect(document.body.textContent).toContain(message); expect(document.body.textContent).not.toContain("database-secret");
    }
    clickButton("사용량 다시 확인"); expect(retry).toHaveBeenCalledOnce();
  });

  it("keeps delete confirmation on safe 404/409/5xx failures for retry", async () => {
    const onDelete = vi.fn().mockRejectedValueOnce(new Error("expense_category_not_found raw")).mockRejectedValueOnce(new Error("expense_category_deleted raw")).mockRejectedValueOnce(new Error("HTTP 503 database-secret"));
    render(picker(onDelete)); act(() => document.querySelector<HTMLButtonElement>('[role="combobox"]')?.click()); act(() => document.querySelector<HTMLButtonElement>('[aria-label="운영비 카테고리 삭제"]')?.click());
    await act(async () => { clickButton("카테고리 삭제 확인"); }); expect(document.body.textContent).toContain("카테고리를 찾을 수 없습니다");
    await act(async () => { clickButton("삭제 다시 시도"); }); expect(document.body.textContent).toContain("이미 삭제된 카테고리");
    await act(async () => { clickButton("삭제 다시 시도"); }); expect(document.body.textContent).toContain("잠시 후 다시 시도해 주세요");
    expect(onDelete).toHaveBeenCalledTimes(3); expect(document.body.textContent).not.toContain("database-secret");
  });
});

const dbOnlyEntries: FrozenEntry[] = [
  systemEntry("db_purchase", "purchase-1", "매입DB", "원부자재 매입", 600_000, "recognized_on_date", null, "2026-07-03"),
  systemEntry("db_production", "production-1", "직접생산", "진행 중 생산", 400_000, "recognized_on_start", "종료일이 없어 시작일에 전액 인식했습니다.", "2026-07-05"),
  systemEntry("db_banner", "banner-1", "현수막", "오프라인 현수막", 80_000, "recognized_on_date", null, "2026-07-08"),
];

const dbOnlyView: FrozenLedgerView = {
  view: "all",
  month: null,
  categories: editableCategories,
  entries: dbOnlyEntries,
  categoryTotals: [
    { categoryId: "system:db_purchase", categoryName: "매입DB", amountWon: 600_000, itemCount: 1, sharePercent: 55.5556, system: true, archived: false },
    { categoryId: "system:db_production", categoryName: "직접생산", amountWon: 400_000, itemCount: 1, sharePercent: 37.037, system: true, archived: false },
    { categoryId: "system:db_banner", categoryName: "현수막", amountWon: 80_000, itemCount: 1, sharePercent: 7.4074, system: true, archived: false },
  ],
  dbCostTotal: 1_080_000,
  additionalCostTotal: 0,
  totalCost: 1_080_000,
  selectedScope: { view: "all", month: null, categoryId: null, label: "전체 기간" },
};

const combinedAllEntries: FrozenEntry[] = [
  systemEntry("db_purchase", "purchase-combined", "매입DB", "원부자재 매입", 600_000, "recognized_on_date", null, "2026-07-03"),
  systemEntry("db_production", "production-allocated", "직접생산", "기간 생산", 300_000, "allocated", "기간 일수로 일할 인식했습니다.", "2026-06-28", "2026-07-03"),
  systemEntry("db_production", "production-unallocated", "직접생산", "시작일 확인 필요 생산", 100_000, "unallocated", "시작일을 확인할 수 없어 전체와 카테고리에만 1회 반영했습니다.", "", ""),
  systemEntry("db_banner", "banner-combined", "현수막", "오프라인 현수막", 80_000, "recognized_on_date", null, "2026-07-08"),
  { source: "recurring", id: "recurring-marketing", categoryId: "category-marketing", categoryName: "마케팅", itemName: "광고 도구", amountWon: 72_000, periodStart: "2026-07-15", periodEnd: "2026-07-15", system: false, readOnly: false, recognitionStatus: "recognized_on_date", recognitionNote: null },
  { source: "one_time", id: "one-time-unclassified", categoryId: "category-unclassified", categoryName: "미분류", itemName: "분류 전 비용", amountWon: 48_000, periodStart: "2026-07-18", periodEnd: "2026-07-18", system: false, readOnly: false, recognitionStatus: "allocated", recognitionNote: null },
];

const combinedAllView: FrozenLedgerView = {
  view: "all",
  month: null,
  categories: editableCategories,
  entries: combinedAllEntries,
  categoryTotals: [
    { categoryId: "system:db_purchase", categoryName: "매입DB", amountWon: 600_000, itemCount: 1, sharePercent: 50, system: true, archived: false },
    { categoryId: "system:db_production", categoryName: "직접생산", amountWon: 400_000, itemCount: 2, sharePercent: 33.3333, system: true, archived: false },
    { categoryId: "system:db_banner", categoryName: "현수막", amountWon: 80_000, itemCount: 1, sharePercent: 6.6667, system: true, archived: false },
    { categoryId: "category-marketing", categoryName: "마케팅", amountWon: 72_000, itemCount: 1, sharePercent: 6, system: false, archived: true },
    { categoryId: "category-unclassified", categoryName: "미분류", amountWon: 48_000, itemCount: 1, sharePercent: 4, system: false, archived: false },
  ],
  dbCostTotal: 1_080_000,
  additionalCostTotal: 120_000,
  totalCost: 1_200_000,
  selectedScope: { view: "all", month: null, categoryId: null, label: "전체 기간" },
};

const combinedMonthView: FrozenLedgerView = {
  ...combinedAllView,
  view: "month",
  month: "2026-07",
  entries: combinedAllEntries.filter((entry) => entry.recognitionStatus !== "unallocated"),
  categoryTotals: [
    { categoryId: "system:db_purchase", categoryName: "매입DB", amountWon: 600_000, itemCount: 1, sharePercent: 54.5455, system: true, archived: false },
    { categoryId: "system:db_production", categoryName: "직접생산", amountWon: 300_000, itemCount: 1, sharePercent: 27.2727, system: true, archived: false },
    { categoryId: "system:db_banner", categoryName: "현수막", amountWon: 80_000, itemCount: 1, sharePercent: 7.2727, system: true, archived: false },
    { categoryId: "category-marketing", categoryName: "마케팅", amountWon: 72_000, itemCount: 1, sharePercent: 6.5455, system: false, archived: true },
    { categoryId: "category-unclassified", categoryName: "미분류", amountWon: 48_000, itemCount: 1, sharePercent: 4.3636, system: false, archived: false },
  ],
  dbCostTotal: 980_000,
  additionalCostTotal: 120_000,
  totalCost: 1_100_000,
  selectedScope: { view: "month", month: "2026-07", categoryId: null, label: "2026년 7월" },
};

const emptyAllView: FrozenLedgerView = {
  view: "all",
  month: null,
  categories: editableCategories,
  entries: [],
  categoryTotals: [],
  dbCostTotal: 0,
  additionalCostTotal: 0,
  totalCost: 0,
  selectedScope: { view: "all", month: null, categoryId: null, label: "전체 기간" },
};

let ledgerQueryState: LedgerQueryState;
let viewFixture: (view: string) => FrozenLedgerView;
let usageQueryState: { data: { category: { id: string; name: string; isSystem: false; deletedAt: null }; usage: { entryCount: number; ruleCount: number; occurrenceCount: number; overrideOccurrenceCount: number; totalCount: number } } | undefined; isLoading: boolean; isFetching: boolean; isSuccess: boolean; error: Error | null; refetch: ReturnType<typeof vi.fn> };
const categoryQueryState = {
  data: editableCategories,
  isLoading: false,
  isFetching: false,
  isSuccess: true,
  error: null,
  refetch: vi.fn(),
};

function loaded(data: FrozenLedgerView): LedgerQueryState {
  return { data, isLoading: false, isFetching: false, isSuccess: true, error: null, refetch: vi.fn() };
}

function resetFixtures() {
  viewFixture = (view) => view === "month" ? combinedMonthView : combinedAllView;
  ledgerQueryState = loaded(combinedMonthView);
  usageQueryState = { data: { category: { id: "category-active", name: "운영비", isSystem: false, deletedAt: null }, usage: { entryCount: 2, ruleCount: 1, occurrenceCount: 3, overrideOccurrenceCount: 1, totalCount: 6 } }, isLoading: false, isFetching: false, isSuccess: true, error: null, refetch: vi.fn() };
}

resetFixtures();

vi.mock("@/query/expense-ledger-hooks", () => {
  const idleMutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  return {
    useExpenseCategories: () => categoryQueryState,
    useExpenseCategoryUsage: () => usageQueryState,
    useExpenseLedger: (view: string) => ledgerQueryState.data && !ledgerQueryState.error && !ledgerQueryState.isLoading
      ? { ...ledgerQueryState, data: viewFixture(view) }
      : ledgerQueryState,
    useCreateCategory: idleMutation,
    useDeleteCategory: idleMutation,
    useDeleteRecurringRule: idleMutation,
    useCreateExpense: idleMutation,
    useCreateRecurringRule: idleMutation,
    usePatchCategory: idleMutation,
    usePatchRecurringRule: idleMutation,
    useReclassifyUnclassified: idleMutation,
    useRecurringRules: () => ({ data: { rules: [] }, isLoading: false, isFetching: false, isSuccess: true, error: null, refetch: vi.fn() }),
    useRecurringRuleAction: idleMutation,
  };
});

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

function dialog() {
  return createElement(ExpenseLedgerDialog, {
    open: true,
    onClose: vi.fn(),
    // Deliberately stale cumulative props: selected-scope cards must use the ledger response.
    dbCostTotal: 999,
    additionalCost: 888,
  });
}

function clickButton(name: string) {
  const button = [...document.querySelectorAll<HTMLButtonElement>("button")]
    .find((candidate) => candidate.textContent?.trim() === name);
  if (!button) throw new Error(`button '${name}' is missing`);
  act(() => button.click());
  return button;
}

function normalized(value: string | null | undefined) {
  return value?.replace(/\s+/g, "").trim() ?? "";
}

function occurrences(text: string, value: string) {
  return text.split(value).length - 1;
}

function detailsFor(itemName: string) {
  const row = [...document.querySelectorAll<HTMLDetailsElement>("details")]
    .find((candidate) => candidate.textContent?.includes(itemName));
  if (!row) throw new Error(`ledger row '${itemName}' is missing`);
  return row;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  vi.clearAllMocks();
  resetFixtures();
});

describe("R5 DB cost ledger frozen UI contract", () => {
  it("treats exact DB-only 1,080,000 plus zero additional cost as a nonempty reconciled scope", () => {
    viewFixture = () => dbOnlyView;
    ledgerQueryState = loaded(dbOnlyView);
    render(dialog());

    const summary = document.querySelector('[aria-label="비용 요약"]');
    expect(normalized(summary?.textContent)).toContain("DB비용₩1,080,000추가비용₩0총비용₩1,080,000");
    expect(summary?.textContent).not.toContain("₩999");
    expect(summary?.textContent).not.toContain("₩888");

    clickButton("조회");
    expect(document.body.textContent).toContain("전체 기간");
    expect(document.body.textContent).not.toContain("해당 조건의 비용이 없습니다.");
    expect(document.querySelectorAll("details")).toHaveLength(3);
    expect(occurrences(document.body.textContent ?? "", "₩1,080,000")).toBeGreaterThanOrEqual(3);
  });

  it("renders DB rows as read-only system evidence with safe recognition copy and no action buttons", () => {
    viewFixture = () => dbOnlyView;
    ledgerQueryState = loaded(dbOnlyView);
    render(dialog());
    clickButton("조회");

    for (const itemName of ["원부자재 매입", "진행 중 생산", "오프라인 현수막"]) {
      const row = detailsFor(itemName);
      expect(row.textContent).toMatch(/시스템|자동 반영/);
      expect(row.textContent).toMatch(/읽기 전용|수정할 수 없/);
      expect(row.querySelectorAll("button")).toHaveLength(0);
    }
    expect(detailsFor("진행 중 생산").textContent).toContain("종료일이 없어 시작일에 전액 인식했습니다.");
    expect(document.body.textContent).not.toMatch(/수정|삭제|보관/);
  });

  it("changes cards, list, footer, and label together between month and all while excluding unallocated from month", () => {
    render(dialog());
    let summary = document.querySelector('[aria-label="비용 요약"]');
    expect(normalized(summary?.textContent)).toContain("DB비용₩980,000추가비용₩120,000총비용₩1,100,000");

    clickButton("조회");
    expect(document.body.textContent).toContain("2026년 7월");
    expect(document.body.textContent).not.toContain("시작일 확인 필요 생산");
    expect(occurrences(document.body.textContent ?? "", "₩1,100,000")).toBeGreaterThanOrEqual(2);

    clickButton("전체");
    summary = document.querySelector('[aria-label="비용 요약"]');
    expect(normalized(summary?.textContent)).toContain("DB비용₩1,080,000추가비용₩120,000총비용₩1,200,000");
    expect(document.body.textContent).toContain("전체 기간");
    expect(document.body.textContent).toContain("시작일 확인 필요 생산");
    expect(detailsFor("시작일 확인 필요 생산").textContent).toContain("시작일을 확인할 수 없어 전체와 카테고리에만 1회 반영했습니다.");
    expect(detailsFor("시작일 확인 필요 생산").textContent).not.toContain("NaN");
    expect(occurrences(document.body.textContent ?? "", "₩1,200,000")).toBeGreaterThanOrEqual(2);
  });

  it("uses frozen category totals for DB, user, archived, and unclassified rows in amount order", () => {
    render(dialog());
    clickButton("조회");
    clickButton("카테고리");

    const rows = [...document.querySelectorAll("tbody tr")];
    expect(rows).toHaveLength(5);
    const text = rows.map((row) => normalized(row.textContent));
    expect(text[0]).toMatch(/^매입DB.*50(?:\.0)?%.*1건.*₩600,000$/);
    expect(text[1]).toMatch(/^직접생산.*33\.3+%.*2건.*₩400,000$/);
    expect(text[2]).toMatch(/^현수막.*6\.7+%.*1건.*₩80,000$/);
    expect(text[3]).toMatch(/^마케팅.*보관.*6(?:\.0)?%.*1건.*₩72,000$/);
    expect(text[4]).toMatch(/^미분류.*4(?:\.0)?%.*1건.*₩48,000$/);
    expect(normalized(document.querySelector("table")?.textContent)).toContain("₩1,200,000");
  });

  it("never exposes system categories through category mutation controls", () => {
    render(dialog());
    act(() => document.querySelector<HTMLButtonElement>('[role="combobox"]')?.click());

    expect(document.body.textContent).not.toContain("마케팅");
    expect(document.body.textContent).toContain("미분류");
    for (const systemName of ["매입DB", "직접생산", "현수막"]) {
      expect(document.body.textContent).not.toContain(systemName);
    }
    expect(document.querySelector('[aria-label="미분류 카테고리 삭제"]')).toBeNull();
    expect(document.querySelectorAll('button[aria-label$="카테고리 삭제"]')).toHaveLength(0);
  });

  it("separates loading, safe failure with retry, and recovered zero totals", () => {
    ledgerQueryState = { data: undefined, isLoading: true, isFetching: true, isSuccess: false, error: null, refetch: vi.fn() };
    render(dialog());
    clickButton("조회");
    expect(document.body.textContent).toMatch(/비용 (내역|원장)을 (불러오고 있습니다|불러오는 중입니다)/);
    expect(document.body.textContent).not.toContain("해당 조건의 비용이 없습니다.");

    const retry = vi.fn();
    ledgerQueryState = { data: undefined, isLoading: false, isFetching: false, isSuccess: false, error: new Error("HTTP 503 database-secret"), refetch: retry };
    rerender(dialog());
    expect(document.body.textContent).toMatch(/비용 (내역|원장)을 불러오지 못했습니다.*다시 시도해 주세요/);
    expect(document.body.textContent).not.toContain("database-secret");
    clickButton("다시 시도");
    expect(retry).toHaveBeenCalledOnce();

    viewFixture = () => emptyAllView;
    ledgerQueryState = loaded(emptyAllView);
    rerender(dialog());
    clickButton("전체");
    const summary = document.querySelector('[aria-label="비용 요약"]');
    expect(normalized(summary?.textContent)).toContain("DB비용₩0추가비용₩0총비용₩0");
    expect(document.body.textContent).toContain("전체 기간");
    expect(document.body.textContent).toContain("해당 조건의 비용이 없습니다.");
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
  });
});
