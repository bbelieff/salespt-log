/**
 * Layer: repo/db — DB-tab appends with server-enforced idempotency (E3).
 *
 * Claim-then-write: the physical row is CLAIMED in Postgres first; the sheet
 * write targets the claimed row (same-row rewrite is idempotent, fresh
 * allocation per attempt is not). No tx pretends the external write is atomic.
 *
 * E3 scope coordination (different keys, same spreadsheet+section): per-key
 * locks alone let two keys scan the same empty sheet row and overwrite each
 * other. Allocation is therefore coordinated two ways: a session-level scope
 * lock serializes scan+claim (keyed) and scan+write (keyless) on real
 * multi-connection Postgres (bounded lock_timeout, finally-release, the
 * connection is destroyed when unlock fails); and the claim itself is DURABLE
 * (committed before any external write) with every allocation EXCLUDING all
 * reserved rows — pending (incl. abandoned crash-before-write) + live
 * mirrors. The lock closes the race, the exclusion survives crashes.
 * Completed/cleared/conflict is rechecked under coordination BEFORE any
 * external write, and the scope hold is kept THROUGH the write and the
 * short durable completion on the same locked connection (E4): a waiting
 * same-key sibling then sees the completion and never calls writeAt, so a
 * delayed write cannot overwrite after a PATCH/delete. Same-key retry
 * after PATCH never rewrites, retry after delete never resurrects.
 *
 * Honest harness note: single-connection harnesses (PGlite) exercise the
 * mutex + durable exclusion, not multi-connection advisory-lock racing —
 * cross-instance serialization is provided by the advisory half on real
 * Postgres and is stated as deployment reasoning, never as harness proof.
 */
import { ensureSchema, getDbPool } from "./client";
import { fingerprintRequest } from "./idempotency-keys";
import type { IdemPool } from "./expense-idempotency";
import type { SectionWriteSpec } from "../db-tab-writers";

export const DB_IDEMPOTENCY_CONFLICT = "db_idempotency_conflict";
export const DB_IDEMPOTENCY_UNAVAILABLE = "db_idempotency_unavailable";
export const DB_ENTRY_NOT_FOUND = "db_entry_not_found";
export const DB_IDEM_TAB = "db_idem";

export interface DbAppendIdemDeps {
  pool?: IdemPool;
  skipEnsure?: boolean; // tests build the (same-DDL) schema manually
}

export interface SheetAppendOps {
  findEmptyRow(excluded?: Set<number>): Promise<number>; // first attempt only
  writeAt(row: number): Promise<void>; // overwrite semantics — idempotent
  checkOverlap?(excludeRow: number): Promise<void>; // direct-production guard
}

const idemRowKey = (section: string, key: string): string => `${section}:${key}`;
const lockScope = (spreadsheetId: string, section: string, key: string): string =>
  `db-append:${spreadsheetId}:${section}:${key}`;
const scopeLockKey = (spreadsheetId: string, section: string): string =>
  `db-append-scope:${spreadsheetId}:${section}`;

