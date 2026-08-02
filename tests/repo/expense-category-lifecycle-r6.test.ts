import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sourceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const unclassifiedId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const db = vi.hoisted(() => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const source = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", spreadsheet_id: "sheet-1", name: "Operations", name_normalized: "operations", is_system: false, system_key: null, archived_at: null, deleted_at: null };
  const target = { id: "ffffffff-ffff-4fff-8fff-ffffffffffff", spreadsheet_id: "sheet-1", name: "미분류", name_normalized: "미분류", is_system: true, system_key: "unclassified", archived_at: null, deleted_at: null };
  let replay: Record<string, unknown> | null = null;
  let usage: Record<string, unknown> | null = null;
  const answer = (sql: string) => {
    const q = sql.replace(/\s+/g, " ").trim().toLowerCase();
    if (q.startsWith("select to_regclass")) return { rows: [{ categories: "expense_categories", marker: "expense_schema_migrations" }], rowCount: 1 };
    if (q.startsWith("select state,scrip")) return { rows: [{ state: "ready", script_sha256: "8b8be41141c55119fc6d2693199baea2914f8353e77ec224386efe8707094c7c" }], rowCount: 1 };
    if (q.includes("action='deleted'") && q.startsWith("select")) return { rows: replay ? [replay] : [], rowCount: replay ? 1 : 0 };
    if (q.includes("system_key='unclassified'") && q.endsWith("for update")) return { rows: [target], rowCount: 1 };
    if (q.includes("from expense_categories") && q.includes("id=any")) return { rows: [source, target].sort((a, b) => a.id.localeCompare(b.id)), rowCount: 2 };
    if (q.startsWith("select id,category_name_at_entry")) return { rows: [{ id: "10000000-0000-4000-8000-000000000001", category_name_at_entry: "Operations" }], rowCount: 1 };
    if (q.startsWith("select id,category_name_at_rule")) return { rows: [{ id: "20000000-0000-4000-8000-000000000001", category_name_at_rule: "Operations" }], rowCount: 1 };
    if (q.startsWith("select id,category_name_at_occurrence")) return { rows: [{ id: "30000000-0000-4000-8000-000000000001", category_name_at_occurrence: "Operations", is_override: true }], rowCount: 1 };
    if (q.startsWith("select transaction_timestamp")) return { rows: [{ at: "2026-07-25T00:00:00.000Z" }], rowCount: 1 };
    if (q.startsWith("insert into expense_category_audits") && q.includes("returning id")) return { rows: [{ id: "90000000-0000-4000-8000-000000000001" }], rowCount: 1 };
    if (q.includes("entry_count") && q.includes("from expense_categories c")) return { rows: usage ? [usage] : [], rowCount: usage ? 1 : 0 };
    if (q.startsWith("update expense_")) return { rows: [], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  };
  const query = vi.fn(async (sql: string, params?: unknown[]) => { queries.push({ sql, params }); return answer(sql); });
  const client = { query, release: vi.fn(), processID: 4242 };
  return { queries, query, client, pool: { query, connect: vi.fn(async () => client) }, source, target, setReplay: (v: typeof replay) => { replay = v; }, setUsage: (v: typeof usage) => { usage = v; } };
});
vi.mock("@/repo/db/client", () => ({ dbEnabled: () => true, ensureSchema: vi.fn(), getDbPool: () => db.pool }));

import { deleteExpenseCategory, EXPENSE_CATEGORY_LIFECYCLE_SQL_SHA256, getExpenseCategoryUsage } from "@/repo/db/expense-ledger";

