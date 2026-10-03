/**
 * Parent review E — NEW DB row + one-off EXPENSE creation autosave.
 * Pure seam reproductions only: no DB, no network, no timers beyond ms.
 * Each test cites the source span it pins or breaks.
 */
import { describe, expect, it } from "vitest";
import {
  createRevisionGuard,
  dbCreateCheck,
  newDraftId,
  payloadSignature,
} from "@/app/(app)/db/_lib/db-autosave";
import { oneTimeExpenseCheck } from "@/components/dashboard/expense-ledger/expense-autosave";
import { CreateExpenseBody } from "@/types/expense-ledger";
import { DBPurchase } from "@/types/db";
import { normalizeIdempotencyKey } from "@/repo/db/idempotency-keys";
import { expenseRequestFingerprint } from "@/repo/db/expense-idempotency";
import { DbCreateConflictError, dbConflictRowOf } from "@/query/db-hooks";
import { ExpenseCreateConflictError, expenseConflictIdOf } from "@/query/expense-ledger-hooks";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("E-8 validity gates: zero/partial/default never create", () => {
  it("purchase zeros + blank name + today date is not valid", () => {
    const today = new Date().toISOString().slice(0, 10);
    const r = dbCreateCheck("purchase", {
      구매일: today,
      업체명: "",
      총액: 0,
      주문개수: 0,
      개당단가: 0,
    });
    expect(r.status).not.toBe("valid"); // empty|partial
  });

  it("purchase malformed date is invalid, never sent", () => {
    const r = dbCreateCheck("purchase", {
      구매일: "2026-02-30",
      업체명: "A",
      총액: 11000,
      주문개수: 10,
      개당단가: 1000,
    });
    expect(r.status).toBe("invalid");
  });

  it("purchase negative amount is invalid", () => {
    const r = dbCreateCheck("purchase", {
      구매일: "2026-09-01",
      업체명: "A",
      총액: -5,
      주문개수: 1,
      개당단가: -5,
    });
    expect(r.status).toBe("invalid");
  });

  it("complete purchase draft is valid (gate opens)", () => {
    const r = dbCreateCheck("purchase", {
      구매일: "2026-09-01",
      업체명: "디비딩프로",
      총액: 11000,
      주문개수: 10,
      개당단가: 1000,
    });
    expect(r.status).toBe("valid");
  });

  it("one-off expense untouched/zero is empty, never sent", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(
      oneTimeExpenseCheck({
        categoryId: "",
        itemName: "",
        amountWon: 0,
        start: today,
        end: today,
        range: false,
      }).status,
    ).toBe("empty");
  });

  it("one-off expense NaN/zero amount is not valid", () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const amountWon of [0, NaN, -100]) {
      expect(
        oneTimeExpenseCheck({
          categoryId: "c",
          itemName: "임차료",
          amountWon,
          start: today,
          end: today,
          range: false,
        }).status,
      ).not.toBe("valid");
    }
  });

  it("legit identical-value duplicates both pass gates (no value-based dedup)", () => {
    // E-5 constraint: the fix must be key-based. Two identical business
    // payloads are both valid here — the server must tell retry from repeat.
    const draft = {
      구매일: "2026-09-01",
      업체명: "디비딩프로",
      총액: 11000,
      주문개수: 10,
      개당단가: 1000,
    };
    expect(dbCreateCheck("purchase", draft).status).toBe("valid");
    expect(dbCreateCheck("purchase", { ...draft }).status).toBe("valid");
  });
});

