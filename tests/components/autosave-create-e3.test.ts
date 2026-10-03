// @vitest-environment jsdom
/**
 * Scope E3 — actual create-hook behavior (no pure-debounce creates, stale-ACK
 * guard). Drives the real useAddRowAutosave + useOneTimeExpenseAutosave with
 * a minimal jsdom harness (no new test framework): delayed ACK + typing
 * without a second flush, then the next deliberate blur ⇒ exactly one create
 * attempt that sticks plus one PATCH with the newest text (no second row);
 * untouched defaults and invalid drafts never create; failures keep the key.
 */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it } from "vitest";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

import { CHANNELS } from "@/app/(app)/db/_lib/channels";
import { useAddRowAutosave } from "@/app/(app)/db/_lib/use-add-autosave";
import {
  useOneTimeExpenseAutosave,
} from "@/components/dashboard/expense-ledger/use-one-time-autosave";
import { DbCreateConflictError } from "@/query/db-hooks";
import { ExpenseCreateConflictError } from "@/query/expense-ledger-hooks";
import type { CreateExpenseBody } from "@/types/expense-ledger";

type AddOpts = Parameters<typeof useAddRowAutosave>[0];
type AddHook = ReturnType<typeof useAddRowAutosave>;
type ExpOpts = Parameters<typeof useOneTimeExpenseAutosave>[0];
type ExpHook = ReturnType<typeof useOneTimeExpenseAutosave>;

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function mount<Opts, Hook>(useHook: (o: Opts) => Hook, initial: Opts) {
  const api: { hook: Hook | null } = { hook: null };
  function Probe({ o }: { o: Opts }) {
    api.hook = useHook(o);
    return null;
  }
  const el = document.createElement("div");
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => { root.render(createElement(Probe, { o: initial })); });
  return {
    api,
    render: (o: Opts) => act(async () => { root.render(createElement(Probe, { o })); }),
    unmount: () => act(async () => { root.unmount(); el.remove(); }),
  };
}

const EXP_BASE = {
  kind: "one_time" as const,
  categoryId: "c1",
  itemName: "임차료",
  amountWon: 100000,
  start: "2026-09-01",
  end: "2026-09-01",
  range: false,
};

const PURCHASE_V1 = { 구매일: "2026-09-01", 업체명: "가나상사", 총액: 11000, 주문개수: 10, 개당단가: 1000 };
const PURCHASE_V2 = { ...PURCHASE_V1, 업체명: "가나상사 수정" };
const PURCHASE_BASE = { 구매일: "2026-09-01", 업체명: "", 총액: 0, 주문개수: 0, 개당단가: 0 };

