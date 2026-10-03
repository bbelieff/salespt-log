/**
 * Scope E2 — one-off expense server idempotency against REAL SQL (PGlite).
 *
 * Disposable in-process Postgres: no DATABASE_URL, no network, no production
 * data. Schema mirrors the columns the implementation touches
 * (expense_categories / expense_entries / expense_entry_idempotency).
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import {
  createExpenseEntryIdempotent,
  type IdemPool,
} from "@/repo/db/expense-idempotency";
import { normalizeIdempotencyKey } from "@/repo/db/idempotency-keys";

const SHEET_A = "sheet-owner-a";
const SHEET_B = "sheet-owner-b";
const ACTOR = "owner@example.com";

let pg: PGlite;
let pool: IdemPool;

const CAT_A = randomUUID();
const CAT_B = randomUUID();

function expenseInput(categoryId: string, amountWon = 100000) {
  return {
    categoryId,
    itemName: "사무실 임차료",
    amountWon,
    periodStart: "2026-09-01",
  };
}

beforeAll(async () => {
  pg = new PGlite();
  await pg.query(`create table expense_categories (
    id uuid primary key, spreadsheet_id text not null, name text not null,
    archived_at timestamptz, deleted_at timestamptz)`);
  await pg.query(`create table expense_entries (
    id uuid primary key, spreadsheet_id text not null, category_id uuid not null,
    category_name_at_entry text not null, item_name text not null,
    amount_won bigint not null, period_start date not null, period_end date not null,
    deleted_at timestamptz,
    created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
    created_by_email text not null, updated_by_email text not null)`);
  await pg.query(`create table expense_entry_idempotency (
    spreadsheet_id text not null, idempotency_key uuid not null,
    entry_id uuid not null, request_hash text not null,
    created_at timestamptz not null default now(),
    unique (spreadsheet_id, idempotency_key))`);
  pool = {
    query: async (text: string, params?: unknown[]) => {
      // PGlite reports affectedRows where node-pg reports rowCount.
      const r = (await pg.query(text, (params ?? []) as never[])) as unknown as {
        rows: Record<string, unknown>[];
        rowCount?: number | null;
        affectedRows?: number | null;
      };
      return {
        rows: r.rows,
        rowCount: r.rowCount ?? r.affectedRows ?? null,
      };
    },
  };
}, 60000);

beforeEach(async () => {
  await pg.query("delete from expense_entry_idempotency");
  await pg.query("delete from expense_entries");
  await pg.query("delete from expense_categories");
  await pg.query("insert into expense_categories (id, spreadsheet_id, name) values ($1, $2, '운영비')", [CAT_A, SHEET_A]);
  await pg.query("insert into expense_categories (id, spreadsheet_id, name) values ($1, $2, '운영비')", [CAT_B, SHEET_B]);
});

async function entryCount(sheet: string): Promise<number> {
  const r = await pg.query("select count(*)::int as n from expense_entries where spreadsheet_id=$1", [sheet]);
  return Number((r.rows[0] as { n: number }).n);
}

describe("expense idempotency — real SQL", () => {
  it("commit + lost ACK + retry ⇒ one row, created=false on replay", async () => {
    const key = randomUUID();
    const first = await createExpenseEntryIdempotent(SHEET_A, ACTOR, expenseInput(CAT_A), key, { pool, skipEnsure: true });
    expect(first.created).toBe(true);
    expect(first.entry.id).toBe(key); // the key IS the PK
    // Response lost → client retries with the same key + payload.
    const replay = await createExpenseEntryIdempotent(SHEET_A, ACTOR, expenseInput(CAT_A), key, { pool, skipEnsure: true });
    expect(replay.created).toBe(false);
    expect(replay.entry.id).toBe(key);
    expect(await entryCount(SHEET_A)).toBe(1);
  });

  it("same key + different business payload ⇒ 409, original kept, carries entryId", async () => {
    const key = randomUUID();
    await createExpenseEntryIdempotent(SHEET_A, ACTOR, expenseInput(CAT_A), key, { pool, skipEnsure: true });
    const err = await createExpenseEntryIdempotent(
      SHEET_A, ACTOR, expenseInput(CAT_A, 999999), key, { pool, skipEnsure: true },
    ).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe("expense_idempotency_conflict");
    expect((err as { entryId?: unknown }).entryId).toBe(key);
    expect(await entryCount(SHEET_A)).toBe(1);
    const row = await pg.query("select amount_won as a from expense_entries where id=$1", [key]);
    expect(Number((row.rows[0] as { a: string }).a)).toBe(100000); // not overwritten
  });

  it("different keys + identical values ⇒ two legit rows", async () => {
    const a = await createExpenseEntryIdempotent(SHEET_A, ACTOR, expenseInput(CAT_A), randomUUID(), { pool, skipEnsure: true });
    const b = await createExpenseEntryIdempotent(SHEET_A, ACTOR, expenseInput(CAT_A), randomUUID(), { pool, skipEnsure: true });
    expect(a.entry.id).not.toBe(b.entry.id);
    expect(await entryCount(SHEET_A)).toBe(2);
  });

  it("cross-scope same key ⇒ 409 with NO id leaked, both scopes intact", async () => {
    const key = randomUUID();
    await createExpenseEntryIdempotent(SHEET_A, ACTOR, expenseInput(CAT_A), key, { pool, skipEnsure: true });
    const err = await createExpenseEntryIdempotent(
      SHEET_B, ACTOR, expenseInput(CAT_B), key, { pool, skipEnsure: true },
    ).catch((e) => e);
    expect((err as Error).message).toBe("expense_idempotency_conflict");
    expect((err as { entryId?: unknown }).entryId).toBeUndefined();
    expect(await entryCount(SHEET_A)).toBe(1);
    expect(await entryCount(SHEET_B)).toBe(0);
  });

  it("replay compares the ORIGINAL fingerprint, not the PATCHed row", async () => {
    const key = randomUUID();
    const input = expenseInput(CAT_A);
    await createExpenseEntryIdempotent(SHEET_A, ACTOR, input, key, { pool, skipEnsure: true });
    // Later legitimate edit changes the mutable row.
    await pg.query("update expense_entries set amount_won=$2 where id=$1", [key, 55555]);
    // Lost-ACK retry of the ORIGINAL still replays — not a 409.
    const replay = await createExpenseEntryIdempotent(SHEET_A, ACTOR, input, key, { pool, skipEnsure: true });
    expect(replay.created).toBe(false);
    expect(replay.entry.id).toBe(key);
    expect(await entryCount(SHEET_A)).toBe(1);
  });

  it("replay never resurrects a deleted row", async () => {
    const key = randomUUID();
    const input = expenseInput(CAT_A);
    await createExpenseEntryIdempotent(SHEET_A, ACTOR, input, key, { pool, skipEnsure: true });
    await pg.query("update expense_entries set deleted_at=now() where id=$1", [key]);
    const err = await createExpenseEntryIdempotent(SHEET_A, ACTOR, input, key, { pool, skipEnsure: true }).catch((e) => e);
    expect((err as Error).message).toBe("expense_entry_not_found");
    const row = await pg.query("select deleted_at as d from expense_entries where id=$1", [key]);
    expect((row.rows[0] as { d: unknown }).d).not.toBeNull();
  });

  it("unknown/archived category ⇒ 404, nothing inserted", async () => {
    const err = await createExpenseEntryIdempotent(
      SHEET_A, ACTOR, expenseInput(randomUUID()), randomUUID(), { pool, skipEnsure: true },
    ).catch((e) => e);
    expect((err as Error).message).toBe("expense_category_not_found");
    expect(await entryCount(SHEET_A)).toBe(0);
  });
});

describe("normalizeIdempotencyKey", () => {
  it("absent ⇒ null (legacy callers keep behavior)", () => {
    expect(normalizeIdempotencyKey(null)).toBeNull();
    expect(normalizeIdempotencyKey(undefined)).toBeNull();
    expect(normalizeIdempotencyKey("")).toBeNull();
    expect(normalizeIdempotencyKey("   ")).toBeNull();
  });

  it("uuid ⇒ lowercased key; malformed ⇒ invalid_request (fail closed)", () => {
    const id = randomUUID();
    expect(normalizeIdempotencyKey(id)).toBe(id.toLowerCase());
    expect(normalizeIdempotencyKey(id.toUpperCase())).toBe(id.toLowerCase());
    expect(() => normalizeIdempotencyKey("not-a-key")).toThrow("invalid_request");
    expect(() => normalizeIdempotencyKey("sheet-1")).toThrow("invalid_request");
  });
});
