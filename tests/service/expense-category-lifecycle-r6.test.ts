import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUserByEmail: vi.fn(), getExpenseCategoryUsage: vi.fn(), deleteExpenseCategory: vi.fn(), reclassifyUnclassified: vi.fn(),
}));
vi.mock("@/repo/users", () => ({ findUserByEmail: mocks.findUserByEmail }));
vi.mock("@/repo/db/expense-ledger", () => ({
  getExpenseCategoryUsage: mocks.getExpenseCategoryUsage, deleteExpenseCategory: mocks.deleteExpenseCategory, reclassifyUnclassified: mocks.reclassifyUnclassified,
  occurrenceDateForMonth: vi.fn(), listExpenseCategories: vi.fn(), listExpenseEntries: vi.fn(), listRecurringOccurrences: vi.fn(), listRecurringRules: vi.fn(), materializeOccurrences: vi.fn(),
  archiveRecurringRule: vi.fn(), createExpenseCategory: vi.fn(), createExpenseEntry: vi.fn(), createRecurringRule: vi.fn(), deleteExpenseEntry: vi.fn(), patchExpenseCategory: vi.fn(), patchExpenseEntry: vi.fn(), patchRecurringOccurrence: vi.fn(), pauseRecurringRule: vi.fn(), resumeRecurringRule: vi.fn(), skipRecurringOccurrence: vi.fn(), splitRecurringRuleFromMonth: vi.fn(),
}));
vi.mock("@/service/db", () => ({ loadDBOverview: vi.fn() }));

import { canonicalizeExpenseReclassification, getExpenseCategoryUsageForUser, reclassifyUnclassifiedForUser } from "@/service/expense-ledger";

const operationId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const targetCategoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const entryId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const occurrenceId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ruleId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

describe("R6 category lifecycle service contract", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.findUserByEmail.mockResolvedValue({ spreadsheetId: "sheet-1" }); });

  it("matches the frozen canonical hash vectors and ignores ref ordering", () => {
    const v1 = canonicalizeExpenseReclassification({ operationId, targetCategoryId, refs: [
      { kind: "recurringOccurrence", id: occurrenceId }, { kind: "entry", id: entryId }, { kind: "recurringRule", id: ruleId },
    ] });
    expect(v1.json).toBe(`{"v":1,"targetCategoryId":"${targetCategoryId}","refs":[{"kind":"entry","id":"${entryId}"},{"kind":"recurringRule","id":"${ruleId}"},{"kind":"recurringOccurrence","id":"${occurrenceId}"}]}`);
    expect(v1.hash).toBe("8e5fdc52b375f259f2741c0210449d4206bffd15248124ffd5241e085849c7fb");
    expect(canonicalizeExpenseReclassification({ operationId, targetCategoryId, refs: [{ kind: "entry", id: entryId }] }).hash)
      .toBe("5d011e9bc0e24c161c04ceb5a10fb33f0ff70d39b020bf74f0761b3e30f500a5");
  });

  it("rejects duplicate normalized typed refs before repository replay", () => {
    expect(() => canonicalizeExpenseReclassification({ operationId, targetCategoryId, refs: [{ kind: "entry", id: entryId }, { kind: "entry", id: entryId.toUpperCase() }] }))
      .toThrow("invalid_request");
    expect(mocks.reclassifyUnclassified).not.toHaveBeenCalled();
  });

  it("rejects virtual system usage without scope or repository disclosure", async () => {
    await expect(getExpenseCategoryUsageForUser("owner@example.com", "system:db_purchase")).rejects.toThrow("expense_category_system_immutable");
    expect(mocks.findUserByEmail).not.toHaveBeenCalled();
    expect(mocks.getExpenseCategoryUsage).not.toHaveBeenCalled();
  });

  it("passes the canonical operation and hash to one scoped repository transaction", async () => {
    mocks.reclassifyUnclassified.mockResolvedValue({ ok: true });
    await reclassifyUnclassifiedForUser("Owner@Example.com", { operationId, targetCategoryId, refs: [{ kind: "entry", id: entryId }] });
    expect(mocks.reclassifyUnclassified).toHaveBeenCalledWith("sheet-1", "owner@example.com", operationId, "5d011e9bc0e24c161c04ceb5a10fb33f0ff70d39b020bf74f0761b3e30f500a5", targetCategoryId, [{ kind: "entry", id: entryId }]);
  });
});
