import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getWritableUserEmail, removeRecurringExpense } = vi.hoisted(() => ({
  getWritableUserEmail: vi.fn(),
  removeRecurringExpense: vi.fn(),
}));

const recurringDb = vi.hoisted(() => {
  const state = {
    status: "active" as "active" | "paused" | "archived",
    startsOn: "2026-07-01",
    openPauseClosed: false,
  };
  const row = () => ({
    id: "00000000-0000-4000-8000-000000000001",
    category_id: "00000000-0000-4000-8000-000000000002",
    category_name: "Operations",
    category_name_at_rule: "Operations",
    item_name: "Hosting",
    amount_won: 10_000,
    anchor_day: 24,
    starts_on: state.startsOn,
    ends_on: null,
    status: state.status,
    supersedes_rule_id: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
  });
  const query = vi.fn(async (sql: string) => {
    const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
    if (["begin", "commit", "rollback"].includes(normalized)) return { rows: [], rowCount: null };
    if (normalized.startsWith("select id,status from expense_recurring_rules")) {
      return { rows: [{ id: row().id, status: state.status }], rowCount: 1 };
    }
    if (normalized.includes("r.status='active'") && normalized.includes("for update of r")) {
      return { rows: state.status === "active" ? [row()] : [], rowCount: state.status === "active" ? 1 : 0 };
    }
    if (normalized.startsWith("select r.*,c.name as category_name from expense_recurring_rules")) {
      return { rows: [row()], rowCount: 1 };
    }
    if (normalized.startsWith("select * from expense_recurring_rules")) {
      return { rows: [row()], rowCount: 1 };
    }
    if (normalized.startsWith("update expense_recurring_rules") && normalized.includes("set status='archived'")) {
      state.status = "archived";
      return { rows: [], rowCount: 1 };
    }
    if (normalized.startsWith("update expense_recurring_pauses") && normalized.includes("greatest(paused_on")) {
      state.openPauseClosed = true;
      return { rows: [], rowCount: 1 };
    }
    if (normalized.startsWith("update expense_recurring_occurrences")) return { rows: [], rowCount: 1 };
    throw new Error(`unexpected_query:${normalized}`);
  });
  const client = { query, release: vi.fn() };
  const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }), connect: vi.fn().mockResolvedValue(client) };
  return { state, query, client, pool };
});

vi.mock("@/auth/identity", () => ({ getWritableUserEmail }));
vi.mock("@/service/expense-ledger", () => ({
  editRecurringExpense: vi.fn(),
  removeRecurringExpense,
}));
vi.mock("@/repo/db/client", () => ({
  dbEnabled: () => true,
  ensureSchema: vi.fn().mockResolvedValue(undefined),
  getDbPool: () => recurringDb.pool,
}));
vi.mock("@/lib/analytics/api-timing", () => ({
  withApiTiming: (_label: string, handler: unknown) => handler,
}));

import { DELETE } from "@/app/api/expense-recurring-rules/[id]/route";
import {
  archiveRecurringRule,
  materializeOccurrences,
  pauseRecurringRule,
  resumeRecurringRule,
  splitRecurringRuleFromMonth,
} from "@/repo/db/expense-ledger";

describe("recurring expense DELETE route", () => {
  beforeEach(() => {
    getWritableUserEmail.mockReset().mockResolvedValue("owner@example.com");
    removeRecurringExpense.mockReset().mockResolvedValue(undefined);
  });

  it("stops the caller-owned recurring rule", async () => {
    const response = await DELETE(
      new NextRequest("http://localhost/api/expense-recurring-rules/rule-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "rule-1" }) },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(removeRecurringExpense).toHaveBeenCalledWith("owner@example.com", "rule-1");
  });

  it("rejects an empty rule id before resolving identity", async () => {
    const response = await DELETE(
      new NextRequest("http://localhost/api/expense-recurring-rules/", { method: "DELETE" }),
      { params: Promise.resolve({ id: "" }) },
    );
    expect(response.status).toBe(400);
    expect(getWritableUserEmail).not.toHaveBeenCalled();
    expect(removeRecurringExpense).not.toHaveBeenCalled();
  });
});

describe("recurring archive terminal state", () => {
  beforeEach(() => {
    recurringDb.state.status = "active";
    recurringDb.state.startsOn = "2026-07-01";
    recurringDb.state.openPauseClosed = false;
    recurringDb.query.mockClear();
    recurringDb.client.release.mockClear();
  });

  it("closes an open pause and blocks pause or resume after DELETE", async () => {
    recurringDb.state.status = "paused";
    await archiveRecurringRule("sheet-1", "owner@example.com", "rule-1", "2026-07-24");
    expect(recurringDb.state.status).toBe("archived");
    expect(recurringDb.state.openPauseClosed).toBe(true);
    await expect(pauseRecurringRule("sheet-1", "owner@example.com", "rule-1", "2026-07-25"))
      .rejects.toThrow("expense_rule_not_found");
    await expect(resumeRecurringRule("sheet-1", "owner@example.com", "rule-1", "2026-07-25"))
      .rejects.toThrow("expense_rule_not_found");
    expect(recurringDb.state.status).toBe("archived");
  });

  it("cannot revive or materialize a future-start rule after DELETE", async () => {
    recurringDb.state.startsOn = "2026-12-01";
    await archiveRecurringRule("sheet-1", "owner@example.com", "rule-1", "2026-07-24");
    await expect(pauseRecurringRule("sheet-1", "owner@example.com", "rule-1", "2026-07-25"))
      .rejects.toThrow("expense_rule_not_found");
    await expect(resumeRecurringRule("sheet-1", "owner@example.com", "rule-1", "2026-07-25"))
      .rejects.toThrow("expense_rule_not_found");
    await materializeOccurrences("sheet-1", "owner@example.com", "2026-12");
    expect(recurringDb.query.mock.calls.some(([sql]) => String(sql).includes("insert into expense_recurring_occurrences"))).toBe(false);
  });

  it("denies splitting an archived rule into an active successor", async () => {
    recurringDb.state.status = "archived";
    await expect(splitRecurringRuleFromMonth(
      "sheet-1",
      "owner@example.com",
      "rule-1",
      "2026-08",
      { amountWon: 20_000 },
    )).rejects.toThrow("expense_rule_not_found");
    expect(recurringDb.query.mock.calls.some(([sql]) => String(sql).includes("insert into expense_recurring_rules"))).toBe(false);
  });
});
