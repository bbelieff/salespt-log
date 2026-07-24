import { beforeEach, describe, expect, it, vi } from "vitest";
import { allocateExpenseByDay, getExpenseLedger, manageRecurringRules, recognizedAmountForRange, recognizeRecurringOccurrencesForRange } from "@/service/expense-ledger";
import { recognizeDbCostEntries } from "@/service/db-cost-ledger";
import {
  isOccurrencePaused,
  isOccurrenceWithinRuleWindow,
  isRecurringRuleMaterializable,
  occurrenceDateForMonth,
  recurringRuleStatusAfterAction,
  shouldVoidRecurringOccurrenceOnStop,
} from "@/repo/db/expense-ledger";
import { CreateExpenseBody, CreateRecurringRuleBody } from "@/types";

const mocks = vi.hoisted(() => ({
  findUserByEmail: vi.fn(),
  loadDBOverview: vi.fn(),
  materializeOccurrences: vi.fn(),
  listExpenseCategories: vi.fn(),
  listExpenseEntries: vi.fn(),
  listRecurringOccurrences: vi.fn(),
}));

vi.mock("@/repo/users", () => ({ findUserByEmail: mocks.findUserByEmail }));
vi.mock("@/service/db", () => ({ loadDBOverview: mocks.loadDBOverview }));
vi.mock("@/repo/db/expense-ledger", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/repo/db/expense-ledger")>(),
  materializeOccurrences: mocks.materializeOccurrences,
  listExpenseCategories: mocks.listExpenseCategories,
  listExpenseEntries: mocks.listExpenseEntries,
  listRecurringOccurrences: mocks.listRecurringOccurrences,
}));

const dbOverview = {
  purchases: [{ row: 4, 구매일: "2026-07-10", 업체명: "매입사", 개당단가: 100_000, 주문개수: 2, 주문금액: 200_000, 기타: "", 부가세여부: false }],
  productions: [
    { row: 4, 시작일: "2026-07-31", 종료일: "2026-08-02", 소재: "기간 생산", 기간예산: 400_000, 생산개수: 0, 개당단가: 0, 기타: "", 부가세여부: false },
    { row: 5, 시작일: "2026-07-20", 종료일: "", 소재: "생산중", 기간예산: 300_000, 생산개수: 0, 개당단가: 0, 기타: "", 부가세여부: false },
    { row: 6, 시작일: "날짜확인", 종료일: "", 소재: "미배분", 기간예산: 80_000, 생산개수: 0, 개당단가: 0, 기타: "", 부가세여부: false },
  ],
  banners: [{ row: 4, 날짜: "2026-07-12", 업체명: "현수막사", 도착일: "", 개당단가: 50_000, 주문개수: 2, 주문금액: 100_000, 기타: "", 부가세여부: false }],
  leads: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findUserByEmail.mockResolvedValue({ spreadsheetId: "sheet-1" });
  mocks.loadDBOverview.mockResolvedValue(dbOverview);
  mocks.materializeOccurrences.mockResolvedValue(undefined);
  mocks.listExpenseCategories.mockResolvedValue([]);
  mocks.listExpenseEntries.mockResolvedValue([]);
  mocks.listRecurringOccurrences.mockResolvedValue([]);
});

