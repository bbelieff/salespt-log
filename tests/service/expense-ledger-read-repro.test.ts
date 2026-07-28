import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 라이브 P1 재현 — "저장은 되는데 조회·계산에 안 잡힘"(2026-07-28, 연습 계정).
 * 일회성 비용 7/1~7/31 ₩300,000 이 저장됐다는 전제에서 getExpenseLedger 가
 * month/all 뷰에 그 비용을 실제로 실어 오는지 파이프라인 전체로 확인한다.
 * (기존 테스트는 순수함수만 덮어 이 층이 비어 있었다.)
 */
const listExpenseEntries = vi.fn();
const listRecurringOccurrences = vi.fn();
const listExpenseCategories = vi.fn();
const materializeOccurrences = vi.fn();
const findUserByEmail = vi.fn();

vi.mock("@/repo/users", () => ({ findUserByEmail: (...a: unknown[]) => findUserByEmail(...a) }));
vi.mock("@/repo/db/expense-ledger", () => ({
  listExpenseEntries: (...a: unknown[]) => listExpenseEntries(...a),
  listRecurringOccurrences: (...a: unknown[]) => listRecurringOccurrences(...a),
  listExpenseCategories: (...a: unknown[]) => listExpenseCategories(...a),
  materializeOccurrences: (...a: unknown[]) => materializeOccurrences(...a),
  listRecurringRules: vi.fn(),
  occurrenceDateForMonth: vi.fn(),
  archiveRecurringRule: vi.fn(), createExpenseCategory: vi.fn(), createExpenseEntry: vi.fn(),
  createRecurringRule: vi.fn(), deleteExpenseEntry: vi.fn(), patchExpenseCategory: vi.fn(),
  patchExpenseEntry: vi.fn(), patchRecurringOccurrence: vi.fn(), pauseRecurringRule: vi.fn(),
  resumeRecurringRule: vi.fn(), skipRecurringOccurrence: vi.fn(), splitRecurringRuleFromMonth: vi.fn(),
}));

const SHEET = "sheet-practice";
const EMAIL = "practice@example.com";
const CATEGORY = { id: "cat-1", name: "광고비", archivedAt: null };
/** 라이브 입력 그대로: 기간 2026-07-01~31, 30만원 */
const LIVE_ENTRY = {
  id: "entry-1", categoryId: CATEGORY.id, categoryName: CATEGORY.name, itemName: "네이버 광고",
  amountWon: 300_000, periodStart: "2026-07-01", periodEnd: "2026-07-31",
};

describe("P1 재현: 저장된 일회성 비용이 조회·합계에 잡히는가", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUserByEmail.mockResolvedValue({ spreadsheetId: SHEET, cohort: "연습" });
    listExpenseCategories.mockResolvedValue([CATEGORY]);
    listExpenseEntries.mockResolvedValue([LIVE_ENTRY]);
    listRecurringOccurrences.mockResolvedValue([]);
    materializeOccurrences.mockResolvedValue(undefined);
  });

  it("month 뷰(2026-07)에 30만원이 그대로 실린다", async () => {
    const { getExpenseLedger } = await import("@/service/expense-ledger");
    const view = await getExpenseLedger(EMAIL, { view: "month", month: "2026-07" });
    expect(view.entries.map((e) => e.id)).toContain("entry-1");
    expect(view.additionalCostTotal).toBe(300_000);
  });

  it("all 뷰에도 실린다(오늘까지 일할 인식 → 0원이 아니어야 한다)", async () => {
    const { getExpenseLedger } = await import("@/service/expense-ledger");
    const view = await getExpenseLedger(EMAIL, { view: "all" });
    expect(view.entries.map((e) => e.id)).toContain("entry-1");
    expect(view.additionalCostTotal).toBeGreaterThan(0);
  });

  it("조회는 저장과 같은 시트 범위를 읽는다(scope 일치)", async () => {
    const { getExpenseLedger } = await import("@/service/expense-ledger");
    await getExpenseLedger(EMAIL, { view: "month", month: "2026-07" });
    expect(listExpenseEntries).toHaveBeenCalledWith(SHEET);
  });
});
