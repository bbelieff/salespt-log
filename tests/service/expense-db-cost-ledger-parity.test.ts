import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUserByEmail: vi.fn(),
  loadDBOverview: vi.fn(),
  listExpenseCategories: vi.fn(),
  listExpenseEntries: vi.fn(),
  listRecurringOccurrences: vi.fn(),
  materializeOccurrences: vi.fn(),
}));

vi.mock("@/repo/users", () => ({ findUserByEmail: mocks.findUserByEmail }));
vi.mock("@/service/db", () => ({ loadDBOverview: mocks.loadDBOverview }));
vi.mock("@/repo/db/expense-ledger", () => ({
  archiveRecurringRule: vi.fn(),
  createExpenseCategory: vi.fn(),
  createExpenseEntry: vi.fn(),
  createRecurringRule: vi.fn(),
  deleteExpenseEntry: vi.fn(),
  listExpenseCategories: mocks.listExpenseCategories,
  listExpenseEntries: mocks.listExpenseEntries,
  listRecurringOccurrences: mocks.listRecurringOccurrences,
  listRecurringRules: vi.fn(),
  materializeOccurrences: mocks.materializeOccurrences,
  occurrenceDateForMonth: vi.fn(),
  patchExpenseCategory: vi.fn(),
  patchExpenseEntry: vi.fn(),
  patchRecurringOccurrence: vi.fn(),
  pauseRecurringRule: vi.fn(),
  resumeRecurringRule: vi.fn(),
  skipRecurringOccurrence: vi.fn(),
  splitRecurringRuleFromMonth: vi.fn(),
}));

import { getExpenseLedger } from "@/service/expense-ledger";
import { applyAdditionalCostToDashboard } from "@/service/dashboard";

const USER_CATEGORY_ID = "11111111-1111-4111-8111-111111111111";
const UNCLASSIFIED_ID = "22222222-2222-4222-8222-222222222222";

interface ContractEntry {
  source: "one_time" | "recurring" | "db_purchase" | "db_production" | "db_banner";
  id: string;
  categoryId: string;
  categoryName: string;
  itemName: string;
  amountWon: number;
  periodStart: string;
  periodEnd: string;
  system: boolean;
  readOnly: boolean;
  recognitionStatus: "allocated" | "recognized_on_date" | "recognized_on_start" | "unallocated";
  recognitionNote: string | null;
}

interface ContractCategoryTotal {
  categoryId: string;
  categoryName: string;
  amountWon: number;
  itemCount: number;
  sharePercent: number;
  system: boolean;
  archived: boolean;
}

interface ContractLedger {
  view: "month" | "all" | "category";
  month: string | null;
  selectedScope: {
    view: "month" | "all" | "category";
    month: string | null;
    categoryId: string | null;
    label: string;
  };
  categories: Array<{ id: string; name: string }>;
  entries: ContractEntry[];
  categoryTotals: ContractCategoryTotal[];
  dbCostTotal: number;
  additionalCostTotal: number;
  totalCost: number;
}

type Overview = {
  purchases: Array<Record<string, unknown>>;
  productions: Array<Record<string, unknown>>;
  banners: Array<Record<string, unknown>>;
  leads: Array<Record<string, unknown>>;
};

function overview(parts: Partial<Overview> = {}): Overview {
  return { purchases: [], productions: [], banners: [], leads: [], ...parts };
}

function purchase(row: number, date: string, amountWon: number, company = `매입처-${row}`) {
  return { row, 구매일: date, 업체명: company, 개당단가: amountWon, 주문개수: 1, 주문금액: amountWon, 기타: "", 부가세여부: false };
}

function banner(row: number, date: string, amountWon: number, company = `현수막-${row}`) {
  return { row, 날짜: date, 업체명: company, 도착일: "", 개당단가: amountWon, 주문개수: 1, 주문금액: amountWon, 기타: "", 부가세여부: false };
}

function production(row: number, start: string, end: string, amountWon: number, material = `소재-${row}`) {
  return { row, 시작일: start, 종료일: end, 소재: material, 기간예산: amountWon, 생산개수: 0, 기타: "", 부가세여부: false };
}

function contract(value: Awaited<ReturnType<typeof getExpenseLedger>>): ContractLedger {
  return value as unknown as ContractLedger;
}

