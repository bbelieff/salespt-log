/**
 * Scope E3 — fail-closed keyed creates (service mocked at the boundary).
 *
 * A provided key is never downgraded to an unsafe write: DB down ⇒ 503
 * db_idempotency_unavailable BEFORE any side effect (UI retains the draft
 * for a safe same-key retry); deleted replay ⇒ 404 db_entry_not_found.
 * Keyless callers keep legacy behavior. Expense 503 mapping included.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  email: vi.fn(),
  addPurchase: vi.fn(),
  addProduction: vi.fn(),
  addBanner: vi.fn(),
  addLead: vi.fn(),
}));
vi.mock("@/auth/identity", () => ({ getWritableUserEmail: db.email }));
vi.mock("@/service", () => ({
  addPurchase: db.addPurchase,
  addProduction: db.addProduction,
  addBanner: db.addBanner,
  addLead: db.addLead,
}));

const ledger = vi.hoisted(() => ({ email: vi.fn(), add: vi.fn(), get: vi.fn() }));
vi.mock("@/service/expense-ledger", () => ({
  addExpense: ledger.add,
  getExpenseLedger: ledger.get,
}));
vi.mock("@/lib/analytics/api-timing", () => ({
  withApiTiming: (_label: string, handler: unknown) => handler,
}));

import { POST as DbPOST } from "@/app/api/db/[channel]/route";
import { POST as ExpensePOST } from "@/app/api/expenses/route";

const KEY = "11111111-1111-4111-8111-111111111111";
const CAT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PURCHASE = { 구매일: "2026-09-01", 업체명: "가나상사", 개당단가: 1000, 주문개수: 3 };
const EXPENSE = { categoryId: CAT, itemName: "임차료", amountWon: 100000, periodStart: "2026-09-01" };

async function out(r: Response) {
  return { status: r.status, body: await r.json() };
}

describe("E3 fail closed — POST /api/db/:channel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.email.mockResolvedValue("owner@example.com");
  });

  it("keyed + DB down ⇒ 503 db_idempotency_unavailable (no unsafe fallback)", async () => {
    db.addPurchase.mockRejectedValue(new Error("db_idempotency_unavailable"));
    const req = new NextRequest("http://localhost/api/db/매입DB", {
      method: "POST",
      headers: { "idempotency-key": KEY },
      body: JSON.stringify(PURCHASE),
    });
    expect(
      await out(await DbPOST(req, { params: Promise.resolve({ channel: "매입DB" }) })),
    ).toEqual({ status: 503, body: { error: "db_idempotency_unavailable" } });
    expect(db.addPurchase).toHaveBeenCalledWith("owner@example.com", expect.objectContaining(PURCHASE), KEY);
  });

  it("keyed replay of a deleted row ⇒ 404 db_entry_not_found (never resurrected)", async () => {
    db.addPurchase.mockRejectedValue(new Error("db_entry_not_found"));
    const req = new NextRequest("http://localhost/api/db/매입DB", {
      method: "POST",
      headers: { "idempotency-key": KEY },
      body: JSON.stringify(PURCHASE),
    });
    expect(
      await out(await DbPOST(req, { params: Promise.resolve({ channel: "매입DB" }) })),
    ).toEqual({ status: 404, body: { error: "db_entry_not_found" } });
  });

  it("keyless ⇒ legacy path untouched (idempotent:false passthrough)", async () => {
    db.addPurchase.mockResolvedValue({ row: 4, idempotent: false, replayed: false });
    const req = new NextRequest("http://localhost/api/db/매입DB", {
      method: "POST",
      body: JSON.stringify(PURCHASE),
    });
    expect(
      await out(await DbPOST(req, { params: Promise.resolve({ channel: "매입DB" }) })),
    ).toEqual({ status: 200, body: { ok: true, row: 4, idempotent: false, replayed: false } });
    expect(db.addPurchase).toHaveBeenCalledWith("owner@example.com", expect.objectContaining(PURCHASE), null);
  });
});

describe("E3 fail closed — POST /api/expenses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ledger.email.mockResolvedValue("owner@example.com");
  });

  it("keyed + ledger down ⇒ 503 expense_ledger_unavailable (draft retained client-side)", async () => {
    ledger.add.mockRejectedValue(new Error("expense_ledger_unavailable"));
    const req = new NextRequest("http://localhost/api/expenses", {
      method: "POST",
      headers: { "idempotency-key": KEY },
      body: JSON.stringify(EXPENSE),
    });
    expect(await out(await ExpensePOST(req))).toEqual({
      status: 503,
      body: { error: "expense_ledger_unavailable" },
    });
  });
});
