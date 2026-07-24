import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const FREEZE_ENV = "EXPENSE_CATEGORY_MIGRATION_FREEZE_R6";
const originalFreeze = process.env[FREEZE_ENV];

const api = vi.hoisted(() => ({
  getActiveUserEmail: vi.fn(),
  getWritableUserEmail: vi.fn(),
  getCurrentUserEmail: vi.fn(),
  isArenaSelfView: vi.fn(),
  getExpenseLedger: vi.fn(),
  addExpense: vi.fn(),
  addExpenseCategory: vi.fn(),
  addRecurringExpense: vi.fn(),
  getRecurringExpenseRules: vi.fn(),
  loadDashboard: vi.fn(),
  resolveArenaOverride: vi.fn(),
}));

vi.mock("@/auth/identity", () => ({
  getActiveUserEmail: api.getActiveUserEmail,
  getWritableUserEmail: api.getWritableUserEmail,
  isArenaSelfView: api.isArenaSelfView,
}));

vi.mock("@/auth/stub", () => ({ getCurrentUserEmail: api.getCurrentUserEmail }));

vi.mock("@/service/expense-ledger", () => ({
  getExpenseLedger: api.getExpenseLedger,
  addExpense: api.addExpense,
  addExpenseCategory: api.addExpenseCategory,
  addRecurringExpense: api.addRecurringExpense,
  getRecurringExpenseRules: api.getRecurringExpenseRules,
}));

vi.mock("@/service", () => ({
  loadDashboard: api.loadDashboard,
  resolveArenaOverride: api.resolveArenaOverride,
}));

vi.mock("@/lib/analytics/api-timing", () => ({
  withApiTiming: (_label: string, handler: unknown) => handler,
}));

import { GET as dashboardGET } from "@/app/api/dashboard/route";
import { GET as categoriesGET, POST as categoriesPOST } from "@/app/api/expense-categories/route";
import { GET as recurringGET, POST as recurringPOST } from "@/app/api/expense-recurring-rules/route";
import { GET as expensesGET, POST as expensesPOST } from "@/app/api/expenses/route";

const categoryId = "00000000-0000-4000-8000-000000000001";
const snapshot = {
  view: "all",
  month: null,
  categories: [{ id: categoryId, name: "Operations" }],
  entries: [],
  categoryTotals: [],
  dbCostTotal: 0,
  additionalCostTotal: 0,
  totalCost: 0,
  selectedScope: { view: "all", month: null, categoryId: null, label: "All" },
};

async function responseBody(response: Response) {
  return { status: response.status, body: await response.json() };
}

describe("R6 migration-freeze API compatibility", () => {
  beforeEach(() => {
    process.env[FREEZE_ENV] = "1";
    vi.clearAllMocks();
    api.getActiveUserEmail.mockResolvedValue("owner@example.com");
    api.getWritableUserEmail.mockResolvedValue("owner@example.com");
    api.getCurrentUserEmail.mockResolvedValue("owner@example.com");
    api.isArenaSelfView.mockResolvedValue(false);
    api.resolveArenaOverride.mockResolvedValue(undefined);
    api.getExpenseLedger.mockResolvedValue(snapshot);
    api.getRecurringExpenseRules.mockResolvedValue({ asOfDate: "2026-07-25", rules: [] });
    api.loadDashboard.mockResolvedValue({ additionalCost: { status: "available", additionalCost: 0 } });
  });

  afterAll(() => {
    if (originalFreeze === undefined) delete process.env[FREEZE_ENV];
    else process.env[FREEZE_ENV] = originalFreeze;
  });

  it("keeps dashboard, expenses, categories, and recurring GET snapshots available", async () => {
    await expect(responseBody(await dashboardGET())).resolves.toEqual({
      status: 200,
      body: { additionalCost: { status: "available", additionalCost: 0 } },
    });
    await expect(responseBody(await expensesGET(new NextRequest("http://localhost/api/expenses?view=all")))).resolves.toEqual({
      status: 200,
      body: snapshot,
    });
    await expect(responseBody(await categoriesGET())).resolves.toEqual({
      status: 200,
      body: { categories: snapshot.categories },
    });
    await expect(responseBody(await recurringGET())).resolves.toEqual({
      status: 200,
      body: { asOfDate: "2026-07-25", rules: [] },
    });
  });

  it.each([
    [
      "expenses",
      () => expensesPOST(new NextRequest("http://localhost/api/expenses", {
        method: "POST",
        body: JSON.stringify({ categoryId, itemName: "Hosting", amountWon: 10_000, periodStart: "2026-07-01" }),
      })),
      api.addExpense,
    ],
    [
      "categories",
      () => categoriesPOST(new NextRequest("http://localhost/api/expense-categories", {
        method: "POST",
        body: JSON.stringify({ name: "Operations" }),
      })),
      api.addExpenseCategory,
    ],
    [
      "recurring rules",
      () => recurringPOST(new NextRequest("http://localhost/api/expense-recurring-rules", {
        method: "POST",
        body: JSON.stringify({ categoryId, itemName: "Hosting", amountWon: 10_000, anchorDay: 1, startsOn: "2026-07-01" }),
      })),
      api.addRecurringExpense,
    ],
  ])("maps frozen %s mutations to the safe 503 response", async (_family, request, mutation) => {
    mutation.mockRejectedValueOnce(new Error("expense_ledger_unavailable"));

    await expect(responseBody(await request())).resolves.toEqual({
      status: 503,
      body: { error: "expense_ledger_unavailable" },
    });
  });
});
