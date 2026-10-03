/**
 * Scope E2 — POST /api/expenses idempotency contract (service mocked).
 *
 * Verifies: 201 on create / 200 on replay with the replayed flag, 409 with
 * the same-scope entry id (cross-scope carries nothing), malformed key ⇒ 400,
 * keyless callers keep legacy behavior.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ email: vi.fn(), add: vi.fn(), ledger: vi.fn() }));
vi.mock("@/auth/identity", () => ({
  getActiveUserEmail: api.email,
  getWritableUserEmail: api.email,
}));
vi.mock("@/service/expense-ledger", () => ({
  addExpense: api.add,
  getExpenseLedger: api.ledger,
}));
vi.mock("@/lib/analytics/api-timing", () => ({
  withApiTiming: (_label: string, handler: unknown) => handler,
}));

import { POST } from "@/app/api/expenses/route";

const KEY = "33333333-3333-4333-8333-333333333333";
const CAT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BODY = { categoryId: CAT, itemName: "임차료", amountWon: 100000, periodStart: "2026-09-01" };

function req(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/expenses", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}
async function out(r: Response) {
  return { status: r.status, body: await r.json() };
}

describe("POST /api/expenses idempotency contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.email.mockResolvedValue("owner@example.com");
  });

  it("create ⇒ 201 { expense, replayed:false }; replay ⇒ 200 { replayed:true }", async () => {
    const entry = { id: KEY, ...BODY, periodEnd: BODY.periodStart };
    api.add.mockResolvedValueOnce({ entry, created: true });
    expect(await out(await POST(req(BODY, { "idempotency-key": KEY })))).toEqual({
      status: 201,
      body: { expense: entry, replayed: false },
    });
    api.add.mockResolvedValueOnce({ entry, created: false });
    expect(await out(await POST(req(BODY, { "idempotency-key": KEY })))).toEqual({
      status: 200,
      body: { expense: entry, replayed: true },
    });
    expect(api.add).toHaveBeenNthCalledWith(1, "owner@example.com", BODY, KEY);
  });

  it("same-scope conflict ⇒ 409 with the entry id for client PATCH", async () => {
    const err = new Error("expense_idempotency_conflict") as Error & { entryId: string };
    err.entryId = KEY;
    api.add.mockRejectedValue(err);
    expect(await out(await POST(req(BODY, { "idempotency-key": KEY })))).toEqual({
      status: 409,
      body: { error: "expense_idempotency_conflict", id: KEY },
    });
  });

  it("cross-scope conflict ⇒ 409 with NO id (no other student data)", async () => {
    api.add.mockRejectedValue(new Error("expense_idempotency_conflict"));
    expect(await out(await POST(req(BODY, { "idempotency-key": KEY })))).toEqual({
      status: 409,
      body: { error: "expense_idempotency_conflict" },
    });
  });

  it("malformed key ⇒ 400, service never runs (fail closed)", async () => {
    expect(await out(await POST(req(BODY, { "idempotency-key": "junk" })))).toEqual({
      status: 400,
      body: { error: "invalid_request" },
    });
    expect(api.add).not.toHaveBeenCalled();
  });

  it("no key ⇒ legacy call (null key), 201", async () => {
    const entry = { id: "fresh-id", ...BODY, periodEnd: BODY.periodStart };
    api.add.mockResolvedValue({ entry, created: true });
    expect(await out(await POST(req(BODY)))).toEqual({ status: 201, body: { expense: entry, replayed: false } });
    expect(api.add).toHaveBeenCalledWith("owner@example.com", BODY, null);
  });
});