/** Fingerprint over user intent — volatile server ids (row, 발굴id) excluded. */
export function dbAppendFingerprint(section: string, business: Record<string, unknown>): string {
  const { row: _row, 발굴id: _lead, ...rest } = business;
  return fingerprintRequest({ v: 1, section, business: rest });
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

type Releasable = IdemPool & { release?: (err?: unknown) => void };

/** In-process FIFO mutex per scope — the inner layer: serializes same-scope
 *  coordination inside this instance. Settled entries are removed when no
 *  waiter is queued behind (no per-sheet leak); a queued waiter replaces the
 *  entry before the holder's cleanup check, so cleanup never steals it.
 *  Never nested (callers hold at most one scope lock at a time). */
const scopeMutexes = new Map<string, Promise<void>>();

async function withScopeMutex<T>(key: string, work: () => Promise<T>): Promise<T> {
  const prev = scopeMutexes.get(key) ?? Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>((r) => { release = r; });
  const next = prev.then(() => mine);
  scopeMutexes.set(key, next);
  await prev;
  try {
    return await work();
  } finally {
    release();
    if (scopeMutexes.get(key) === next) scopeMutexes.delete(key);
  }
}

/**
 * Scope coordination: in-process mutex (inner) + session advisory lock with
 * bounded lock_timeout on a dedicated connection (outer, cross-instance).
 * Shared single-connection harnesses skip the advisory half and exercise the
 * mutex + durable exclusion — still the real code path, honestly labelled.
 */
export async function withScopeLock<T>(
  pool: IdemPool, spreadsheetId: string, section: string, work: (db: IdemPool) => Promise<T>,
): Promise<T> {
  return withScopeMutex(scopeLockKey(spreadsheetId, section), async () => {
    if (!pool.connect) return work(pool);
    const conn = (await pool.connect()) as Releasable;
    let destroyed = false;
    try {
      await conn.query("select set_config('lock_timeout', '3s', false)").catch(() => {});
      await conn.query("select pg_advisory_lock(hashtextextended($1, 0))", [scopeLockKey(spreadsheetId, section)]);
      try {
        return await work(conn);
      } finally {
        try {
          await conn.query("select pg_advisory_unlock(hashtextextended($1, 0))", [scopeLockKey(spreadsheetId, section)]);
        } catch {
          try { conn.release?.(new Error("[db] scope unlock failed")); } catch {}
          destroyed = true;
        }
      }
    } finally {
      await conn.query("select set_config('lock_timeout', '0', false)").catch(() => {});
      if (!destroyed) conn.release?.();
    }
  });
}

interface Reservation { pending: boolean; hash: string; claimedRow: number | null; }

async function readReservation(db: IdemPool, spreadsheetId: string, rowKey: string) {
  const r = await db.query(
    `select payload from sheet_rows where spreadsheet_id=$1 and tab='${DB_IDEM_TAB}' and row_key=$2`,
    [spreadsheetId, rowKey],
  );
  const payload = r.rows[0]?.payload as Record<string, unknown> | undefined;
  if (!payload) return null;
  const claimed = payload._claimed_row;
  return {
    rowKey, pending: payload._idem_pending !== false, hash: String(payload._idem_hash ?? ""),
    claimedRow: typeof claimed === "number" && Number.isInteger(claimed) ? claimed : null,
  };
}

async function readMirrorRow(db: IdemPool, spreadsheetId: string, rowKey: string) {
  const r = await db.query(
    `select payload from sheet_rows where spreadsheet_id=$1 and tab='db' and row_key=$2`,
    [spreadsheetId, rowKey],
  );
  const payload = r.rows[0]?.payload as Record<string, unknown> | undefined;
  if (!payload) return null;
  const row = payload._row;
  if (typeof row !== "number" || !Number.isInteger(row)) return null;
  return { row, hash: String(payload._idem_hash ?? ""), cleared: payload._cleared === true };
}

/** Reserved rows: pending claims (incl. abandoned) + live mirrors. Cleared mirrors are free. */
export async function readReservedRows(db: IdemPool, spreadsheetId: string, section: string): Promise<Set<number>> {
  const out = new Set<number>();
  const idem = await db.query(`select payload from sheet_rows where spreadsheet_id=$1 and tab='${DB_IDEM_TAB}'`, [spreadsheetId]);
  for (const r of idem.rows) {
    const p = r.payload as Record<string, unknown>;
    if (p._section !== section) continue;
    const c = p._claimed_row;
    if (typeof c === "number" && Number.isInteger(c)) out.add(c);
  }
  const mirrors = await db.query(
    `select payload from sheet_rows where spreadsheet_id=$1 and tab='db' and row_key like $2`,
    [spreadsheetId, `${section}:%`],
  );
  for (const r of mirrors.rows) {
    const p = r.payload as Record<string, unknown>;
    if (p._cleared === true) continue;
    const n = p._row;
    if (typeof n === "number" && Number.isInteger(n)) out.add(n);
  }
  return out;
}

function conflict(hash: string, row: number | null): never {
  const err = new Error(DB_IDEMPOTENCY_CONFLICT) as Error & { row?: number; hash: string };
  err.hash = hash;
  if (row !== null) err.row = row;
  throw err;
}

function notFound(): never {
  throw new Error(DB_ENTRY_NOT_FOUND);
}

/** Completed mirror verdict: replay vs 409 vs gone (never resurrects). */
function decideCompleted(
  mirror: { row: number; hash: string; cleared: boolean } | null,
  fingerprint: string, fallbackRow: number | null,
): { row: number; replayed: true } {
  if (!mirror) {
    if (fallbackRow === null) throw new Error("[db] idempotency record without mirror row");
    return { row: fallbackRow, replayed: true };
  }
  if (mirror.cleared) notFound();
  if (mirror.hash !== fingerprint) conflict(mirror.hash, mirror.row);
  return { row: mirror.row, replayed: true };
}

export type DbAppendLookup =
  | { status: "miss" }
  | { status: "complete"; row: number }
  | { status: "pending"; claimedRow: number | null };

/** Sheet primitives injected by lib/repo/db.ts (avoids a module cycle). */
export interface KeyedSheetDeps {
  findFirstEmptyRow(
    spreadsheetId: string, startCol: string, endCol: string,
    isPhantom: (r: unknown[]) => boolean, excluded?: Set<number>,
  ): Promise<{ row: number; needInsert: boolean }>;
  writeRow(
    spreadsheetId: string, spec: SectionWriteSpec, row: number, values: (string | number | boolean)[],
  ): Promise<void>;
  specFor(section: string): SectionWriteSpec;
}

/** Keyed branch shared by the four appends — reservation-claimed row. */
export function appendKeyed(
  deps: KeyedSheetDeps, spreadsheetId: string, section: string, key: string,
  p: Record<string, unknown>, isPhantom: (r: unknown[]) => boolean,
  values: (string | number | boolean)[], fullMsg: (lastRow: number) => string,
  extra?: Pick<SheetAppendOps, "checkOverlap">,
) {
  const { row: _strip, ...business } = p;
  const spec = deps.specFor(section);
  const ops: SheetAppendOps = {
    findEmptyRow: async (excluded) => {
      const found = await deps.findFirstEmptyRow(spreadsheetId, spec.startCol, spec.endCol, isPhantom, excluded);
      if (found.needInsert) throw new Error(fullMsg(found.row - 1));
      return found.row;
    },
    writeAt: (row) => deps.writeRow(spreadsheetId, spec, row, values),
    ...extra,
  };
  return appendDbRowIdempotent({ spreadsheetId, section, key, business, ops });
}

/** Side-effect-free pre-check (direct-production guard runs AFTER replay detection). */
export async function lookupDbAppend(
  spreadsheetId: string, section: string, key: string, fingerprint: string, deps: DbAppendIdemDeps = {},
): Promise<DbAppendLookup> {
  const pool = deps.pool ?? (getDbPool() as unknown as IdemPool);
  if (!deps.skipEnsure) await ensureSchema();
  const rowKey = idemRowKey(section, key);
  return runTx(pool, async (db) => {
    await db.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [lockScope(spreadsheetId, section, key)]);
    const res = await readReservation(db, spreadsheetId, rowKey);
    if (!res) {
      const mirror = await readMirrorRow(db, spreadsheetId, rowKey);
      if (!mirror) return { status: "miss" };
      if (mirror.cleared) notFound();
      if (mirror.hash !== fingerprint) conflict(mirror.hash, mirror.row);
      return { status: "complete", row: mirror.row };
    }
    if (!res.pending) {
      const mirror = await readMirrorRow(db, spreadsheetId, rowKey);
      if (mirror) {
        if (mirror.cleared) notFound();
        if (mirror.hash !== fingerprint) conflict(mirror.hash, mirror.row);
      }
      if (res.hash !== fingerprint) conflict(res.hash, mirror?.row ?? null);
      const done = decideCompleted(mirror, fingerprint, res.claimedRow);
      return { status: "complete", row: done.row };
    }
    if (res.hash !== fingerprint) conflict(res.hash, null);
    return { status: "pending", claimedRow: res.claimedRow };
  });
}

