import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveUserEmail: vi.fn(),
  getExpenseLedger: vi.fn(),
}));

vi.mock("@/auth/identity", () => ({
  getActiveUserEmail: mocks.getActiveUserEmail,
  getWritableUserEmail: vi.fn(),
}));
vi.mock("@/service/expense-ledger", () => ({
  addExpense: vi.fn(),
  getExpenseLedger: mocks.getExpenseLedger,
}));
vi.mock("@/lib/analytics/api-timing", () => ({
  withApiTiming: (_label: string, handler: unknown) => handler,
}));

import { GET } from "@/app/api/expenses/route";

const USER_CATEGORY_ID = "11111111-1111-4111-8111-111111111111";
const SYSTEM_CATEGORY_ID = "system:db_purchase";

function frozenLedger(
  view: "month" | "all" | "category" = "all",
  categoryId: string | null = null,
) {
  return {
    view,
    month: view === "month" ? "2026-07" : null,
    selectedScope: {
      view,
      month: view === "month" ? "2026-07" : null,
      categoryId,
      label: view === "category" ? "매입DB" : view === "month" ? "2026년 7월" : "전체 비용",
    },
    categories: [
      {
        id: USER_CATEGORY_ID,
        name: "운영비",
        archivedAt: null,
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    ],
    entries: [
      {
        source: "db_purchase",
        id: "db_purchase:2",
        categoryId: SYSTEM_CATEGORY_ID,
        categoryName: "매입DB",
        itemName: "스크린샷 매입",
        amountWon: 1_080_000,
        periodStart: "2026-07-10",
        periodEnd: "2026-07-10",
        system: true,
        readOnly: true,
        recognitionStatus: "recognized_on_date",
        recognitionNote: "구매일에 비용을 인식합니다.",
      },
    ],
    categoryTotals: [
      {
        categoryId: SYSTEM_CATEGORY_ID,
        categoryName: "매입DB",
        amountWon: 1_080_000,
        itemCount: 1,
        sharePercent: 100,
        system: true,
        archived: false,
      },
      {
        categoryId: USER_CATEGORY_ID,
        categoryName: "운영비",
        amountWon: 0,
        itemCount: 0,
        sharePercent: 0,
        system: false,
        archived: false,
      },
    ],
    dbCostTotal: 1_080_000,
    additionalCostTotal: 0,
    totalCost: 1_080_000,
  };
}

describe("GET /api/expenses frozen DB cost ledger response", () => {
  beforeEach(() => {
    mocks.getActiveUserEmail.mockReset().mockResolvedValue("owner@example.com");
    mocks.getExpenseLedger.mockReset();
  });

  it("returns the exact public all-view shape without dropping system/read-only recognition fields", async () => {
    const ledger = frozenLedger();
    mocks.getExpenseLedger.mockResolvedValue(ledger);

    const response = await GET(new NextRequest("http://localhost/api/expenses?view=all"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(ledger);
    expect(mocks.getActiveUserEmail).toHaveBeenCalledTimes(1);
    expect(mocks.getExpenseLedger).toHaveBeenCalledWith("owner@example.com", { view: "all" });
    expect(ledger.categories.every((category) => !category.id.startsWith("system:"))).toBe(true);
    expect(ledger.entries[0]).toEqual(expect.objectContaining({
      source: "db_purchase",
      system: true,
      readOnly: true,
      recognitionStatus: "recognized_on_date",
      recognitionNote: expect.any(String),
    }));
    expect(ledger).toEqual(expect.objectContaining({
      dbCostTotal: 1_080_000,
      additionalCostTotal: 0,
      totalCost: 1_080_000,
    }));
  });

  it.each([
    ["editable UUID", USER_CATEGORY_ID],
    ["frozen system id", SYSTEM_CATEGORY_ID],
  ])("accepts a category query using %s and forwards the exact public selector", async (_label, categoryId) => {
    const ledger = frozenLedger("category", categoryId);
    mocks.getExpenseLedger.mockResolvedValue(ledger);

    const response = await GET(new NextRequest(
      `http://localhost/api/expenses?view=category&categoryId=${encodeURIComponent(categoryId)}`,
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(ledger);
    expect(mocks.getExpenseLedger).toHaveBeenCalledWith("owner@example.com", {
      view: "category",
      categoryId,
    });
  });

  it("preserves month selection in selectedScope and the three frozen totals", async () => {
    const ledger = frozenLedger("month");
    mocks.getExpenseLedger.mockResolvedValue(ledger);

    const response = await GET(new NextRequest("http://localhost/api/expenses?view=month&month=2026-07"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(ledger);
    expect(mocks.getExpenseLedger).toHaveBeenCalledWith("owner@example.com", {
      view: "month",
      month: "2026-07",
    });
  });
});
