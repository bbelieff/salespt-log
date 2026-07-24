import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const FREEZE_ENV = "EXPENSE_CATEGORY_MIGRATION_FREEZE_R6";
const originalFreeze = process.env[FREEZE_ENV];

const db = vi.hoisted(() => {
  const categoryRow = {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Operations",
    archived_at: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
  };
  const entryRow = {
    id: "00000000-0000-4000-8000-000000000002",
    category_id: categoryRow.id,
    category_name: categoryRow.name,
    item_name: "Hosting",
    amount_won: 10_000,
    period_start: "2026-07-01",
    period_end: "2026-07-31",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
  };
  const ruleRow = {
    id: "00000000-0000-4000-8000-000000000003",
    category_id: categoryRow.id,
    category_name: categoryRow.name,
    item_name: "Hosting",
    amount_won: 10_000,
    anchor_day: 1,
    starts_on: "2026-07-01",
    ends_on: null,
    status: "active",
    supersedes_rule_id: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
  };
  const occurrenceRow = {
    id: "00000000-0000-4000-8000-000000000004",
    rule_id: ruleRow.id,
    category_id: categoryRow.id,
    category_name: categoryRow.name,
    item_name: "Hosting",
    amount_won: 10_000,
    occurrence_date: "2026-07-01",
    occurrence_month: "2026-07-01",
    status: "active",
  };

  const resultFor = (sql: string) => {
    const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
    if (normalized.startsWith("select * from expense_categories")) return { rows: [categoryRow], rowCount: 1 };
    if (normalized.includes("from expense_entries e")) return { rows: [entryRow], rowCount: 1 };
    if (normalized.includes("from expense_recurring_rules r") && !normalized.includes("for update")) return { rows: [ruleRow], rowCount: 1 };
    if (normalized.includes("from expense_recurring_occurrences o")) return { rows: [occurrenceRow], rowCount: 1 };
    if (normalized.includes("from expense_recurring_rules r") && normalized.includes("for update")) return { rows: [], rowCount: 0 };
    return { rows: [], rowCount: 0 };
  };

  const poolQuery = vi.fn(async (sql: string) => resultFor(sql));
  const clientQuery = vi.fn(async (sql: string) => resultFor(sql));
  const client = { query: clientQuery, release: vi.fn() };
  const pool = { query: poolQuery, connect: vi.fn(async () => client) };
  const ensureSchema = vi.fn(async () => undefined);
  const dbEnabled = vi.fn(() => true);

  return { poolQuery, clientQuery, client, pool, ensureSchema, dbEnabled };
});

vi.mock("@/repo/db/client", () => ({
  dbEnabled: db.dbEnabled,
  ensureSchema: db.ensureSchema,
  getDbPool: () => db.pool,
}));

function setFreeze(value: string | undefined): void {
  if (value === undefined) delete process.env[FREEZE_ENV];
  else process.env[FREEZE_ENV] = value;
}

function resetDb(): void {
  db.poolQuery.mockClear();
  db.clientQuery.mockClear();
  db.pool.connect.mockClear();
  db.client.release.mockClear();
  db.ensureSchema.mockClear();
  db.dbEnabled.mockClear();
}

async function loadRepo() {
  vi.resetModules();
  return import("@/repo/db/expense-ledger");
}

function recordedSql(): string[] {
  return [...db.poolQuery.mock.calls, ...db.clientQuery.mock.calls].map(([sql]) => String(sql));
}