export interface AppendIdempotentInput {
  spreadsheetId: string; section: string; key: string;
  business: Record<string, unknown>; ops: SheetAppendOps; deps?: DbAppendIdemDeps;
}

export interface AppendIdempotentOutcome { row: number; replayed: boolean; }

export async function appendDbRowIdempotent(input: AppendIdempotentInput): Promise<AppendIdempotentOutcome> {
  const { spreadsheetId, section, key, business, ops } = input;
  const deps = input.deps ?? {};
  const pool = deps.pool ?? (getDbPool() as unknown as IdemPool);
  if (!deps.skipEnsure) await ensureSchema();
  const fingerprint = dbAppendFingerprint(section, business);
  const rowKey = idemRowKey(section, key);

  // Phase 1 — reserve (short tx, per-key advisory lock).
  const reserved = await runTx(pool, async (db) => {
    await db.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [lockScope(spreadsheetId, section, key)]);
    const res = await readReservation(db, spreadsheetId, rowKey);
    if (!res) {
      const mirror = await readMirrorRow(db, spreadsheetId, rowKey);
      if (mirror) return { done: true as const, ...decideCompleted(mirror, fingerprint, null) };
      await db.query(
        `insert into sheet_rows (cohort, email, spreadsheet_id, tab, row_key, payload, updated_at)
         values ('', '', $1, '${DB_IDEM_TAB}', $2, $3::jsonb, now())
         on conflict (spreadsheet_id, tab, row_key) do nothing`,
        [spreadsheetId, rowKey, JSON.stringify({
          _idem_pending: true, _idem_hash: fingerprint, _section: section, _claimed_row: null,
        })],
      );
      const reread = await readReservation(db, spreadsheetId, rowKey);
      if (!reread) throw new Error("[db] idempotency reservation failed");
      if (reread.hash !== fingerprint) conflict(reread.hash, null);
      if (!reread.pending) {
        const m = await readMirrorRow(db, spreadsheetId, rowKey);
        if (m) return { done: true as const, ...decideCompleted(m, fingerprint, null) };
      }
      return { done: false as const, claimedRow: reread.claimedRow };
    }
    if (!res.pending) {
      const mirror = await readMirrorRow(db, spreadsheetId, rowKey);
      if (mirror) {
        if (mirror.cleared) notFound();
        if (mirror.hash !== fingerprint) conflict(mirror.hash, mirror.row);
      }
      if (res.hash !== fingerprint) conflict(res.hash, mirror?.row ?? null);
      const done = decideCompleted(mirror, fingerprint, res.claimedRow);
      return { done: true as const, ...done };
    }
    if (res.hash !== fingerprint) conflict(res.hash, null);
    return { done: false as const, claimedRow: res.claimedRow };
  });
  if (reserved.done) return { row: reserved.row, replayed: true };

  // Phase 2 — allocate + durably claim under the scope lock (the committed
  // claim, not the lock, guards the later sheet write; abandoned claims stay
  // reserved so a different key never reuses the row).
  let target = reserved.claimedRow;
  if (target === null) {
    const allocated = await withScopeLock(pool, spreadsheetId, section, async (db) => {
      const res = await readReservation(db, spreadsheetId, rowKey);
      if (res && !res.pending) {
        const m = await readMirrorRow(db, spreadsheetId, rowKey);
        return { done: true as const, ...decideCompleted(m, fingerprint, res.claimedRow) };
      }
      if (res && res.hash !== fingerprint) conflict(res.hash, null);
      if (res?.claimedRow != null) return { done: false as const, claimedRow: res.claimedRow };
      if (!res) {
        const m = await readMirrorRow(db, spreadsheetId, rowKey);
        if (m) return { done: true as const, ...decideCompleted(m, fingerprint, null) };
      }
      const excluded = await readReservedRows(db, spreadsheetId, section);
      const candidate = await ops.findEmptyRow(excluded);
      const claimPayload = JSON.stringify({ _claimed_row: candidate });
      if (res) {
        await db.query(
          `update sheet_rows set payload = payload || $3::jsonb, updated_at = now()
           where spreadsheet_id=$1 and tab='${DB_IDEM_TAB}' and row_key=$2
           and (payload->>'_claimed_row') is null`,
          [spreadsheetId, rowKey, claimPayload],
        );
      } else {
        await db.query(
          `insert into sheet_rows (cohort, email, spreadsheet_id, tab, row_key, payload, updated_at)
           values ('', '', $1, '${DB_IDEM_TAB}', $2, $3::jsonb, now())
           on conflict (spreadsheet_id, tab, row_key) do nothing`,
          [spreadsheetId, rowKey, JSON.stringify({
            _idem_pending: true, _idem_hash: fingerprint, _section: section, _claimed_row: candidate,
          })],
        );
      }
      const again = await readReservation(db, spreadsheetId, rowKey);
      if (!again) throw new Error("[db] idempotency reservation lost");
      if (again.hash !== fingerprint) conflict(again.hash, null);
      if (again.claimedRow === null) throw new Error("[db] idempotency claim failed");
      return { done: false as const, claimedRow: again.claimedRow };
    });
    if (allocated.done) return { row: allocated.row, replayed: true };
    target = allocated.claimedRow;
  }
  const physicalRow: number = target;

  // Final coordinated section (E4): the scope hold runs from the final
  // completed-recheck THROUGH the bounded external write AND the durable
  // completion. A waiting same-key sibling therefore blocks on the scope
  // lock, then sees the completion and returns WITHOUT ever calling
  // writeAt — no delayed overwrite after a PATCH/delete. The completion
  // itself is a short tx on the SAME locked connection (never a nested
  // scope lock, so no deadlock); no tx pretends the external write is
  // atomic. checkOverlap/writeAt keep their existing bounded behavior —
  // checks are not weakened. A write failure leaves the reservation
  // pending (no completion) so the retry reuses the claimed row.
  return withScopeLock(pool, spreadsheetId, section, async (db) => {
    const res = await readReservation(db, spreadsheetId, rowKey);
    if (res && !res.pending) {
      const m = await readMirrorRow(db, spreadsheetId, rowKey);
      return decideCompleted(m, fingerprint, res.claimedRow);
    }
    if (res && res.hash !== fingerprint) conflict(res.hash, null);
    const m = await readMirrorRow(db, spreadsheetId, rowKey);
    if (m) return decideCompleted(m, fingerprint, physicalRow);

    await ops.checkOverlap?.(physicalRow);
    await ops.writeAt(physicalRow);

    return completeOnLockedDb(db);
  });

  /** Durable completion — short tx on the already scope-locked connection. */
  async function completeOnLockedDb(db: IdemPool): Promise<AppendIdempotentOutcome> {
    await db.query("begin");
    try {
      await db.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [lockScope(spreadsheetId, section, key)]);
      const cur = await readReservation(db, spreadsheetId, rowKey);
      if (!cur) throw new Error("[db] idempotency reservation lost");
      if (!cur.pending) {
        const mirror = await readMirrorRow(db, spreadsheetId, rowKey);
        const done = decideCompleted(mirror, fingerprint, cur.claimedRow);
        await db.query("commit");
        return done;
      }
      if (cur.hash !== fingerprint) conflict(cur.hash, null);
      const mirror = await readMirrorRow(db, spreadsheetId, rowKey);
      if (mirror) { // sibling (or unlockable PATCH path) won — converge
        const done = decideCompleted(mirror, fingerprint, physicalRow);
        await db.query("commit");
        return done;
      }
      // Server ids (notably lead 발굴id) stay in the mirror for update/clear
      // resolution; the fingerprint already excludes them.
      const { row: _stripRow, ...intent } = business;
      await db.query(
        `insert into sheet_rows (cohort, email, spreadsheet_id, tab, row_key, payload, updated_at)
         values ('', '', $1, 'db', $2, $3::jsonb, now())
         on conflict (spreadsheet_id, tab, row_key)
         do update set payload = excluded.payload, updated_at = now()`,
        [spreadsheetId, rowKey, JSON.stringify({ ...intent, _row: physicalRow, _cleared: false, _idem_hash: fingerprint })],
      );
      await db.query(
        `update sheet_rows set payload = payload || $3::jsonb, updated_at = now()
         where spreadsheet_id=$1 and tab='${DB_IDEM_TAB}' and row_key=$2`,
        [spreadsheetId, rowKey, JSON.stringify({ _idem_pending: false, _claimed_row: physicalRow })],
      );
      const done = await readMirrorRow(db, spreadsheetId, rowKey);
      if (!done || done.cleared) throw new Error("[db] idempotency completion failed");
      await db.query("commit");
      return { row: done.row, replayed: false };
    } catch (e) {
      await db.query("rollback").catch(() => {});
      throw e;
    }
  }
}