describe("R6 category lifecycle repository", () => {
  beforeEach(() => { db.queries.length = 0; db.query.mockClear(); db.pool.connect.mockClear(); db.setReplay(null); db.setUsage(null); delete process.env.EXPENSE_CATEGORY_MIGRATION_FREEZE_R6; });

  it("locks categories before entries, rules, and occurrences and tombstones with one captured timestamp", async () => {
    await expect(deleteExpenseCategory("sheet-1", "owner@example.com", sourceId)).resolves.toEqual({ ok: true, deletedCategoryId: sourceId, unclassifiedCategoryId: unclassifiedId, movedEntryCount: 1, movedRuleCount: 1, movedOccurrenceCount: 1 });
    const sql = db.queries.map((x) => x.sql.replace(/\s+/g, " ").toLowerCase());
    const categoryLock = sql.findIndex((q) => q.includes("id=any") && q.includes("for update"));
    const entryLock = sql.findIndex((q) => q.startsWith("select id,category_name_at_entry"));
    const ruleLock = sql.findIndex((q) => q.startsWith("select id,category_name_at_rule"));
    const occurrenceLock = sql.findIndex((q) => q.startsWith("select id,category_name_at_occurrence"));
    expect(categoryLock).toBeGreaterThan(-1); expect(categoryLock).toBeLessThan(entryLock); expect(entryLock).toBeLessThan(ruleLock); expect(ruleLock).toBeLessThan(occurrenceLock);
    expect(sql).toContain("set local lock_timeout='3s'");
    const tombstone = db.queries.find((x) => x.sql.includes("set deleted_at=$3"));
    expect(tombstone?.params?.[2]).toBe("2026-07-25T00:00:00.000Z");
  });

  it("replays the frozen terminal result before bootstrap or current-state validation", async () => {
    db.setReplay({ target_category_id: unclassifiedId, moved_entry_count: 4, moved_rule_count: 2, moved_occurrence_count: 7 });
    await expect(deleteExpenseCategory("sheet-1", "owner@example.com", sourceId)).resolves.toEqual({ ok: true, deletedCategoryId: sourceId, unclassifiedCategoryId: unclassifiedId, movedEntryCount: 4, movedRuleCount: 2, movedOccurrenceCount: 7 });
    expect(db.queries.some((x) => x.sql.includes("pg_advisory_xact_lock"))).toBe(false);
  });

  it("counts physical usage and distinguishes system, terminal, and foreign categories", async () => {
    db.setUsage({ ...db.source, entry_count: 2, rule_count: 3, occurrence_count: 4, override_count: 1 });
    await expect(getExpenseCategoryUsage("sheet-1", sourceId)).resolves.toEqual({ category: { id: sourceId, name: "Operations", isSystem: false, deletedAt: null }, usage: { entryCount: 2, ruleCount: 3, occurrenceCount: 4, overrideOccurrenceCount: 1, totalCount: 9 } });
    db.setUsage({ ...db.target }); await expect(getExpenseCategoryUsage("sheet-1", unclassifiedId)).rejects.toThrow("expense_category_system_immutable");
    db.setUsage({ ...db.source, deleted_at: "2026-07-25" }); await expect(getExpenseCategoryUsage("sheet-1", sourceId)).rejects.toThrow("expense_category_deleted");
    db.setUsage(null); await expect(getExpenseCategoryUsage("sheet-1", sourceId)).rejects.toThrow("expense_category_not_found");
  });

  it("fails every new mutation before SQL while the compatibility freeze is on", async () => {
    process.env.EXPENSE_CATEGORY_MIGRATION_FREEZE_R6 = " 1 ";
    await expect(deleteExpenseCategory("sheet-1", "owner@example.com", sourceId)).rejects.toThrow("expense_ledger_unavailable");
    expect(db.pool.connect).not.toHaveBeenCalled(); expect(db.queries).toEqual([]);
  });

  it("pins runtime readiness to the reviewed operational SQL bytes", () => {
    const sql = readFileSync(join(process.cwd(), "scripts/ops/expense-category-lifecycle-r6.sql"));
    expect(createHash("sha256").update(sql).digest("hex")).toBe(EXPENSE_CATEGORY_LIFECYCLE_SQL_SHA256);
  });
});
