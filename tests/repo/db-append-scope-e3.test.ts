/**
 * Scope E3 — different-keys scope coordination + no-rewrite/no-resurrect,
 * against REAL SQL (PGlite) for the reservation/mirror side + an
 * exclusion-aware in-memory sheet stub for the external side.
 *
 * Honest harness note: PGlite here is ONE shared connection, so these tests
 * prove the DURABLE exclusion (claims committed before any external write;
 * every allocation skips all reserved rows incl. abandoned crash-before-write
 * ones) plus the coordinated rechecks — they do NOT prove multi-connection
 * mutual exclusion, which only real Postgres advisory-lock serialization
 * provides (stated, never mislabelled).
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import {
  appendDbRowIdempotent,
  DB_ENTRY_NOT_FOUND,
  lookupDbAppend,
  dbAppendFingerprint,
  type SheetAppendOps,
} from "@/repo/db/db-append-idempotency";
import type { IdemPool } from "@/repo/db/expense-idempotency";

const SHEET = "sheet-owner";
const SECTION = "매입DB";
const FIRST_ROW = 4;

let pg: PGlite;
let pool: IdemPool;

let sheet: Map<number, number>;
let writes: number[];

function opsFor(overrides: Partial<SheetAppendOps> = {}): SheetAppendOps {
  return {
    // Mirrors the real findFirstEmptyRowExcluding: first row that is neither
    // written on the sheet nor durably reserved.
    findEmptyRow: async (excluded) => {
      let row = FIRST_ROW;
      while (sheet.has(row) || excluded?.has(row)) row += 1;
      return row;
    },
    writeAt: async (row: number) => {
      writes.push(row);
      sheet.set(row, (sheet.get(row) ?? 0) + 1);
    },
    ...overrides,
  };
}

const business = { 구매일: "2026-09-01", 업체명: "가나상사", 개당단가: 1000, 주문개수: 3 };

async function mirrorPayload(sheetId: string, key: string) {
  const r = await pg.query(
    "select payload from sheet_rows where spreadsheet_id=$1 and tab='db' and row_key=$2",
    [sheetId, `${SECTION}:${key}`],
  );
  return (r.rows[0] as { payload?: Record<string, unknown> } | undefined)?.payload;
}

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
  writes = [];
});

describe("E3 scope coordination — real SQL + exclusion-aware sheet", () => {
  it("different keys racing the same empty row get distinct rows (no overwrite)", async () => {
    // Sequential on this single-connection harness, but the second
    // allocation MUST skip the first key's durable reservation even though
    // the stub (like the real scan) would otherwise return the same row.
    const a = await appendDbRowIdempotent({
      spreadsheetId: SHEET, section: SECTION, key: randomUUID(), business: { ...business }, ops: opsFor(),
      deps: { pool, skipEnsure: true },
    });
    const b = await appendDbRowIdempotent({
      spreadsheetId: SHEET, section: SECTION, key: randomUUID(), business: { ...business }, ops: opsFor(),
      deps: { pool, skipEnsure: true },
    });
    expect(a.row).toBe(FIRST_ROW);
    expect(b.row).not.toBe(a.row);
    expect(sheet.size).toBe(2);
  });

  it("failure after claim before write, then a different-key create skips the abandoned row", async () => {
    const keyA = randomUUID();
    let attempt = 0;
    const crashingOps = opsFor({
      writeAt: async (row: number) => {
        attempt += 1;
        if (attempt === 1) {
          // Claim for row 4 is already durably committed; the sheet write dies.
          throw new Error("crash before write");
        }
        writes.push(row);
        sheet.set(row, (sheet.get(row) ?? 0) + 1);
      },
    });
    await expect(
      appendDbRowIdempotent({
        spreadsheetId: SHEET, section: SECTION, key: keyA, business: { ...business }, ops: crashingOps,
        deps: { pool, skipEnsure: true },
      }),
    ).rejects.toThrow("crash before write");
    expect(sheet.size).toBe(0); // sheet still empty — row 4 lives only as a reservation

    const b = await appendDbRowIdempotent({
      spreadsheetId: SHEET, section: SECTION, key: randomUUID(), business: { ...business }, ops: opsFor(),
      deps: { pool, skipEnsure: true },
    });
    expect(b.row).not.toBe(FIRST_ROW); // abandoned claim skipped, not stolen

    const retryA = await appendDbRowIdempotent({
      spreadsheetId: SHEET, section: SECTION, key: keyA, business: { ...business }, ops: crashingOps,
      deps: { pool, skipEnsure: true },
    });
    expect(retryA.row).toBe(FIRST_ROW); // original key reuses its own claim
    expect(sheet.size).toBe(2);
  });

  it("same-key replay after PATCH does not rewrite the PATCHed row", async () => {
    const key = randomUUID();
    const first = await appendDbRowIdempotent({
      spreadsheetId: SHEET, section: SECTION, key, business: { ...business }, ops: opsFor(),
      deps: { pool, skipEnsure: true },
    });
    expect(writes).toEqual([first.row]);
    // Legitimate later edit (update path merges, preserving _idem_hash).
    await pg.query(
      `update sheet_rows set payload = payload || '{"업체명":"PATCHED"}'::jsonb
       where spreadsheet_id=$1 and tab='db' and row_key=$2`,
      [SHEET, `${SECTION}:${key}`],
    );
    const replay = await appendDbRowIdempotent({
      spreadsheetId: SHEET, section: SECTION, key, business: { ...business }, ops: opsFor(),
      deps: { pool, skipEnsure: true },
    });
    expect(replay).toEqual({ row: first.row, replayed: true });
    expect(writes).toEqual([first.row]); // no external rewrite
    expect((await mirrorPayload(SHEET, key))?.업체명).toBe("PATCHED"); // newest preserved
  });

  it("retry after delete does not resurrect (throws, no write, stays cleared)", async () => {
    const key = randomUUID();
    const first = await appendDbRowIdempotent({
      spreadsheetId: SHEET, section: SECTION, key, business: { ...business }, ops: opsFor(),
      deps: { pool, skipEnsure: true },
    });
    // Delete path: sheet cleared + mirror marked (hash preserved).
    sheet.delete(first.row);
    await pg.query(
      `update sheet_rows set payload = payload || '{"_cleared":true}'::jsonb
       where spreadsheet_id=$1 and tab='db' and row_key=$2`,
      [SHEET, `${SECTION}:${key}`],
    );
    const before = writes.length;
    const err = await appendDbRowIdempotent({
      spreadsheetId: SHEET, section: SECTION, key, business: { ...business }, ops: opsFor(),
      deps: { pool, skipEnsure: true },
    }).catch((e) => e);
    expect((err as Error).message).toBe(DB_ENTRY_NOT_FOUND);
    expect(writes.length).toBe(before); // no external write
    expect(sheet.has(first.row)).toBe(false); // still gone
    expect((await mirrorPayload(SHEET, key))?._cleared).toBe(true); // still cleared
    await expect(
      lookupDbAppend(SHEET, SECTION, key, dbAppendFingerprint(SECTION, business), { pool, skipEnsure: true }),
    ).rejects.toThrow(DB_ENTRY_NOT_FOUND);
  });

  it("overlapping different-key appends converge to distinct rows", async () => {
    // Honest scope: on this single-connection harness the in-process scope
    // mutex serializes the two allocations (same real code path); true
    // multi-connection racing additionally relies on the advisory half,
    // which only real Postgres can prove.
    const [a, b] = await Promise.all([
      appendDbRowIdempotent({
        spreadsheetId: SHEET, section: SECTION, key: randomUUID(), business: { ...business }, ops: opsFor(),
        deps: { pool, skipEnsure: true },
      }),
      appendDbRowIdempotent({
        spreadsheetId: SHEET, section: SECTION, key: randomUUID(), business: { ...business }, ops: opsFor(),
        deps: { pool, skipEnsure: true },
      }),
    ]);
    expect(a.row).not.toBe(b.row);
    expect(sheet.size).toBe(2);
  });
});