describe("expense hook — E3 create behavior", () => {
  it("delayed ACK + typing without second flush, next blur ⇒ 1 POST + 1 PATCH with newest text", async () => {
    const calls: Array<{ body: CreateExpenseBody; key: string }> = [];
    const patches: Array<{ id: string; body: CreateExpenseBody }> = [];
    let created = 0;
    // Real route DTO shape: { expense: entry, replayed } with the full entry.
    const gate = deferred<{ expense: { id: string; categoryId: string; itemName: string }; replayed: boolean }>();
    const opts = (o: typeof EXP_BASE): ExpOpts => ({
      ...o,
      createExpense: async (body: CreateExpenseBody, key: string) => {
        calls.push({ body, key });
        if (calls.length === 1) return gate.promise; // delayed ACK
        throw new Error("must not POST when the entry id is known — PATCH directly");
      },
      onCreated: () => { created += 1; },
      patchExpense: async (id: string, body: CreateExpenseBody) => {
        patches.push({ id, body });
        return {};
      },
    });
    const h = await mount(useOneTimeExpenseAutosave, opts(EXP_BASE));
    const hook = (): ExpHook => h.api.hook!;
    await act(async () => { hook().markTouched(); });
    let first!: Promise<void>;
    await act(async () => { first = hook().flushOnce(); });
    expect(calls.length).toBe(1);
    // User keeps typing — no second flush fires on its own.
    await h.render(opts({ ...EXP_BASE, itemName: "임차료 수정" }));
    await act(async () => { hook().markTouched(); });
    await act(async () => {
      gate.resolve({ expense: { id: "entry-1", categoryId: "c1", itemName: "임차료" }, replayed: false });
      await first;
    });
    expect(calls.length).toBe(1); // no create-again after ACK
    expect(created).toBe(0); // form kept with the latest edits
    // Next deliberate blur: the entry id is known, so the hook PATCHes it
    // directly with the newest text — no second POST, no 409 round-trip.
    await act(async () => { await hook().flushOnce(); });
    expect(calls.length).toBe(1); // still exactly one POST
    expect(calls[0]?.key).toBeTruthy();
    expect(patches.length).toBe(1);
    expect(patches[0]?.id).toBe("entry-1");
    expect(patches[0]?.body.itemName).toBe("임차료 수정"); // newest preserved, never cleared
    expect(created).toBe(1);
    await h.unmount();
  });

  it("uncertain lost-ACK (no known id) still recovers via POST then 409 PATCH", async () => {
    const calls: Array<{ body: CreateExpenseBody; key: string }> = [];
    const patches: Array<{ id: string; body: CreateExpenseBody }> = [];
    let created = 0;
    let n = 0;
    const h = await mount(useOneTimeExpenseAutosave, {
      ...EXP_BASE,
      createExpense: async (body: CreateExpenseBody, key: string) => {
        calls.push({ body, key });
        n += 1;
        // Lost ACK: the server kept the FIRST commit, we never saw its id.
        if (n === 1) throw new ExpenseCreateConflictError("entry-9");
        return { expense: { id: "entry-9" }, replayed: false };
      },
      onCreated: () => { created += 1; },
      patchExpense: async (id: string, body: CreateExpenseBody) => {
        patches.push({ id, body });
        return {};
      },
    });
    await act(async () => { h.api.hook!.markTouched(); });
    await act(async () => { await h.api.hook!.flushOnce(); });
    expect(calls.length).toBe(1); // uncertain path still POSTs once
    expect(patches.length).toBe(1); // then converges via 409 PATCH
    expect(patches[0]?.id).toBe("entry-9");
    expect(patches[0]?.body.itemName).toBe("임차료");
    expect(created).toBe(1);
    await h.unmount();
  });

  it("untouched defaults never create", async () => {
    let calls = 0;
    const h = await mount(useOneTimeExpenseAutosave, {
      ...EXP_BASE,
      categoryId: "",
      itemName: "",
      amountWon: 0,
      createExpense: async () => { calls += 1; return {}; },
      onCreated: () => {},
    });
    await act(async () => { await h.api.hook!.flushOnce(); });
    expect(calls).toBe(0);
    await h.unmount();
  });

  it("invalid drafts never create", async () => {
    let calls = 0;
    const h = await mount(useOneTimeExpenseAutosave, {
      ...EXP_BASE,
      amountWon: 0, // partial/invalid — never sent
      createExpense: async () => { calls += 1; return {}; },
      onCreated: () => {},
    });
    await act(async () => { h.api.hook!.markTouched(); });
    let invalidErr: unknown = null;
    await act(async () => {
      try { await h.api.hook!.flushOnce(); } catch (e) { invalidErr = e; }
    });
    expect(invalidErr).toBeInstanceOf(Error);
    expect(calls).toBe(0);
    await h.unmount();
  });

  it("failed requests keep the key (safe same-key retry)", async () => {
    const keys: string[] = [];
    let n = 0;
    let created = 0;
    const h = await mount(useOneTimeExpenseAutosave, {
      ...EXP_BASE,
      createExpense: async (_b: CreateExpenseBody, key: string) => {
        keys.push(key);
        n += 1;
        if (n === 1) throw new Error("boom");
        return { expense: { id: "entry-2" } };
      },
      onCreated: () => { created += 1; },
    });
    await act(async () => { h.api.hook!.markTouched(); });
    let firstErr: unknown = null;
    await act(async () => {
      try { await h.api.hook!.flushOnce(); } catch (e) { firstErr = e; }
    });
    expect((firstErr as Error)?.message).toBe("boom");
    await act(async () => { await h.api.hook!.flushOnce(); });
    expect(keys.length).toBe(2);
    const [boomKey, okKey] = keys;
    expect(boomKey).toBeTruthy();
    expect(okKey).toBe(boomKey); // rotation only on ACK
    expect(created).toBe(1);
    await h.unmount();
  });
});

