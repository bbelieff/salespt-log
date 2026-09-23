/**
 * Scope E4 — SAME-key held coordination against REAL SQL (PGlite) for the
 * reservation/mirror side + an in-memory sheet stub for the external side.
 *
 * The narrow E4 defect: the pre-write gate released the scope lock BEFORE
 * ops.checkOverlap + ops.writeAt + Phase-3 completion, so two SAME-key
 * workers could both pass the gate and the delayed write overwrote the row
 * after the sibling completed (and after a later PATCH/delete). The fix
 * holds scope coordination from the final completed-recheck THROUGH the
 * external write AND the durable completion (short tx on the same locked
 * connection only around the final DB part).
 *
 * Honest harness note: PGlite here is ONE shared connection, so this test
 * proves the held mutex + durable completion (the sibling blocks, then sees
 * the completion and NEVER calls writeAt) — not multi-connection
 * advisory-lock racing, which only real Postgres proves. The parent-copied
 * tests/repo/autosave-concurrency.test.ts covers the real-Postgres
 * advisory-wait half on CI (TRAINER_CONCURRENCY_PG=1); it skips locally
 * where server binaries are absent.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import {
  appendDbRowIdempotent,
  type SheetAppendOps,
} from "@/repo/db/db-append-idempotency";
import type { IdemPool } from "@/repo/db/expense-idempotency";

const SHEET = "sheet-owner";
const SECTION = "매입DB";
const FIRST_ROW = 4;

let pg: PGlite;
let pool: IdemPool;

let sheet: Map<number, number>;

function scanRow(excluded?: Set<number>): number {
  let row = FIRST_ROW;
  while (sheet.has(row) || excluded?.has(row)) row += 1;
  return row;
}

const business = { 구매일: "2026-09-01", 업체명: "가나상사", 개당단가: 1000, 주문개수: 3 };

beforeAll(async () => {
  pg = new PGlite();
  await pg.query(`create table sheet_rows (
    id bigserial primary key, cohort text not null, email text,
    spreadsheet_id text not null, tab text not null, row_key text not null,
    payload jsonb not null, updated_at timestamptz not null default now(),
    unique (spreadsheet_id, tab, row_key))`);
  pool = {
    query: async (text: string, params?: unknown[]) => {
      const r = (await pg.query(text, (params ?? []) as never[])) as unknown as {
        rows: Record<string, unknown>[];
        rowCount?: number | null;
        affectedRows?: number | null;
      };
      return { rows: r.rows, rowCount: r.rowCount ?? r.affectedRows ?? null };
    },
  };
}, 60000);

beforeEach(async () => {
  await pg.query("delete from sheet_rows");
  sheet = new Map();
});

describe("E4 same-key held coordination — real SQL + held sheet stub", () => {
  it("held first write blocks the sibling; sibling never writes, one external write total", async () => {
    const key = randomUUID();
    let release!: () => void;
    const hold = new Promise<void>((r) => { release = r; });
    let enteredResolve!: () => void;
    const entered = new Promise<void>((r) => { enteredResolve = r; });
    let enteredCount = 0;
    const writesA: number[] = [];
    const writesB: number[] = [];

    const opsA: SheetAppendOps = {
      findEmptyRow: async (excluded) => scanRow(excluded),
      writeAt: async (row: number) => {
        enteredCount += 1;
        enteredResolve();
        await hold; // hold the scope coordination inside the external write
        writesA.push(row);
        sheet.set(row, (sheet.get(row) ?? 0) + 1);
      },
    };
    const opsB: SheetAppendOps = {
      findEmptyRow: async (excluded) => scanRow(excluded),
      writeAt: async (row: number) => {
        writesB.push(row);
        sheet.set(row, (sheet.get(row) ?? 0) + 1);
      },
    };

    const a = appendDbRowIdempotent({
      spreadsheetId: SHEET, section: SECTION, key, business: { ...business }, ops: opsA,
      deps: { pool, skipEnsure: true },
    });
    await entered; // first worker is now inside the held external write
    expect(enteredCount).toBe(1);

    const b = appendDbRowIdempotent({
      spreadsheetId: SHEET, section: SECTION, key, business: { ...business }, ops: opsB,
      deps: { pool, skipEnsure: true },
    });
    // Let the sibling progress to the scope wait (Phase 1 + allocation, then
    // blocked on the held final section). It must not write while held.
    await new Promise((r) => setTimeout(r, 300));
    expect(writesA.length).toBe(0);
    expect(writesB.length).toBe(0); // sibling never calls writeAt while held

    release();
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra.row).toBe(rb.row);
    expect(writesA.length).toBe(1); // exactly one external write total
    expect(writesB.length).toBe(0); // waiting sibling saw completion, never wrote
    expect(sheet.size).toBe(1);
  }, 15000);
});