describe("expense ledger allocation", () => {
  it("includes both ends and gives remainder won to earliest days", () => {
    expect(allocateExpenseByDay(100, "2026-07-31", "2026-08-02")).toEqual([
      { date: "2026-07-31", amountWon: 34 }, { date: "2026-08-01", amountWon: 33 }, { date: "2026-08-02", amountWon: 33 },
    ]);
    expect(recognizedAmountForRange(100, "2026-07-31", "2026-08-02", "2026-08-01", "2026-08-31")).toBe(66);
  });
  it("clamps a 31st monthly rule for normal and leap Februaries", () => {
    expect(occurrenceDateForMonth("2025-02", 31)).toBe("2025-02-28");
    expect(occurrenceDateForMonth("2024-02", 31)).toBe("2024-02-29");
  });
  it("does not backfill months inside a closed or currently open pause interval", () => {
    const closed = [{ pausedOn: "2026-07-10", resumedOn: "2026-09-10" }];
    expect(isOccurrencePaused("2026-07-25", closed)).toBe(true);
    expect(isOccurrencePaused("2026-08-25", closed)).toBe(true);
    expect(isOccurrencePaused("2026-09-10", closed)).toBe(false);
    expect(isOccurrencePaused("2026-10-25", [{ pausedOn: "2026-10-01", resumedOn: null }])).toBe(true);
  });
  it("keeps start/end inclusive and voids only occurrences after the stop date", () => {
    expect(isOccurrenceWithinRuleWindow("2026-07-01", "2026-07-01", "2026-09-30")).toBe(true);
    expect(isOccurrenceWithinRuleWindow("2026-09-30", "2026-07-01", "2026-09-30")).toBe(true);
    expect(isOccurrenceWithinRuleWindow("2026-06-30", "2026-07-01", "2026-09-30")).toBe(false);
    expect(isOccurrenceWithinRuleWindow("2026-10-01", "2026-07-01", "2026-09-30")).toBe(false);
    expect(shouldVoidRecurringOccurrenceOnStop("2026-07-24", "2026-07-24")).toBe(false);
    expect(shouldVoidRecurringOccurrenceOnStop("2026-07-25", "2026-07-24")).toBe(true);
  });
  it("keeps DELETE archived state terminal against pause and resume", () => {
    const archived = recurringRuleStatusAfterAction("active", "archive");
    expect(archived).toBe("archived");
    expect(() => recurringRuleStatusAfterAction(archived, "pause")).toThrow("expense_rule_not_found");
    expect(() => recurringRuleStatusAfterAction(archived, "resume")).toThrow("expense_rule_not_found");
    expect(isRecurringRuleMaterializable(archived)).toBe(false);
  });
  it("does not revive or materialize a future-start rule after DELETE", () => {
    const futureRule = { startsOn: "2026-12-01", status: "active" as const };
    const deletedStatus = recurringRuleStatusAfterAction(futureRule.status, "archive");
    expect(futureRule.startsOn).toBe("2026-12-01");
    expect(() => recurringRuleStatusAfterAction(deletedStatus, "pause")).toThrow("expense_rule_not_found");
    expect(() => recurringRuleStatusAfterAction(deletedStatus, "resume")).toThrow("expense_rule_not_found");
    expect(isRecurringRuleMaterializable(deletedStatus)).toBe(false);
  });
  it("denies an active successor split from an archived rule", () => {
    expect(() => recurringRuleStatusAfterAction("archived", "split")).toThrow("expense_rule_not_found");
  });
  it("includes only active recurring occurrences in range and category", () => {
    const base = {
      ruleId: "rule-1", categoryId: "category-1", categoryName: "급여", itemName: "직원 급여", amountWon: 1_000,
    };
    const recognized = recognizeRecurringOccurrencesForRange([
      { ...base, id: "start", occurrenceDate: "2026-07-01", occurrenceMonth: "2026-07", status: "active" },
      { ...base, id: "end", occurrenceDate: "2026-07-31", occurrenceMonth: "2026-07", status: "active" },
      { ...base, id: "skipped", occurrenceDate: "2026-07-15", occurrenceMonth: "2026-07", status: "skipped" },
      { ...base, id: "voided", occurrenceDate: "2026-07-20", occurrenceMonth: "2026-07", status: "voided" },
      { ...base, id: "other", categoryId: "category-2", occurrenceDate: "2026-07-10", occurrenceMonth: "2026-07", status: "active" },
      { ...base, id: "outside", occurrenceDate: "2026-08-01", occurrenceMonth: "2026-08", status: "active" },
    ], "2026-07-01", "2026-07-31", "category-1");
    expect(recognized.map((item) => item.id)).toEqual(["start", "end"]);
    expect(recognized.reduce((sum, item) => sum + item.amountWon, 0)).toBe(2_000);
  });
  it("keeps recurring-rule management state scoped to each rule and exposes the next occurrence", () => {
    const rule = {
      id: "00000000-0000-4000-8000-000000000001", categoryId: "00000000-0000-4000-8000-000000000002", categoryName: "임차료",
      itemName: "사무실", amountWon: 1_000_000, anchorDay: 15, startsOn: "2026-07-01", endsOn: null,
      status: "active" as const, supersedesRuleId: null, createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z",
    };
    const [managed] = manageRecurringRules([rule], [
      { id: "current", ruleId: rule.id, categoryId: rule.categoryId, categoryName: rule.categoryName, itemName: rule.itemName, amountWon: rule.amountWon, occurrenceDate: "2026-07-15", occurrenceMonth: "2026-07", status: "active" },
      { id: "next", ruleId: rule.id, categoryId: rule.categoryId, categoryName: rule.categoryName, itemName: rule.itemName, amountWon: rule.amountWon, occurrenceDate: "2026-08-15", occurrenceMonth: "2026-08", status: "active" },
      { id: "other", ruleId: "00000000-0000-4000-8000-000000000003", categoryId: rule.categoryId, categoryName: rule.categoryName, itemName: rule.itemName, amountWon: rule.amountWon, occurrenceDate: "2026-07-12", occurrenceMonth: "2026-07", status: "active" },
    ], "2026-07-20");
    expect(managed?.currentOccurrence).toEqual({ occurrenceDate: "2026-07-15", occurrenceMonth: "2026-07", status: "active" });
    expect(managed?.nextOccurrence).toEqual({ occurrenceDate: "2026-08-15", occurrenceMonth: "2026-08", status: "active" });
  });
  it("rejects invalid range and recurrence inputs before DB access", () => {
    expect(CreateExpenseBody.safeParse({ categoryId: "00000000-0000-4000-8000-000000000001", itemName: "임대료", amountWon: 1, periodStart: "2026-08-02", periodEnd: "2026-08-01" }).success).toBe(false);
    expect(CreateRecurringRuleBody.safeParse({ categoryId: "00000000-0000-4000-8000-000000000001", itemName: "급여", amountWon: 1000, anchorDay: 32, startsOn: "2026-08-01" }).success).toBe(false);
  });
});

