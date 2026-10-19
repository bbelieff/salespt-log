import { describe, expect, it } from "vitest";
import { recognizedAmountForRange, recognizeRecurringOccurrencesForRange } from "@/service/expense-ledger";
import type { ExpenseEntry } from "@/types/expense-ledger";


/** 대시보드 서버 계산은 걷어냈다(구조 개선 ③④) — 같은 인식 규칙을 원장 함수로 직접 고정한다. */
type Occ = Parameters<typeof recognizeRecurringOccurrencesForRange>[0];
const recognizedTotal = (entries: ExpenseEntry[], occurrences: Occ, from: string, through: string) =>
  entries.reduce((sum, e) => sum + recognizedAmountForRange(e.amountWon, e.periodStart, e.periodEnd, from, through), 0)
  + recognizeRecurringOccurrencesForRange(occurrences, from, through).reduce((sum, o) => sum + o.amountWon, 0);

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
    const total = recognizedTotal(
      [entry()],
      [{
        id: "rec-1", ruleId: "rule-1", categoryId, categoryName: "급여", itemName: "직원 급여",
        amountWon: 1_000, occurrenceDate: "2026-07-20", occurrenceMonth: "2026-07", status: "active", isOverride: false,
      }],
      "2026-07-16",
      "2026-07-20",
    );
    expect(total).toBe(1_500);
  });

  it("excludes skipped, voided, and out-of-range recurring costs", () => {
    const recurring = [
      { id: "start", ruleId: "rule-1", categoryId, categoryName: "급여", itemName: "직원 급여", amountWon: 1_000, occurrenceDate: "2026-07-01", occurrenceMonth: "2026-07", status: "active" as const, isOverride: false },
      { id: "end", ruleId: "rule-1", categoryId, categoryName: "급여", itemName: "직원 급여", amountWon: 2_000, occurrenceDate: "2026-07-31", occurrenceMonth: "2026-07", status: "active" as const, isOverride: false },
      { id: "skip", ruleId: "rule-1", categoryId, categoryName: "급여", itemName: "직원 급여", amountWon: 9_000, occurrenceDate: "2026-07-15", occurrenceMonth: "2026-07", status: "skipped" as const, isOverride: false },
      { id: "void", ruleId: "rule-1", categoryId, categoryName: "급여", itemName: "직원 급여", amountWon: 9_000, occurrenceDate: "2026-07-20", occurrenceMonth: "2026-07", status: "voided" as const, isOverride: false },
      { id: "late", ruleId: "rule-1", categoryId, categoryName: "급여", itemName: "직원 급여", amountWon: 9_000, occurrenceDate: "2026-08-01", occurrenceMonth: "2026-08", status: "active" as const, isOverride: false },
    ];
    expect(recognizedTotal([], recurring, "2026-07-01", "2026-07-31")).toBe(3_000);
  });
});
