import { describe, expect, it } from "vitest";
import { allocateExpenseByDay, manageRecurringRules, recognizedAmountForRange, recognizeRecurringOccurrencesForRange } from "@/service/expense-ledger";
import {
  closeDateBeforeSplit,
  isOccurrencePaused,
  isOccurrenceWithinRuleWindow,
  isRecurringRuleMaterializable,
  occurrenceDateForMonth,
  recurringRuleStatusAfterAction,
  shouldVoidRecurringOccurrenceOnStop,
} from "@/repo/db/expense-ledger";
import { CreateExpenseBody, CreateRecurringRuleBody } from "@/types";

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

  /**
   * #625 blocker ③ — split 이 옛 규칙의 occurrence 를 무효화하지 않아 같은 달 이중 계상되던 회귀.
   * split 은 옛 규칙을 "발효일 하루 전"에 닫고, 그 날 **이후** occurrence 를 voided 로 만든다
   * (archive 경로와 동일 경계 = shouldVoidRecurringOccurrenceOnStop).
   */
  it("splits close the old rule the day before the effective date", () => {
    expect(closeDateBeforeSplit("2026-08-01")).toBe("2026-07-31"); // 월 경계
    expect(closeDateBeforeSplit("2026-03-01")).toBe("2026-02-28"); // 평년 2월
    expect(closeDateBeforeSplit("2024-03-01")).toBe("2024-02-29"); // 윤년 2월
    expect(closeDateBeforeSplit("2026-01-01")).toBe("2025-12-31"); // 연 경계
    expect(closeDateBeforeSplit("2026-08-15")).toBe("2026-08-14"); // 월 중간(anchorDay)
  });

  it("voids the old rule's occurrence in the effective month (no double count)", () => {
    // 8월부터 새 금액 적용 → 옛 규칙은 7/31 에 닫히고, 옛 규칙의 8월 occurrence 는 무효화돼야 한다.
    const close = closeDateBeforeSplit("2026-08-01");
    expect(shouldVoidRecurringOccurrenceOnStop("2026-08-01", close)).toBe(true); // 발효월 → void
    expect(shouldVoidRecurringOccurrenceOnStop("2026-09-01", close)).toBe(true); // 이후 달 → void
    // 이미 확정된 과거는 건드리지 않는다.
    expect(shouldVoidRecurringOccurrenceOnStop("2026-07-01", close)).toBe(false);
    expect(shouldVoidRecurringOccurrenceOnStop("2026-07-31", close)).toBe(false);
  });

  it("keeps the split boundary aligned with anchor day (25일 규칙)", () => {
    // anchorDay=25 규칙을 9월부터 바꾸면 발효일 9/25, 옛 규칙은 9/24 까지 유효 →
    // 9월 옛 occurrence(9/25)는 void, 8월(8/25)은 유지.
    const close = closeDateBeforeSplit("2026-09-25");
    expect(close).toBe("2026-09-24");
    expect(shouldVoidRecurringOccurrenceOnStop("2026-09-25", close)).toBe(true);
    expect(shouldVoidRecurringOccurrenceOnStop("2026-08-25", close)).toBe(false);
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
      ruleId: "rule-1", categoryId: "category-1", categoryName: "급여", itemName: "직원 급여", amountWon: 1_000, isOverride: false,
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
    expect(recognized.map(({ recurringRuleId, isOverride }) => ({ recurringRuleId, isOverride }))).toEqual([
      { recurringRuleId: "rule-1", isOverride: false },
      { recurringRuleId: "rule-1", isOverride: false },
    ]);
    expect(recognized.reduce((sum, item) => sum + item.amountWon, 0)).toBe(2_000);
  });
  it("keeps recurring-rule management state scoped to each rule and exposes the next occurrence", () => {
    const rule = {
      id: "00000000-0000-4000-8000-000000000001", categoryId: "00000000-0000-4000-8000-000000000002", categoryName: "임차료",
      itemName: "사무실", amountWon: 1_000_000, anchorDay: 15, startsOn: "2026-07-01", endsOn: null,
      status: "active" as const, supersedesRuleId: null, createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z",
    };
    const [managed] = manageRecurringRules([rule], [
      { id: "current", ruleId: rule.id, categoryId: rule.categoryId, categoryName: rule.categoryName, itemName: rule.itemName, amountWon: rule.amountWon, occurrenceDate: "2026-07-15", occurrenceMonth: "2026-07", status: "active", isOverride: false },
      { id: "next", ruleId: rule.id, categoryId: rule.categoryId, categoryName: rule.categoryName, itemName: rule.itemName, amountWon: rule.amountWon, occurrenceDate: "2026-08-15", occurrenceMonth: "2026-08", status: "active", isOverride: false },
      { id: "other", ruleId: "00000000-0000-4000-8000-000000000003", categoryId: rule.categoryId, categoryName: rule.categoryName, itemName: rule.itemName, amountWon: rule.amountWon, occurrenceDate: "2026-07-12", occurrenceMonth: "2026-07", status: "active", isOverride: false },
    ], "2026-07-20");
    expect(managed?.currentOccurrence).toEqual({ occurrenceDate: "2026-07-15", occurrenceMonth: "2026-07", status: "active" });
    expect(managed?.nextOccurrence).toEqual({ occurrenceDate: "2026-08-15", occurrenceMonth: "2026-08", status: "active" });
  });
  it("rejects invalid range and recurrence inputs before DB access", () => {
    expect(CreateExpenseBody.safeParse({ categoryId: "00000000-0000-4000-8000-000000000001", itemName: "임대료", amountWon: 1, periodStart: "2026-08-02", periodEnd: "2026-08-01" }).success).toBe(false);
    expect(CreateRecurringRuleBody.safeParse({ categoryId: "00000000-0000-4000-8000-000000000001", itemName: "급여", amountWon: 1000, anchorDay: 32, startsOn: "2026-08-01" }).success).toBe(false);
  });
});