describe("DB cost ledger parity", () => {
  it("recognizes purchase/banner dates and allocates production across month boundaries", () => {
    const july = recognizeDbCostEntries(dbOverview, {
      view: "month", from: "2026-07-01", through: "2026-07-31",
    });
    expect(july.find((entry) => entry.id === "db_production:4")?.amountWon).toBe(133_334);
    expect(july.find((entry) => entry.id === "db_production:5")).toMatchObject({
      amountWon: 300_000, recognitionStatus: "recognized_on_start", system: true, readOnly: true,
    });
    expect(july.some((entry) => entry.id === "db_production:6")).toBe(false);
    expect(july.find((entry) => entry.source === "db_purchase")?.recognitionStatus).toBe("recognized_on_date");
    expect(july.find((entry) => entry.source === "db_banner")?.recognitionStatus).toBe("recognized_on_date");
  });

  it("includes missing/invalid start once in all/category but never in month", () => {
    const all = recognizeDbCostEntries(dbOverview, {
      view: "all", from: "0001-01-01", through: "9999-12-31",
    });
    expect(all.reduce((sum, entry) => sum + entry.amountWon, 0)).toBe(1_080_000);
    expect(all.filter((entry) => entry.id === "db_production:6")).toEqual([
      expect.objectContaining({
        amountWon: 80_000, periodStart: "", periodEnd: "", recognitionStatus: "unallocated",
        system: true, readOnly: true,
      }),
    ]);
    const category = recognizeDbCostEntries(dbOverview, {
      view: "category", from: "0001-01-01", through: "9999-12-31", categoryId: "system:db_production",
    });
    expect(category.map((entry) => entry.source)).toEqual(["db_production", "db_production", "db_production"]);
    expect(category.reduce((sum, entry) => sum + entry.amountWon, 0)).toBe(780_000);
  });

  it("combines manual, recurring, and DB totals with frozen scope/category metadata", async () => {
    mocks.listExpenseCategories.mockResolvedValue([{
      id: "11111111-1111-4111-8111-111111111111", name: "임차료", archivedAt: "2026-07-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z",
    }]);
    mocks.listExpenseEntries.mockResolvedValue([{
      id: "22222222-2222-4222-8222-222222222222", categoryId: "11111111-1111-4111-8111-111111111111",
      categoryName: "임차료", itemName: "사무실", amountWon: 200_000, periodStart: "2026-07-01", periodEnd: "2026-07-01",
      createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z",
    }]);
    mocks.listRecurringOccurrences.mockResolvedValue([{
      id: "rec-1", ruleId: "rule-1", categoryId: "11111111-1111-4111-8111-111111111111", categoryName: "임차료",
      itemName: "월 비용", amountWon: 100_000, occurrenceDate: "2026-07-02", occurrenceMonth: "2026-07", status: "active",
    }]);
    const view = await getExpenseLedger("owner@example.com", { view: "all" });
    expect(view).toMatchObject({
      dbCostTotal: 680_000,
      additionalCostTotal: 300_000,
      totalCost: 980_000,
      selectedScope: { view: "all", month: null, categoryId: null, label: "전체" },
    });
    expect(view.categories).toHaveLength(1);
    expect(view.categoryTotals.map((row) => row.amountWon)).toEqual([380_000, 300_000, 200_000, 100_000]);
    expect(view.categoryTotals.find((row) => row.categoryId === "system:db_production")).toMatchObject({
      categoryName: "직접생산", amountWon: 380_000, itemCount: 2, system: true, archived: false,
    });
    expect(view.categoryTotals.find((row) => row.categoryName === "임차료")).toMatchObject({
      amountWon: 300_000, itemCount: 2, system: false, archived: true,
    });
    expect(view.categoryTotals.reduce((sum, row) => sum + row.sharePercent, 0)).toBeCloseTo(100, 10);
  });
});
