/**
 * Scope E3 — service fail-closed ordering: a provided key with the DB down
 * throws db_idempotency_unavailable BEFORE any append side effect (the repo
 * append is never called); keyless keeps legacy; keyed + DB up honors the key.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  appendPurchase: vi.fn(),
  appendProduction: vi.fn(),
  appendBanner: vi.fn(),
  appendLead: vi.fn(),
}));
vi.mock("@/repo/db", () => ({
  appendPurchase: repo.appendPurchase,
  appendProduction: repo.appendProduction,
  appendBanner: repo.appendBanner,
  appendLead: repo.appendLead,
}));
vi.mock("@/repo/db/client", () => ({ dbEnabled: vi.fn() }));
vi.mock("@/service/db", () => ({
  resolveWriteCtx: vi.fn(),
  assertNoOverlapDirect: vi.fn(),
  syncDirectCount: vi.fn(),
  syncProduction: vi.fn(),
}));

import { dbEnabled } from "@/repo/db/client";
import { resolveWriteCtx } from "@/service/db";
import { appendPurchase } from "@/repo/db";
import { addPurchase } from "@/service/db-creates";

const KEY = "11111111-1111-4111-8111-111111111111";
const PURCHASE = { 구매일: "2026-09-01", 업체명: "가나상사", 개당단가: 1000, 주문개수: 3 };

describe("db-creates fail closed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveWriteCtx).mockResolvedValue({
      sid: "S",
      fromDb: false,
      syncDb: false,
      salesCtx: { spreadsheetId: "S", cohort: "?", email: "o@e.com" },
    });
  });

  it("keyed + DB down ⇒ throws BEFORE the append (no side effect)", async () => {
    vi.mocked(dbEnabled).mockReturnValue(false);
    const err = await addPurchase("o@e.com", PURCHASE as never, KEY).catch((e) => e);
    expect((err as Error).message).toBe("db_idempotency_unavailable");
    expect(repo.appendPurchase).not.toHaveBeenCalled();
  });

  it("keyless + DB down ⇒ legacy append (no key, idempotent:false)", async () => {
    vi.mocked(dbEnabled).mockReturnValue(false);
    vi.mocked(appendPurchase).mockResolvedValue({ row: 4, replayed: false });
    const r = await addPurchase("o@e.com", PURCHASE as never, null);
    expect(repo.appendPurchase).toHaveBeenCalledWith("S", PURCHASE);
    expect(r).toEqual({ row: 4, idempotent: false, replayed: false });
  });

  it("keyed + DB up ⇒ honored (any cohort — no pilot downgrade)", async () => {
    vi.mocked(dbEnabled).mockReturnValue(true);
    vi.mocked(appendPurchase).mockResolvedValue({ row: 9, replayed: false });
    const r = await addPurchase("o@e.com", PURCHASE as never, KEY);
    expect(repo.appendPurchase).toHaveBeenCalledWith("S", PURCHASE, KEY);
    expect(r).toEqual({ row: 9, idempotent: true, replayed: false });
  });

  it("malformed key ⇒ invalid_request before the append", async () => {
    vi.mocked(dbEnabled).mockReturnValue(true);
    const err = await addPurchase("o@e.com", PURCHASE as never, "junk").catch((e) => e);
    expect((err as Error).message).toBe("invalid_request");
    expect(repo.appendPurchase).not.toHaveBeenCalled();
  });
});