describe("R6 expense category migration freeze", () => {
  beforeEach(() => {
    resetDb();
    setFreeze(undefined);
  });

  afterEach(() => {
    setFreeze(originalFreeze);
  });

  it.each([
    [undefined, false],
    ["", false],
    ["0", false],
    ["true", false],
    ["01", false],
    ["1", true],
    [" 1 ", true],
  ] as const)("treats %j as freeze=%s", async (value, frozen) => {
    setFreeze(value);
    const repo = await loadRepo();
    await repo.ensureExpenseLedgerSchema();

    if (frozen) {
      expect(db.ensureSchema).not.toHaveBeenCalled();
      expect(recordedSql()).toEqual([]);
    } else {
      expect(db.ensureSchema).toHaveBeenCalledOnce();
      expect(recordedSql().some((sql) => /^\s*create\s+/i.test(sql))).toBe(true);
    }
  });

  it("reads the freeze flag at call time without reloading the module", async () => {
    setFreeze("1");
    const repo = await loadRepo();
    await repo.ensureExpenseLedgerSchema();
    expect(db.ensureSchema).not.toHaveBeenCalled();

    setFreeze("0");
    await repo.ensureExpenseLedgerSchema();
    expect(db.ensureSchema).toHaveBeenCalledOnce();
    const sqlAfterOff = recordedSql().length;

    setFreeze(" 1 ");
    await repo.materializeOccurrences("sheet-1", "owner@example.com", "2026-07");
    expect(recordedSql()).toHaveLength(sqlAfterOff);
    expect(db.pool.connect).not.toHaveBeenCalled();
  });

  it("keeps the R5 materializer path unchanged while the flag is off", async () => {
    const repo = await loadRepo();
    await repo.materializeOccurrences("sheet-1", "owner@example.com", "2026-07");

    expect(db.ensureSchema).toHaveBeenCalledOnce();
    expect(db.pool.connect).toHaveBeenCalledOnce();
    expect(db.clientQuery).toHaveBeenCalledWith("begin");
    expect(db.clientQuery).toHaveBeenCalledWith("commit");
    expect(recordedSql().some((sql) => /^\s*create\s+/i.test(sql))).toBe(true);
  });

  it("returns from the materializer before ensure, pool, or SQL while frozen", async () => {
    setFreeze("1");
    const repo = await loadRepo();
    await repo.materializeOccurrences("sheet-1", "owner@example.com", "2026-07");

    expect(db.dbEnabled).not.toHaveBeenCalled();
    expect(db.ensureSchema).not.toHaveBeenCalled();
    expect(db.pool.connect).not.toHaveBeenCalled();
    expect(recordedSql()).toEqual([]);
  });

  it("serves all existing-schema snapshot readers with SELECT-only SQL", async () => {
    setFreeze("1");
    const repo = await loadRepo();

    await expect(repo.listExpenseCategories("sheet-1", true)).resolves.toHaveLength(1);
    await expect(repo.listExpenseEntries("sheet-1")).resolves.toHaveLength(1);
    await expect(repo.listRecurringRules("sheet-1")).resolves.toHaveLength(1);
    await expect(repo.listRecurringOccurrences("sheet-1")).resolves.toHaveLength(1);

    expect(db.ensureSchema).not.toHaveBeenCalled();
    expect(db.pool.connect).not.toHaveBeenCalled();
    expect(recordedSql()).toHaveLength(4);
    for (const sql of recordedSql()) {
      expect(sql).toMatch(/^\s*select\b/i);
      expect(sql).not.toMatch(/\b(insert|update|delete|create|alter|drop|truncate|reindex)\b/i);
    }
  });

  it("fails a missing existing schema closed without attempting repair", async () => {
    setFreeze("1");
    db.poolQuery.mockRejectedValueOnce(Object.assign(new Error("relation does not exist"), { code: "42P01" }));
    const repo = await loadRepo();

    await expect(repo.listExpenseCategories("sheet-1")).rejects.toThrow("expense_ledger_unavailable");
    expect(db.ensureSchema).not.toHaveBeenCalled();
    expect(db.pool.connect).not.toHaveBeenCalled();
    expect(recordedSql()).toHaveLength(1);
    expect(recordedSql()[0]).toMatch(/^\s*select\b/i);
  });

  it("rejects every category-bearing mutation before ensure, SQL, transaction, or locks", async () => {
    setFreeze("1");
    const repo = await loadRepo();
    const expense = { categoryId: "category-1", itemName: "Hosting", amountWon: 10_000, periodStart: "2026-07-01" };
    const recurring = { categoryId: "category-1", itemName: "Hosting", amountWon: 10_000, anchorDay: 1, startsOn: "2026-07-01" };
    const mutations: Array<[string, () => Promise<unknown>]> = [
      ["createExpenseCategory", () => repo.createExpenseCategory("sheet-1", "owner@example.com", "Operations")],
      ["patchExpenseCategory", () => repo.patchExpenseCategory("sheet-1", "owner@example.com", "category-1", { name: "Ops" })],
      ["createExpenseEntry", () => repo.createExpenseEntry("sheet-1", "owner@example.com", expense)],
      ["patchExpenseEntry", () => repo.patchExpenseEntry("sheet-1", "owner@example.com", "entry-1", { amountWon: 20_000 })],
      ["deleteExpenseEntry", () => repo.deleteExpenseEntry("sheet-1", "owner@example.com", "entry-1")],
      ["createRecurringRule", () => repo.createRecurringRule("sheet-1", "owner@example.com", recurring)],
      ["pauseRecurringRule", () => repo.pauseRecurringRule("sheet-1", "owner@example.com", "rule-1", "2026-07-01")],
      ["resumeRecurringRule", () => repo.resumeRecurringRule("sheet-1", "owner@example.com", "rule-1", "2026-07-02")],
      ["archiveRecurringRule", () => repo.archiveRecurringRule("sheet-1", "owner@example.com", "rule-1", "2026-07-03")],
      ["skipRecurringOccurrence", () => repo.skipRecurringOccurrence("sheet-1", "owner@example.com", "rule-1", "2026-07")],
      ["patchRecurringOccurrence", () => repo.patchRecurringOccurrence("sheet-1", "owner@example.com", "rule-1", "2026-07", { amountWon: 20_000 })],
      ["splitRecurringRuleFromMonth", () => repo.splitRecurringRuleFromMonth("sheet-1", "owner@example.com", "rule-1", "2026-08", { amountWon: 20_000 })],
    ];

    for (const [name, mutate] of mutations) {
      await expect(mutate(), name).rejects.toThrow("expense_ledger_unavailable");
    }

    expect(db.dbEnabled).not.toHaveBeenCalled();
    expect(db.ensureSchema).not.toHaveBeenCalled();
    expect(db.pool.connect).not.toHaveBeenCalled();
    expect(recordedSql()).toEqual([]);
  });
});