describe("db add hook — E3 create behavior", () => {
  function addOpts(over: Partial<AddOpts> = {}): AddOpts {
    return {
      activeCh: "purchase",
      ch: CHANNELS.purchase,
      guardedNav: (a: () => void) => a(),
      createRow: async () => ({}),
      onCreated: () => {},
      ...over,
    } as AddOpts;
  }

  it("delayed ACK + typing without second flush, next blur ⇒ 1 POST + 1 PATCH same row", async () => {
    const calls: Array<{ data: Record<string, unknown>; key: string }> = [];
    const patches: Array<{ row: number; data: Record<string, unknown> }> = [];
    const created: Array<Record<string, unknown>> = [];
    // Route DTO shape: useAppendDB resolves { ok, row, idempotent, replayed }.
    const gate = deferred<{ ok: true; row: number; idempotent: boolean; replayed: boolean }>();
    const h = await mount(useAddRowAutosave, addOpts({
      createRow: async (data: Record<string, unknown>, key: string) => {
        calls.push({ data, key });
        if (calls.length === 1) return gate.promise;
        throw new Error("must not POST when the row is known — PATCH directly");
      },
      onCreated: (frozen: Record<string, unknown>) => { created.push(frozen); },
      patchRow: async (row: number, data: Record<string, unknown>) => {
        patches.push({ row, data });
        return {};
      },
    }));
    const hook = (): AddHook => h.api.hook!;
    await act(async () => { hook().handleAddPayload(PURCHASE_BASE); });
    await act(async () => { hook().handleAddPayload(PURCHASE_V1); });
    let first!: Promise<void>;
    await act(async () => { first = hook().flushAdd(); });
    expect(calls.length).toBe(1);
    await act(async () => { hook().handleAddPayload(PURCHASE_V2); }); // typing stages only
    await act(async () => {
      gate.resolve({ ok: true, row: 7, idempotent: true, replayed: false });
      await first;
    });
    expect(calls.length).toBe(1);
    expect(created.length).toBe(0); // form kept open on latest
    expect(hook().addOpen).toBe(true);
    await act(async () => { await hook().flushAdd(); }); // next deliberate blur
    expect(calls.length).toBe(1); // still exactly one POST — PATCH directly
    expect(calls[0]?.key).toBeTruthy();
    expect(patches.length).toBe(1);
    expect(patches[0]?.row).toBe(7); // SAME row patched, never recreated
    expect(patches[0]?.data.업체명).toBe("가나상사 수정"); // newest preserved
    expect(created.length).toBe(1);
    await h.unmount();
  });

  it("uncertain lost-ACK (no known row) still recovers via POST then 409 PATCH", async () => {
    const calls: Array<{ data: Record<string, unknown>; key: string }> = [];
    const patches: Array<{ row: number; data: Record<string, unknown> }> = [];
    let created = 0;
    let n = 0;
    const h = await mount(useAddRowAutosave, addOpts({
      createRow: async (data: Record<string, unknown>, key: string) => {
        calls.push({ data, key });
        n += 1;
        // Lost ACK: the server kept the FIRST commit, we never saw its row.
        if (n === 1) throw new DbCreateConflictError(9);
        return { ok: true, row: 9 };
      },
      onCreated: () => { created += 1; },
      patchRow: async (row: number, data: Record<string, unknown>) => {
        patches.push({ row, data });
        return {};
      },
    }));
    await act(async () => { h.api.hook!.handleAddPayload({ ...PURCHASE_BASE }); });
    await act(async () => { h.api.hook!.handleAddPayload({ ...PURCHASE_V1 }); });
    await act(async () => { await h.api.hook!.flushAdd(); });
    expect(calls.length).toBe(1); // uncertain path still POSTs once
    expect(patches.length).toBe(1); // then converges via 409 PATCH
    expect(patches[0]?.row).toBe(9);
    expect(created).toBe(1);
    await h.unmount();
  });

  it("untouched defaults never create", async () => {
    let calls = 0;
    const h = await mount(useAddRowAutosave, addOpts({
      createRow: async () => { calls += 1; return {}; },
    }));
    await act(async () => { h.api.hook!.handleAddPayload({ ...PURCHASE_BASE }); });
    await act(async () => { await h.api.hook!.flushAdd(); });
    expect(calls).toBe(0);
    await h.unmount();
  });

  it("invalid drafts never create", async () => {
    let calls = 0;
    const h = await mount(useAddRowAutosave, addOpts({
      createRow: async () => { calls += 1; return {}; },
    }));
    await act(async () => { h.api.hook!.handleAddPayload({ ...PURCHASE_BASE }); });
    await act(async () => {
      h.api.hook!.handleAddPayload({ ...PURCHASE_V1, 구매일: "2026-02-30" });
    });
    let invalidErr: unknown = null;
    await act(async () => {
      try { await h.api.hook!.flushAdd(); } catch (e) { invalidErr = e; }
    });
    expect(invalidErr).toBeInstanceOf(Error);
    expect(calls).toBe(0);
    await h.unmount();
  });

  it("failed requests keep the key", async () => {
    const keys: string[] = [];
    let n = 0;
    let created = 0;
    const h = await mount(useAddRowAutosave, addOpts({
      createRow: async (_d: Record<string, unknown>, key: string) => {
        keys.push(key);
        n += 1;
        if (n === 1) throw new Error("boom");
        return { row: 9 };
      },
      onCreated: () => { created += 1; },
    }));
    await act(async () => { h.api.hook!.handleAddPayload({ ...PURCHASE_BASE }); });
    await act(async () => { h.api.hook!.handleAddPayload({ ...PURCHASE_V1 }); });
    let firstErr: unknown = null;
    await act(async () => {
      try { await h.api.hook!.flushAdd(); } catch (e) { firstErr = e; }
    });
    expect((firstErr as Error)?.message).toBe("boom");
    await act(async () => { await h.api.hook!.flushAdd(); });
    expect(keys.length).toBe(2);
    const [failedKey, retryKey] = keys;
    expect(failedKey).toBeTruthy();
    expect(retryKey).toBe(failedKey);
    expect(created).toBe(1);
    await h.unmount();
  });
});

beforeEach(() => {
  document.body.innerHTML = "";
});