async function ledger(query: { view: "month" | "all" | "category"; month?: string; categoryId?: string }) {
  return contract(await getExpenseLedger("owner@example.com", query));
}

function bySource(result: ContractLedger, source: ContractEntry["source"]) {
  return result.entries.filter((entry) => entry.source === source);
}

function totalByName(result: ContractLedger, categoryName: string) {
  const row = result.categoryTotals.find((item) => item.categoryName === categoryName);
  if (!row) throw new Error(`missing category total: ${categoryName}`);
  return row;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-15T03:00:00.000Z"));
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.findUserByEmail.mockResolvedValue({ spreadsheetId: "sheet-1" });
  mocks.loadDBOverview.mockResolvedValue(overview());
  mocks.listExpenseCategories.mockResolvedValue([
    { id: USER_CATEGORY_ID, name: "운영비", archivedAt: null, createdAt: "2026-07-01", updatedAt: "2026-07-01" },
    { id: UNCLASSIFIED_ID, name: "미분류", archivedAt: null, createdAt: "2026-07-01", updatedAt: "2026-07-01" },
  ]);
  mocks.listExpenseEntries.mockResolvedValue([]);
  mocks.listRecurringOccurrences.mockResolvedValue([]);
  mocks.materializeOccurrences.mockResolvedValue(undefined);
});

afterAll(() => vi.useRealTimers());

