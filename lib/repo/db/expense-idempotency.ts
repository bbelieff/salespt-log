/**
 * Layer: repo/db — one-off expense creation with server-enforced idempotency.
 *
 * Contract (Scope E2):
 *  · The idempotency key IS the entry PK (existing expense_entries UUID PK —
 *    no migration of business tables). Same key + same payload ⇒ the first
 *    commit is returned (200 on replay, 201 on create).
 *  · Same key + different payload ⇒ Error("expense_idempotency_conflict")
 *    (409, already mapped in app/api/expenses/_response.ts). The stored
 *    original is never returned as if it matched, never overwritten.
 *  · Replay compares the ORIGINAL request fingerprint, not the mutable row:
 *    a later PATCH changes business columns but the fingerprint table keeps
 *    the creation hash, so a lost-ACK retry of the original still replays
 *    instead of 409ing. A soft-deleted row is never resurrected — replay of
 *    a deleted row throws Error("expense_entry_not_found").
 *  · Cross-scope (same key, another spreadsheet) ⇒ 409 with NO row data:
 *    the PK insert loses the global race and we must not return the other
 *    scope's row.
 *  · No `catch (23505)` inside an aborted transaction: the entry insert uses
 *    ON CONFLICT DO NOTHING + rowCount/read-back, so the tx never aborts on
 *    a key race. Category authorization (scoped, active category) is checked
 *    inside the same tx before any insert.
 *  · Same-key concurrency serializes on a transaction-scoped advisory lock
 *    (precedent: expense-ledger.ts ensureUnclassifiedCategory). Different
 *    keys use different lock strings and proceed in parallel.
 *
 * Storage: one additive table `expense_entry_idempotency`
 * (spreadsheet_id, idempotency_key) unique + entry_id + request_hash.
 * Created with CREATE TABLE IF NOT EXISTS (no migration run needed);
 * server-side pool only, spreadsheet-scoped reads, no anonymous exposure.
 *
 * E3 exposure hardening: the table enables RLS with NO broad policies and
 * revokes PUBLIC plus anon/authenticated (when those roles exist) inside
 * the same transactional ensure — no brief exposure window. The server
 * service role / table owner bypasses RLS and remains the only path.
 * Ensures are cached per pool with retry on failure (not DDL per write).
 */
import { ensureExpenseLedgerSchema } from "./expense-ledger";
import { dbEnabled, getDbPool } from "./client";
import { fingerprintRequest } from "./idempotency-keys";
import type { CreateExpenseBody, ExpenseEntry } from "@/types/expense-ledger";

export const EXPENSE_IDEMPOTENCY_CONFLICT = "expense_idempotency_conflict";

