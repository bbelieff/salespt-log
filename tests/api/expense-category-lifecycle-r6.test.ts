import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ active: vi.fn(), writable: vi.fn(), edit: vi.fn(), remove: vi.fn(), usage: vi.fn(), reclassify: vi.fn() }));
vi.mock("@/auth/identity", () => ({ getActiveUserEmail: api.active, getWritableUserEmail: api.writable }));
vi.mock("@/service/expense-ledger", () => ({
  editExpenseCategory: api.edit, deleteExpenseCategoryForUser: api.remove,
  getExpenseCategoryUsageForUser: api.usage, reclassifyUnclassifiedForUser: api.reclassify,
}));
vi.mock("@/lib/analytics/api-timing", () => ({ withApiTiming: (_label: string, handler: unknown) => handler }));

import { DELETE, PATCH } from "@/app/api/expense-categories/[id]/route";
import { GET as GET_USAGE } from "@/app/api/expense-categories/[id]/usage/route";
import { POST as RECLASSIFY } from "@/app/api/expense-categories/unclassified/reclassify/route";
import { expenseError } from "@/app/api/expenses/_response";

const categoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const operationId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const entryId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ctx = { params: Promise.resolve({ id: categoryId }) };
async function body(response: Response) { return { status: response.status, body: await response.json() }; }

describe("R6 category lifecycle API contract", () => {
  beforeEach(() => { vi.clearAllMocks(); api.active.mockResolvedValue("owner@example.com"); api.writable.mockResolvedValue("owner@example.com"); });

  it("returns the exact delete and physical usage snapshots", async () => {
    const deleted = { ok: true, deletedCategoryId: categoryId, unclassifiedCategoryId: "ffffffff-ffff-4fff-8fff-ffffffffffff", movedEntryCount: 2, movedRuleCount: 1, movedOccurrenceCount: 3 };
    const usage = { category: { id: categoryId, name: "Operations", isSystem: false, deletedAt: null }, usage: { entryCount: 2, ruleCount: 1, occurrenceCount: 3, overrideOccurrenceCount: 1, totalCount: 6 } };
    api.remove.mockResolvedValue(deleted); api.usage.mockResolvedValue(usage);
    await expect(body(await DELETE(new NextRequest("http://localhost/api/expense-categories/x", { method: "DELETE" }), ctx))).resolves.toEqual({ status: 200, body: deleted });
    await expect(body(await GET_USAGE(new NextRequest("http://localhost/api/expense-categories/x/usage"), ctx))).resolves.toEqual({ status: 200, body: usage });
  });

  it("rejects legacy archived PATCH and duplicate typed refs as invalid_request", async () => {
    const archived = await PATCH(new NextRequest("http://localhost/api/expense-categories/x", { method: "PATCH", body: JSON.stringify({ archived: true }) }), ctx);
    expect(await body(archived)).toEqual({ status: 400, body: { error: "invalid_request" } });
    const duplicate = await RECLASSIFY(new NextRequest("http://localhost/api/expense-categories/unclassified/reclassify", { method: "POST", body: JSON.stringify({ operationId, targetCategoryId: categoryId, refs: [{ kind: "entry", id: entryId }, { kind: "entry", id: entryId }] }) }));
    expect(await body(duplicate)).toEqual({ status: 400, body: { error: "invalid_request" } });
    expect(api.edit).not.toHaveBeenCalled(); expect(api.reclassify).not.toHaveBeenCalled();
  });

  it("returns the exact reclassification response", async () => {
    const result = { ok: true, operationId, unclassifiedCategoryId: "ffffffff-ffff-4fff-8fff-ffffffffffff", targetCategoryId: categoryId, movedEntryCount: 1, movedRuleCount: 0, movedOccurrenceCount: 0 };
    api.reclassify.mockResolvedValue(result);
    const response = await RECLASSIFY(new NextRequest("http://localhost/api/expense-categories/unclassified/reclassify", { method: "POST", body: JSON.stringify({ operationId, targetCategoryId: categoryId, refs: [{ kind: "entry", id: entryId }] }) }));
    expect(await body(response)).toEqual({ status: 200, body: result });
  });

  it.each([
    ["expense_category_not_found", 404], ["expense_category_system_immutable", 409], ["expense_category_deleted", 409],
    ["expense_idempotency_conflict", 409], ["expense_category_concurrent_change", 409], ["expense_schema_not_ready", 503],
  ])("allowlists %s without leaking unexpected failures", async (code, status) => {
    expect(await body(expenseError(new Error(code)))).toEqual({ status, body: { error: code === "expense_schema_not_ready" ? "expense_ledger_unavailable" : code } });
  });
});
