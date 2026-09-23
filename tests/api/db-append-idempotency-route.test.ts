/**
 * Scope E2 — POST /api/db/:channel idempotency contract (service mocked).
 *
 * Verifies: header key precedence + body fallback plucking (before zod
 * stripping), malformed key ⇒ 400, conflict ⇒ 409 with the original row,
 * replay flags pass through, keyless callers keep legacy behavior.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  email: vi.fn(),
  addPurchase: vi.fn(),
  addProduction: vi.fn(),
  addBanner: vi.fn(),
  addLead: vi.fn(),
}));
vi.mock("@/auth/identity", () => ({ getWritableUserEmail: api.email }));
vi.mock("@/service", () => ({
  addPurchase: api.addPurchase,
  addProduction: api.addProduction,
  addBanner: api.addBanner,
  addLead: api.addLead,
}));
vi.mock("@/lib/analytics/api-timing", () => ({
  withApiTiming: (_label: string, handler: unknown) => handler,
}));

import { POST } from "@/app/api/db/[channel]/route";

const KEY = "11111111-1111-4111-8111-111111111111";
const OTHER_KEY = "22222222-2222-4222-8222-222222222222";
const PURCHASE = { 구매일: "2026-09-01", 업체명: "가나상사", 개당단가: 1000, 주문개수: 3 };

function req(channel: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost/api/db/${channel}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}
const ctx = (channel: string) => ({ params: Promise.resolve({ channel }) });
async function out(r: Response) {
  return { status: r.status, body: await r.json() };
}

describe("POST /api/db/:channel idempotency contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.email.mockResolvedValue("owner@example.com");
    api.addPurchase.mockResolvedValue({ row: 9, idempotent: true, replayed: false });
  });

  it("header key is forwarded; result flags pass through", async () => {
    const r = await POST(req("매입DB", PURCHASE, { "idempotency-key": KEY }), ctx("매입DB"));
    expect(api.addPurchase).toHaveBeenCalledWith("owner@example.com", expect.objectContaining(PURCHASE), KEY);
    expect(await out(r)).toEqual({
      status: 200,
      body: { ok: true, row: 9, idempotent: true, replayed: false },
    });
  });

  it("body idempotencyKey is plucked BEFORE zod stripping (no silent drop)", async () => {
    const r = await POST(req("매입DB", { ...PURCHASE, idempotencyKey: KEY }), ctx("매입DB"));
    expect(api.addPurchase).toHaveBeenCalledWith("owner@example.com", expect.anything(), KEY);
    expect((await out(r)).status).toBe(200);
  });

  it("header wins over body when both present", async () => {
    await POST(
      req("매입DB", { ...PURCHASE, idempotencyKey: OTHER_KEY }, { "idempotency-key": KEY }),
      ctx("매입DB"),
    );
    expect(api.addPurchase).toHaveBeenCalledWith("owner@example.com", expect.anything(), KEY);
  });

  it("malformed key ⇒ 400, service never runs (fail closed)", async () => {
    const r = await POST(req("매입DB", PURCHASE, { "idempotency-key": "junk" }), ctx("매입DB"));
    expect(await out(r)).toEqual({ status: 400, body: { error: "invalid_request" } });
    expect(api.addPurchase).not.toHaveBeenCalled();
  });

  it("conflict ⇒ 409 with the original row for client PATCH", async () => {
    const err = new Error("db_idempotency_conflict") as Error & { row: number };
    err.row = 7;
    api.addPurchase.mockRejectedValue(err);
    const r = await POST(req("매입DB", PURCHASE, { "idempotency-key": KEY }), ctx("매입DB"));
    expect(await out(r)).toEqual({ status: 409, body: { error: "db_idempotency_conflict", row: 7 } });
  });

  it("conflict without a row (pending) ⇒ 409 without row", async () => {
    api.addPurchase.mockRejectedValue(new Error("db_idempotency_conflict"));
    const r = await POST(req("매입DB", PURCHASE, { "idempotency-key": KEY }), ctx("매입DB"));
    expect(await out(r)).toEqual({ status: 409, body: { error: "db_idempotency_conflict" } });
  });

  it("no key ⇒ legacy call (null key) and legacy flags", async () => {
    api.addPurchase.mockResolvedValue({ row: 4, idempotent: false, replayed: false });
    const r = await POST(req("매입DB", PURCHASE), ctx("매입DB"));
    expect(api.addPurchase).toHaveBeenCalledWith("owner@example.com", expect.objectContaining(PURCHASE), null);
    expect(await out(r)).toEqual({
      status: 200,
      body: { ok: true, row: 4, idempotent: false, replayed: false },
    });
  });

  it("lead channel strips client 발굴id but still honors the key", async () => {
    api.addLead.mockResolvedValue({ row: 6, idempotent: true, replayed: true });
    const lead = { 구분: "콜", 접수일: "2026-09-01", 대표자명: "김", 업체명: "a", 발굴id: "attacker" };
    const r = await POST(
      req(encodeURIComponent("콜·지·기·소"), lead, { "idempotency-key": KEY }),
      ctx(encodeURIComponent("콜·지·기·소")),
    );
    expect(api.addLead).toHaveBeenCalledWith(
      "owner@example.com",
      expect.not.objectContaining({ 발굴id: "attacker" }),
      KEY,
    );
    expect(await out(r)).toEqual({
      status: 200,
      body: { ok: true, row: 6, idempotent: true, replayed: true },
    });
  });
});