/** Minimal query surface — pg Pool/PoolClient satisfy it; tests inject PGlite. */
export interface IdemPool {
  query(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
  connect?: () => Promise<IdemPool & { release(): void }>;
}

export interface ExpenseIdemDeps {
  pool?: IdemPool;
  /** Tests create the (same-DDL) schema manually and skip ensures. */
  skipEnsure?: boolean;
}

const IDEM_DDL = `create table if not exists expense_entry_idempotency (
  spreadsheet_id text not null,
  idempotency_key uuid not null,
  entry_id uuid not null,
  request_hash text not null,
  created_at timestamptz not null default now(),
  unique (spreadsheet_id, idempotency_key)
)`;

/**
 * Transactional harden: DDL + RLS + revokes commit atomically, so the table
 * is never briefly world-readable. No policies are created — with RLS
 * enabled and zero policies, non-owner roles see nothing; the table owner /
 * service role bypasses RLS and stays the only path. Existing business
 * tables are untouched.
 */
async function doEnsureExpenseIdemSchema(pool: IdemPool): Promise<void> {
  const conn = pool.connect ? await pool.connect() : pool;
  try {
    await conn.query("begin");
    await conn.query(IDEM_DDL);
    await conn.query("alter table expense_entry_idempotency enable row level security");
    await conn.query("revoke all on expense_entry_idempotency from public");
    await conn.query(`do $$ begin
      if exists (select 1 from pg_roles where rolname = 'anon') then
        revoke all on expense_entry_idempotency from anon;
      end if;
      if exists (select 1 from pg_roles where rolname = 'authenticated') then
        revoke all on expense_entry_idempotency from authenticated;
      end if;
    end $$`);
    await conn.query("commit");
  } catch (e) {
    await conn.query("rollback").catch(() => {});
    throw e;
  } finally {
    if (conn !== pool && typeof (conn as { release?: unknown }).release === "function") {
      (conn as unknown as { release(): void }).release();
    }
  }
}

const idemEnsureCache = new WeakMap<object, Promise<void>>();

/** Cached per pool; a failure clears the entry so the next write retries. */
export function ensureExpenseIdemSchema(pool: IdemPool): Promise<void> {
  const key = pool as object;
  const hit = idemEnsureCache.get(key);
  if (hit) return hit;
  const p = doEnsureExpenseIdemSchema(pool).catch((e) => {
    if (idemEnsureCache.get(key) === p) idemEnsureCache.delete(key);
    throw e;
  });
  idemEnsureCache.set(key, p);
  return p;
}

async function runTx<T>(pool: IdemPool, work: (db: IdemPool) => Promise<T>): Promise<T> {
  const conn = pool.connect ? await pool.connect() : pool;
  try {
    await conn.query("begin");
    const out = await work(conn);
    await conn.query("commit");
    return out;
  } catch (e) {
    await conn.query("rollback").catch(() => {});
    throw e;
  } finally {
    if (conn !== pool && typeof (conn as { release?: unknown }).release === "function") {
      (conn as unknown as { release(): void }).release();
    }
  }
}

function lockScope(spreadsheetId: string, key: string): string {
  return `expense-entry:${spreadsheetId}:${key}`;
}

/** Original-request fingerprint — business fields only, normalized. */
export function expenseRequestFingerprint(input: CreateExpenseBody): string {
  return fingerprintRequest({
    v: 1,
    categoryId: String(input.categoryId).toLowerCase(),
    itemName: String(input.itemName).trim(),
    amountWon: Number(input.amountWon),
    periodStart: String(input.periodStart),
    periodEnd: String(input.periodEnd ?? input.periodStart),
  });
}

function mapEntry(row: Record<string, unknown>): ExpenseEntry {
  const iso = (v: unknown): string => {
    const s =
      v instanceof Date
        ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`
        : String(v).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("expense_invalid_stored_date");
    return s;
  };
  return {
    id: String(row.id),
    categoryId: String(row.category_id),
    categoryName: String(row.category_name),
    itemName: String(row.item_name),
    amountWon: Number(row.amount_won),
    periodStart: iso(row.period_start),
    periodEnd: iso(row.period_end),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export interface ExpenseIdemOutcome {
  entry: ExpenseEntry;
  /** False on replay (route answers 200 instead of 201). */
  created: boolean;
}

/**
 * Idempotent one-off expense create. Callers without a key keep using
 * createExpenseEntry (untouched legacy path).
 */
export async function createExpenseEntryIdempotent(
  spreadsheetId: string,
  actorEmail: string,
  input: CreateExpenseBody,
  key: string,
  deps: ExpenseIdemDeps = {},
): Promise<ExpenseIdemOutcome> {
  const pool = deps.pool ?? (getDbPool() as unknown as IdemPool);
  if (!deps.skipEnsure) {
    if (!dbEnabled()) throw new Error("expense_ledger_unavailable");
    await ensureExpenseLedgerSchema();
    await ensureExpenseIdemSchema(pool);
  }
  const hash = expenseRequestFingerprint(input);
  const end = input.periodEnd ?? input.periodStart;

  return runTx(pool, async (db) => {
    await db.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [
      lockScope(spreadsheetId, key),
    ]);

    // Lost-ACK retry or concurrent duplicate: the fingerprint record decides.
    const prior = await db.query(
      "select entry_id, request_hash from expense_entry_idempotency where spreadsheet_id=$1 and idempotency_key=$2",
      [spreadsheetId, key],
    );
    const rec = prior.rows[0] as
      | { entry_id: unknown; request_hash: unknown }
      | undefined;
    if (rec) {
      if (String(rec.request_hash) !== hash) {
        // Same key, different business payload — never return the stale
        // original, never overwrite it. Attach our own row id so the client
        // can PATCH it (same owner scope — no cross-student data).
        const err = new Error(EXPENSE_IDEMPOTENCY_CONFLICT) as Error & { entryId: string };
        err.entryId = String(rec.entry_id);
        throw err;
      }
      const found = await db.query(
        `select e.*, c.name as category_name from expense_entries e
         join expense_categories c on c.id = e.category_id
         where e.id=$1 and e.spreadsheet_id=$2`,
        [String(rec.entry_id), spreadsheetId],
      );
      const row = found.rows[0];
      if (!row) throw new Error("expense_entry_not_found");
      if (row.deleted_at) throw new Error("expense_entry_not_found");
      return { entry: mapEntry(row), created: false };
    }

    // First execution: category authorization first (scoped + active).
    const cat = await db.query(
      "select id, name from expense_categories where spreadsheet_id=$1 and id=$2 and archived_at is null and deleted_at is null for key share",
      [spreadsheetId, input.categoryId],
    );
    const catRow = cat.rows[0];
    if (!catRow) throw new Error("expense_category_not_found");

    // The key IS the PK. ON CONFLICT DO NOTHING keeps the tx alive on a
    // cross-scope PK race (same uuid owned by another spreadsheet) — the
    // rowCount check below turns it into a 409 with no data returned.
    const ins = await db.query(
      `insert into expense_entries
        (id, spreadsheet_id, category_id, category_name_at_entry, item_name,
         amount_won, period_start, period_end, created_by_email, updated_by_email)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
       on conflict (id) do nothing`,
      [
        key,
        spreadsheetId,
        input.categoryId,
        String(catRow.name),
        input.itemName.trim(),
        input.amountWon,
        input.periodStart,
        end,
        actorEmail,
      ],
    );
    if ((ins.rowCount ?? 0) !== 1) throw new Error(EXPENSE_IDEMPOTENCY_CONFLICT);

    await db.query(
      `insert into expense_entry_idempotency
        (spreadsheet_id, idempotency_key, entry_id, request_hash)
       values ($1,$2,$3,$4)
       on conflict (spreadsheet_id, idempotency_key) do nothing`,
      [spreadsheetId, key, key, hash],
    );
    // Defensive read-back (same tx, same lock): confirms OUR record won.
    const check = await db.query(
      "select entry_id, request_hash from expense_entry_idempotency where spreadsheet_id=$1 and idempotency_key=$2",
      [spreadsheetId, key],
    );
    const own = check.rows[0] as { entry_id: unknown; request_hash: unknown } | undefined;
    if (!own || String(own.entry_id) !== key || String(own.request_hash) !== hash) {
      throw new Error(EXPENSE_IDEMPOTENCY_CONFLICT);
    }

    const done = await db.query(
      `select e.*, c.name as category_name from expense_entries e
       join expense_categories c on c.id = e.category_id
       where e.id=$1 and e.spreadsheet_id=$2`,
      [key, spreadsheetId],
    );
    const row = done.rows[0];
    if (!row) throw new Error("expense_ledger_failed");
    return { entry: mapEntry(row), created: true };
  });
}