describe("DB cost → expense ledger public service contract", () => {
  it("reproduces the screenshot case as a nonempty all/category ledger: 1,080,000 + 0 = 1,080,000", async () => {
    mocks.loadDBOverview.mockResolvedValue(overview({
      purchases: [purchase(2, "2026-07-10", 1_080_000, "스크린샷 매입처")],
    }));

    const all = await ledger({ view: "all" });
    expect(all.selectedScope).toMatchObject({ view: "all", month: null, categoryId: null, label: expect.any(String) });
    expect(all.entries).toHaveLength(1);
    expect(all.entries[0]).toMatchObject({
      source: "db_purchase",
      categoryId: "system:db_purchase",
      categoryName: "매입DB",
      amountWon: 1_080_000,
      periodStart: "2026-07-10",
      periodEnd: "2026-07-10",
      system: true,
      readOnly: true,
      recognitionStatus: "recognized_on_date",
      recognitionNote: expect.any(String),
    });
    expect(all).toMatchObject({ dbCostTotal: 1_080_000, additionalCostTotal: 0, totalCost: 1_080_000 });
    expect(totalByName(all, "매입DB")).toEqual(expect.objectContaining({
      categoryId: "system:db_purchase", amountWon: 1_080_000, itemCount: 1,
      sharePercent: 100, system: true, archived: false,
    }));
    expect(all.categories.some((category) => category.id.startsWith("system:"))).toBe(false);

    const category = await ledger({ view: "category", categoryId: "system:db_purchase" });
    expect(category.selectedScope).toMatchObject({
      view: "category",
      categoryId: "system:db_purchase",
      label: "매입DB",
    });
    expect(category.entries).toHaveLength(1);
    expect(category).toMatchObject({ dbCostTotal: 1_080_000, additionalCostTotal: 0, totalCost: 1_080_000 });
    expect(totalByName(category, "매입DB").amountWon).toBe(1_080_000);
  });

  it("filters purchase by 구매일 and banner by 날짜 at both month boundaries", async () => {
    mocks.loadDBOverview.mockResolvedValue(overview({
      purchases: [purchase(2, "2026-07-31", 100), purchase(3, "2026-08-01", 200)],
      banners: [banner(10, "2026-07-01", 300), banner(11, "2026-08-31", 400)],
    }));

    const july = await ledger({ view: "month", month: "2026-07" });
    expect(july.selectedScope).toMatchObject({ view: "month", month: "2026-07" });
    expect(july.entries.map((entry) => [entry.source, entry.amountWon])).toEqual([
      ["db_purchase", 100],
      ["db_banner", 300],
    ]);
    expect(july.entries.every((entry) => entry.recognitionStatus === "recognized_on_date")).toBe(true);
    expect(july.dbCostTotal).toBe(400);

    const august = await ledger({ view: "month", month: "2026-08" });
    expect(august.entries.map((entry) => [entry.source, entry.amountWon])).toEqual([
      ["db_purchase", 200],
      ["db_banner", 400],
    ]);
    expect(august.dbCostTotal).toBe(600);
  });

  it("allocates a valid production period inclusively across a month boundary", async () => {
    mocks.loadDBOverview.mockResolvedValue(overview({
      productions: [production(20, "2026-07-31", "2026-08-02", 100)],
    }));

    const july = await ledger({ view: "month", month: "2026-07" });
    const august = await ledger({ view: "month", month: "2026-08" });
    expect(bySource(july, "db_production")).toEqual([
      expect.objectContaining({ amountWon: 34, periodStart: "2026-07-31", periodEnd: "2026-08-02", recognitionStatus: "allocated" }),
    ]);
    expect(bySource(august, "db_production")).toEqual([
      expect.objectContaining({ amountWon: 66, periodStart: "2026-07-31", periodEnd: "2026-08-02", recognitionStatus: "allocated" }),
    ]);
    expect(july.dbCostTotal + august.dbCostTotal).toBe(100);
  });

  it("includes both day 1 and day 31, with no spill into adjacent months", async () => {
    mocks.loadDBOverview.mockResolvedValue(overview({
      productions: [production(21, "2026-07-01", "2026-07-31", 3_100)],
    }));

    await expect(ledger({ view: "month", month: "2026-06" })).resolves.toMatchObject({ dbCostTotal: 0, totalCost: 0 });
    await expect(ledger({ view: "month", month: "2026-07" })).resolves.toMatchObject({ dbCostTotal: 3_100, totalCost: 3_100 });
    await expect(ledger({ view: "month", month: "2026-08" })).resolves.toMatchObject({ dbCostTotal: 0, totalCost: 0 });
  });

  it.each([
    ["missing end", ""],
    ["invalid end", "2026-02-30"],
    ["end before start", "2026-07-09"],
  ])("recognizes ADR-0022 ongoing production once at start for %s", async (_label, end) => {
    mocks.loadDBOverview.mockResolvedValue(overview({
      productions: [production(30, "2026-07-10", end, 90_000)],
    }));

    const all = await ledger({ view: "all" });
    const july = await ledger({ view: "month", month: "2026-07" });
    const august = await ledger({ view: "month", month: "2026-08" });
    expect(bySource(all, "db_production")).toEqual([
      expect.objectContaining({ amountWon: 90_000, periodStart: "2026-07-10", periodEnd: "2026-07-10", recognitionStatus: "recognized_on_start", recognitionNote: expect.any(String) }),
    ]);
    expect(bySource(july, "db_production")).toHaveLength(1);
    expect(bySource(august, "db_production")).toHaveLength(0);
    expect(all.dbCostTotal).toBe(90_000);
    expect(july.dbCostTotal).toBe(90_000);
    expect(august.dbCostTotal).toBe(0);
  });

  it("keeps missing/invalid-start budgets once as explicit unallocated all/category costs and excludes every month", async () => {
    mocks.loadDBOverview.mockResolvedValue(overview({
      productions: [
        production(40, "", "", 40_000, "시작일 없음"),
        production(41, "2026-02-30", "2026-03-02", 50_000, "시작일 오류"),
      ],
    }));

    const all = await ledger({ view: "all" });
    const category = await ledger({ view: "category", categoryId: "system:db_production" });
    for (const result of [all, category]) {
      expect(bySource(result, "db_production")).toHaveLength(2);
      expect(bySource(result, "db_production").map((entry) => entry.amountWon)).toEqual([40_000, 50_000]);
      expect(bySource(result, "db_production").every((entry) => (
        entry.recognitionStatus === "unallocated"
        && entry.periodStart === ""
        && entry.periodEnd === ""
        && typeof entry.recognitionNote === "string"
        && entry.recognitionNote.length > 0
      ))).toBe(true);
      expect(result.dbCostTotal).toBe(90_000);
    }

    for (const month of ["2026-01", "2026-02", "2026-03", "2026-07"]) {
      const result = await ledger({ view: "month", month });
      expect(bySource(result, "db_production")).toHaveLength(0);
      expect(result.dbCostTotal).toBe(0);
    }
  });

  it("projects equivalent DB-primary and sheet-fallback normalized rows identically", async () => {
    const dbPrimary = overview({
      purchases: [purchase(2, "2026-07-10", 10_000)],
      productions: [production(3, "2026-07-01", "2026-07-02", 20_000)],
      banners: [banner(4, "2026-07-20", 30_000)],
    });
    const sheetFallback = structuredClone(dbPrimary);
    mocks.loadDBOverview.mockResolvedValueOnce(dbPrimary).mockResolvedValueOnce(sheetFallback);

    const fromDb = await ledger({ view: "all" });
    const fromSheet = await ledger({ view: "all" });
    expect(fromSheet).toEqual(fromDb);
    expect(fromDb).toMatchObject({ dbCostTotal: 60_000, additionalCostTotal: 0, totalCost: 60_000 });
  });

  it("combines manual + active recurring + DB totals and builds cost-desc category share/count including unclassified", async () => {
    mocks.loadDBOverview.mockResolvedValue(overview({
      purchases: [purchase(2, "2026-07-05", 60_000)],
      productions: [production(3, "2026-07-10", "2026-07-10", 90_000)],
      banners: [banner(4, "2026-07-20", 40_000)],
    }));
    mocks.listExpenseEntries.mockResolvedValue([{
      id: "33333333-3333-4333-8333-333333333333",
      categoryId: USER_CATEGORY_ID,
      categoryName: "운영비",
      itemName: "수기 비용",
      amountWon: 20_000,
      periodStart: "2026-07-10",
      periodEnd: "2026-07-10",
      createdAt: "2026-07-10",
      updatedAt: "2026-07-10",
    }]);
    mocks.listRecurringOccurrences.mockResolvedValue([
      { id: "rec-active", ruleId: "rule-1", categoryId: USER_CATEGORY_ID, categoryName: "운영비", itemName: "반복 비용", amountWon: 30_000, occurrenceDate: "2026-07-15", occurrenceMonth: "2026-07", status: "active" },
      { id: "rec-skipped", ruleId: "rule-1", categoryId: USER_CATEGORY_ID, categoryName: "운영비", itemName: "제외 비용", amountWon: 999_000, occurrenceDate: "2026-07-16", occurrenceMonth: "2026-07", status: "skipped" },
    ]);

    const all = await ledger({ view: "all" });
    expect(all).toMatchObject({ dbCostTotal: 190_000, additionalCostTotal: 50_000, totalCost: 240_000 });
    expect(all.entries).toHaveLength(5);
    expect(all.entries.filter((entry) => entry.system).every((entry) => entry.readOnly && entry.recognitionNote !== null)).toBe(true);
    expect(all.entries.some((entry) => entry.id === "rec-skipped")).toBe(false);
    expect(bySource(all, "recurring")).toEqual([
      expect.objectContaining({
        id: "rec-active",
        amountWon: 30_000,
        system: false,
        readOnly: false,
        recognitionStatus: "recognized_on_date",
      }),
    ]);

    expect(all.categoryTotals.map((row) => [row.categoryName, row.amountWon, row.itemCount])).toEqual([
      ["직접생산", 90_000, 1],
      ["매입DB", 60_000, 1],
      ["운영비", 50_000, 2],
      ["현수막", 40_000, 1],
      ["미분류", 0, 0],
    ]);
    for (const row of all.categoryTotals) {
      expect(row.sharePercent).toBeCloseTo(row.amountWon / all.totalCost * 100, 8);
    }
    expect(all.categoryTotals.reduce((sum, row) => sum + row.sharePercent, 0)).toBeCloseTo(100, 8);
    expect(totalByName(all, "운영비")).toMatchObject({ system: false, archived: false });
    expect(totalByName(all, "미분류")).toMatchObject({ system: false, archived: false, sharePercent: 0 });

    const finance = applyAdditionalCostToDashboard(all.dbCostTotal, 500_000, {
      status: "available",
      dbCostTotal: 0,
      additionalCost: all.additionalCostTotal,
      recognizedThrough: "2026-09-15",
    });
    expect(finance).toMatchObject({ totalCost: 240_000, operatingProfit: 260_000, operatingProfitRate: 52 });
    expect(finance.additionalCost).toMatchObject({ dbCostTotal: 190_000, additionalCost: 50_000 });
  });
});
