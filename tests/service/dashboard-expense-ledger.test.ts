import { describe, expect, it } from "vitest";
import {
  applyAdditionalCostToDashboard,
  calculateAdditionalCostForDashboard,
} from "@/service/dashboard";
import type { ExpenseEntry } from "@/types/expense-ledger";

const categoryId = "11111111-1111-4111-8111-111111111111";

function entry(overrides: Partial<ExpenseEntry> = {}): ExpenseEntry {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    categoryId,
    categoryName: "임차료",
    itemName: "사무실 임대료",
    amountWon: 3_100,
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("dashboard expense ledger finance", () => {
  it("recognizes a date range only from course start through today", () => {
    const total = calculateAdditionalCostForDashboard(
      [entry()],
      [{
        id: "rec-1", ruleId: "rule-1", categoryId, categoryName: "급여", itemName: "직원 급여",
        amountWon: 1_000, occurrenceDate: "2026-07-20", occurrenceMonth: "2026-07", status: "active",
      }],
      "2026-07-16",
      "2026-07-20",
    );
    expect(total).toBe(1_500);
  });

  it("excludes skipped, voided, and out-of-range recurring costs", () => {
    const recurring = [
      { id: "start", ruleId: "rule-1", categoryId, categoryName: "급여", itemName: "직원 급여", amountWon: 1_000, occurrenceDate: "2026-07-01", occurrenceMonth: "2026-07", status: "active" as const },
      { id: "end", ruleId: "rule-1", categoryId, categoryName: "급여", itemName: "직원 급여", amountWon: 2_000, occurrenceDate: "2026-07-31", occurrenceMonth: "2026-07", status: "active" as const },
      { id: "skip", ruleId: "rule-1", categoryId, categoryName: "급여", itemName: "직원 급여", amountWon: 9_000, occurrenceDate: "2026-07-15", occurrenceMonth: "2026-07", status: "skipped" as const },
      { id: "void", ruleId: "rule-1", categoryId, categoryName: "급여", itemName: "직원 급여", amountWon: 9_000, occurrenceDate: "2026-07-20", occurrenceMonth: "2026-07", status: "voided" as const },
      { id: "late", ruleId: "rule-1", categoryId, categoryName: "급여", itemName: "직원 급여", amountWon: 9_000, occurrenceDate: "2026-08-01", occurrenceMonth: "2026-08", status: "active" as const },
    ];
    expect(calculateAdditionalCostForDashboard([], recurring, "2026-07-01", "2026-07-31")).toBe(3_000);
    const finance = applyAdditionalCostToDashboard(4_000, 20_000, {
      status: "available", dbCostTotal: 0, additionalCost: 3_000, recognizedThrough: "2026-07-31",
    });
    expect(finance).toMatchObject({ totalCost: 7_000, operatingProfit: 13_000, operatingProfitRate: 65 });
  });

  it("adds ledger cost to finance without changing acquisition-channel costs", () => {
    const out = applyAdditionalCostToDashboard(3_000, 10_000, {
      status: "available", dbCostTotal: 0, additionalCost: 1_500, recognizedThrough: "2026-07-23",
    });
    expect(out.totalCost).toBe(4_500);
    expect(out.operatingProfit).toBe(5_500);
    expect(out.additionalCost).toMatchObject({
      status: "available", dbCostTotal: 3_000, additionalCost: 1_500,
    });
  });

  it("keeps DB cost readable and exposes an unavailable ledger state", () => {
    const out = applyAdditionalCostToDashboard(3_000, 10_000, {
      status: "unavailable", dbCostTotal: 0, additionalCost: null,
      recognizedThrough: "2026-07-23", errorCode: "expense_ledger_unavailable",
    });
    expect(out.totalCost).toBe(3_000);
    expect(out.operatingProfit).toBe(7_000);
    expect(out.additionalCost).toMatchObject({
      status: "unavailable", dbCostTotal: 3_000, additionalCost: null,
      errorCode: "expense_ledger_unavailable",
    });
  });
});
