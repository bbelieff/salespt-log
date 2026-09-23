/**
 * Scope E3 — expense_entry_idempotency exposure hardening, against REAL SQL
 * (disposable PGlite: no DATABASE_URL, no network, no production data).
 *
 * Proves: RLS enabled with zero broad policies, PUBLIC revoked,
 * anon/authenticated (created as test roles) revoked, the owner path still
 * inserts/replays, ensures cached per pool with retry on failure.
 * Business tables are untouched by the ensure (columns/catalog unchanged).
 */
import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import {
  createExpenseEntryIdempotent,
  ensureExpenseIdemSchema,
  type IdemPool,
} from "@/repo/db/expense-idempotency";

const SHEET = "sheet-owner";
const ACTOR = "owner@example.com";
const CAT = randomUUID();

let pg: PGlite;

/** Fresh wrapper per ensure under test (cache is per pool object). */
function wrap(counter?: { ddl: number }): IdemPool {
  return {
    query: async (text: string, params?: unknown[]) => {
      if (counter && /create table if not exists expense_entry_idempotency/i.test(text)) {
        counter.ddl += 1;
      }
      const r = (await pg.query(text, (params ?? []) as never[])) as unknown as {
        rows: Record<string, unknown>[];
        rowCount?: number | null;
        affectedRows?: number | null;
      };
      return { rows: r.rows, rowCount: r.rowCount ?? r.affectedRows ?? null };
    },
  };
}

function input() {
  return { categoryId: CAT, itemName: "사무실 임차료", amountWon: 100000, periodStart: "2026-09-01" };
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
  await pg.query("insert into expense_categories (id, spreadsheet_id, name) values ($1, $2, '운영비')", [CAT, SHEET]);
}, 60000);

describe("expense_entry_idempotency hardening — real SQL", () => {
  it("ensure enables RLS with zero policies (no broad access)", async () => {
    await ensureExpenseIdemSchema(wrap());
    const cls = await pg.query(
      "select relrowsecurity as rls from pg_class where relname='expense_entry_idempotency'",
    );
    expect((cls.rows[0] as { rls: boolean }).rls).toBe(true);
    const policies = await pg.query(
      "select count(*)::int as n from pg_policies where tablename='expense_entry_idempotency'",
    );
    expect(Number((policies.rows[0] as { n: number }).n)).toBe(0);
  });

  it("PUBLIC has no privileges on the table", async () => {
    await ensureExpenseIdemSchema(wrap());
    const r = await pg.query(
      "select has_table_privilege('public', 'expense_entry_idempotency', 'select') as s",
    );
    expect((r.rows[0] as { s: boolean }).s).toBe(false);
  });

  it("anon/authenticated test roles are revoked when they exist", async () => {
    await pg.query("do $$ begin " +
      "if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; " +
      "if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; " +
      "end $$");
    await ensureExpenseIdemSchema(wrap()); // fresh pool object ⇒ fresh ensure
    for (const role of ["anon", "authenticated"]) {
      const r = await pg.query(
        `select has_table_privilege('${role}', 'expense_entry_idempotency', 'select') as s`,
      );
      expect((r.rows[0] as { s: boolean }).s, role).toBe(false);
    }
  });

  it("owner path still inserts and replays (service role remains the path)", async () => {
    const pool = wrap();
    await ensureExpenseIdemSchema(pool);
    const key = randomUUID();
    const first = await createExpenseEntryIdempotent(SHEET, ACTOR, input(), key, { pool, skipEnsure: true });
    expect(first.created).toBe(true);
    const replay = await createExpenseEntryIdempotent(SHEET, ACTOR, input(), key, { pool, skipEnsure: true });
    expect(replay.created).toBe(false);
  });

  it("ensure is cached per pool (no DDL on every write) and retries after failure", async () => {
    const counter = { ddl: 0 };
    const pool = wrap(counter);
    await ensureExpenseIdemSchema(pool);
    await ensureExpenseIdemSchema(pool);
    await ensureExpenseIdemSchema(pool);
    expect(counter.ddl).toBe(1);

    // Failure clears the cache entry: a failing pool rejects, then the same
    // wrapper shape with a working transport retries successfully.
    let fail = true;
    const flaky: IdemPool = {
      query: async (text: string, params?: unknown[]) => {
        if (fail) throw new Error("connection down");
        return wrap().query(text, params);
      },
    };
    await expect(ensureExpenseIdemSchema(flaky)).rejects.toThrow("connection down");
    fail = false;
    await ensureExpenseIdemSchema(flaky); // retry works — failure did not stick
  });

  it("business tables are unchanged by the ensure", async () => {
    await ensureExpenseIdemSchema(wrap());
    const rls = await pg.query(
      "select relname from pg_class where relname in ('expense_categories','expense_entries') and relrowsecurity",
    );
    expect(rls.rows.length).toBe(0); // RLS untouched outside the idempotency table
    const cols = await pg.query(
      `select column_name from information_schema.columns
       where table_name='expense_entries' order by ordinal_position`,
    );
    expect((cols.rows as { column_name: string }[]).map((c) => c.column_name)).toContain("category_name_at_entry");
  });
});