describe("E-5/E-6 client seams (real primitives)", () => {
  it("exact-signature merge is bytes-only: edited payload gets a new signature", () => {
    const a = { 업체명: "A", 총액: 11000 };
    const b = { ...a };
    const c = { ...a, 총액: 12000 };
    expect(payloadSignature(b)).toBe(payloadSignature(a));
    expect(payloadSignature(c)).not.toBe(payloadSignature(a));
  });

  it("revision guard: stale seq is not current (stale ACK must not touch state)", () => {
    const guard = createRevisionGuard();
    const stale = guard.begin();
    const current = guard.begin();
    expect(guard.isCurrent(stale)).toBe(false);
    expect(guard.isCurrent(current)).toBe(true);
  });

  it("E3: same logical append retries converge — fingerprint excludes volatile row ids", async () => {
    // REMOVED (E3): the two diagnostics above asserted the E2 defect (retry
    // duplicates, edit-while-pending double appends). Real acceptance now
    // lives in tests/repo/db-append-scope-e3.test.ts (scope coordination,
    // no-rewrite after PATCH, no-resurrect after delete),
    // tests/repo/expense-idem-rls-e3.test.ts,
    // tests/api/db-append-failclosed-e3.test.ts,
    // tests/service/db-create-failclosed-e3.test.ts, and
    // tests/components/autosave-create-e3.test.ts (actual hooks).
    const { dbAppendFingerprint } = await import("@/repo/db/db-append-idempotency");
    const a = { 구매일: "2026-09-01", 업체명: "A", row: 4, 발굴id: "op-1" };
    const b = { 구매일: "2026-09-01", 업체명: "A", row: 9, 발굴id: "op-2" };
    expect(dbAppendFingerprint("매입DB", a)).toBe(dbAppendFingerprint("매입DB", b));
    expect(dbAppendFingerprint("매입DB", { ...a, 업체명: "B" })).not.toBe(
      dbAppendFingerprint("매입DB", a),
    );
  });
});

describe("E-1/E-2 CORRECTED (E2): operation keys are honored via header", () => {
  it("schemas strip unknown body keys BY DESIGN — the key travels in the Idempotency-Key header, never the body", () => {
    // Stripping is still true (and still intended): it is why the DB route
    // plucks body.idempotencyKey BEFORE zod parse and why expense is
    // header-only. Assert the mechanism, not the old defect.
    const expense = CreateExpenseBody.safeParse({
      categoryId: newDraftId(),
      itemName: "임차료",
      amountWon: 100000,
      periodStart: "2026-09-01",
      idempotencyKey: newDraftId(),
    });
    expect(expense.success).toBe(true);
    if (expense.success) expect("idempotencyKey" in expense.data).toBe(false);
    const purchase = DBPurchase.safeParse({
      구매일: "2026-09-01",
      업체명: "A",
      개당단가: 1000,
      주문개수: 1,
      idempotencyKey: newDraftId(),
    });
    expect(purchase.success).toBe(true);
    if (purchase.success) expect("idempotencyKey" in purchase.data).toBe(false);
  });

  it("server normalizes the header key: draft ids pass, malformed fail closed", () => {
    const id = newDraftId();
    expect(normalizeIdempotencyKey(id)).toBe(id.toLowerCase());
    expect(normalizeIdempotencyKey(null)).toBeNull();
    expect(() => normalizeIdempotencyKey("stale-presence-match")).toThrow("invalid_request");
  });

  it("conflict errors carry the original row/id so the client PATCHes instead of appending", () => {
    expect(dbConflictRowOf(new DbCreateConflictError(7))).toBe(7);
    expect(dbConflictRowOf(new Error("db_idempotency_conflict"))).toBeNull();
    expect(dbConflictRowOf(new Error("boom"))).toBeNull();
    expect(expenseConflictIdOf(new ExpenseCreateConflictError("eid-1"))).toBe("eid-1");
    expect(expenseConflictIdOf(new Error("expense_idempotency_conflict"))).toBeNull();
  });

  it("fingerprints are stable across retries and sensitive to business changes", () => {
    const a = { categoryId: newDraftId(), itemName: "임차료", amountWon: 100000 };
    expect(expenseRequestFingerprint({ ...a, periodStart: "2026-09-01" } as never)).toBe(
      expenseRequestFingerprint({ ...a, periodStart: "2026-09-01" } as never),
    );
    expect(expenseRequestFingerprint({ ...a, periodStart: "2026-09-01" } as never)).not.toBe(
      expenseRequestFingerprint({ ...a, amountWon: 99999, periodStart: "2026-09-01" } as never),
    );
  });

  it("newDraftId emits uuidv4 suitable as a server key", () => {
    expect(UUID.test(newDraftId())).toBe(true);
  });
});
