/**
 * Scope E2 — DB-tab append server idempotency against REAL SQL (PGlite) for
 * the reservation/mirror side + an in-memory sheet stub for the external side.
 *
 * Proves: lost-ACK retry reuses the claimed physical row (one sheet row, one
 * mirror), crash between sheet write and commit converges, same-key/different
 * payload ⇒ 409 without extra writes, distinct keys ⇒ two rows, cross-scope
 * independence, and replay-before-overlap for direct-production.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import {
  appendDbRowIdempotent,
  dbAppendFingerprint,
  lookupDbAppend,
  type SheetAppendOps,
} from "@/repo/db/db-append-idempotency";
import type { IdemPool } from "@/repo/db/expense-idempotency";

const SHEET = "sheet-owner";
const OTHER_SHEET = "sheet-other";
const SECTION = "매입DB";
const FIRST_ROW = 4;

let pg: PGlite;
let pool: IdemPool;

// In-memory sheet: row → written marker. findEmptyRow mimics
// findFirstEmptyRow (first never-written row); writeAt overwrites in place.
let sheet: Map<number, number>;
let writes: number[];

function resetSheet() {
  sheet = new Map();
  writes = [];
}

function opsFor(overrides: Partial<SheetAppendOps> = {}): SheetAppendOps {
  return {
    findEmptyRow: async () => {
      let row = FIRST_ROW;
      while (sheet.has(row)) row += 1;
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

async function mirrorCount(sheetId: string): Promise<number> {
  const r = await pg.query(
    "select count(*)::int as n from sheet_rows where spreadsheet_id=$1 and tab='db'",
    [sheetId],
  );
  return Number((r.rows[0] as { n: number }).n);
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
  resetSheet();
});

describe("db append idempotency — real SQL + stubbed sheet", () => {
  it("commit + lost ACK + retry ⇒ same row, one sheet row, one mirror", async () => {
    const key = randomUUID();
    const first = await appendDbRowIdempotent({
      spreadsheetId: SHEET, section: SECTION, key, business: { ...business }, ops: opsFor(),
      deps: { pool, skipEnsure: true },
    });
    expect(first.replayed).toBe(false);
    // ACK lost → retry with the same key + payload.
    const retry = await appendDbRowIdempotent({
      spreadsheetId: SHEET, section: SECTION, key, business: { ...business }, ops: opsFor(),
      deps: { pool, skipEnsure: true },
    });
    expect(retry).toEqual({ row: first.row, replayed: true });
    expect(sheet.size).toBe(1);
    expect(await mirrorCount(SHEET)).toBe(1);
  });

  it("crash after sheet write before commit ⇒ retry rewrites the SAME row", async () => {
    const key = randomUUID();
    let attempt = 0;
    const crashingOps = opsFor({
      writeAt: async (row: number) => {
        attempt += 1;
        writes.push(row);
        sheet.set(row, (sheet.get(row) ?? 0) + 1);
        if (attempt === 1) throw new Error("crash before commit");
      },
    });
    await expect(
      appendDbRowIdempotent({
        spreadsheetId: SHEET, section: SECTION, key, business: { ...business }, ops: crashingOps,
        deps: { pool, skipEnsure: true },
      }),
    ).rejects.toThrow("crash before commit");
    const retry = await appendDbRowIdempotent({
      spreadsheetId: SHEET, section: SECTION, key, business: { ...business }, ops: crashingOps,
      deps: { pool, skipEnsure: true },
    });
    expect(retry.replayed).toBe(false); // first completion, via the claimed row
    expect(sheet.size).toBe(1); // no duplicate physical row
    expect(writes).toEqual([retry.row, retry.row]); // same row rewritten
    expect(await mirrorCount(SHEET)).toBe(1);
  });

  it("concurrent same-key appends ⇒ one row (overlap window shares the claim)", async () => {
    const key = randomUUID();
    const [a, b] = await Promise.all([
      appendDbRowIdempotent({
        spreadsheetId: SHEET, section: SECTION, key, business: { ...business }, ops: opsFor(),
        deps: { pool, skipEnsure: true },
      }),
      appendDbRowIdempotent({
        spreadsheetId: SHEET, section: SECTION, key, business: { ...business }, ops: opsFor(),
        deps: { pool, skipEnsure: true },
      }),
    ]);
    expect(a.row).toBe(b.row);
    expect(sheet.size).toBe(1);
    expect(await mirrorCount(SHEET)).toBe(1);
  });

  it("same key + different payload ⇒ 409 with the original row, no extra write", async () => {
    const key = randomUUID();
    const first = await appendDbRowIdempotent({
      spreadsheetId: SHEET, section: SECTION, key, business: { ...business }, ops: opsFor(),
      deps: { pool, skipEnsure: true },
    });
    const before = writes.length;
    const err = await appendDbRowIdempotent({
      spreadsheetId: SHEET, section: SECTION, key,
      business: { ...business, 주문개수: 9 }, ops: opsFor(),
      deps: { pool, skipEnsure: true },
    }).catch((e) => e);
    expect((err as Error).message).toBe("db_idempotency_conflict");
    expect((err as { row?: unknown }).row).toBe(first.row);
    expect(writes.length).toBe(before);
    expect(sheet.size).toBe(1);
  });

  it("pending + different payload ⇒ 409 with NO row (nothing committed yet)", async () => {
    const key = randomUUID();
    // Leave a pending reservation: crash before the sheet write.
    const failingOps = opsFor({
      findEmptyRow: async () => { throw new Error("sheet read down"); },
    });
    await expect(
      appendDbRowIdempotent({
        spreadsheetId: SHEET, section: SECTION, key, business: { ...business }, ops: failingOps,
        deps: { pool, skipEnsure: true },
      }),
    ).rejects.toThrow("sheet read down");
    const err = await appendDbRowIdempotent({
      spreadsheetId: SHEET, section: SECTION, key,
      business: { ...business, 주문개수: 9 }, ops: opsFor(),
      deps: { pool, skipEnsure: true },
    }).catch((e) => e);
    expect((err as Error).message).toBe("db_idempotency_conflict");
    expect((err as { row?: unknown }).row).toBeUndefined();
    expect(sheet.size).toBe(0);
    expect(await mirrorCount(SHEET)).toBe(0);
  });

  it("different keys + identical values ⇒ two legit rows", async () => {
    const a = await appendDbRowIdempotent({
      spreadsheetId: SHEET, section: SECTION, key: randomUUID(), business: { ...business }, ops: opsFor(),
      deps: { pool, skipEnsure: true },
    });
    const b = await appendDbRowIdempotent({
      spreadsheetId: SHEET, section: SECTION, key: randomUUID(), business: { ...business }, ops: opsFor(),
      deps: { pool, skipEnsure: true },
    });
    expect(a.row).not.toBe(b.row);
    expect(sheet.size).toBe(2);
    expect(await mirrorCount(SHEET)).toBe(2);
  });

  it("cross-scope same key ⇒ independent rows (owner scoping, no denial of service)", async () => {
    // Each spreadsheet owns its sheet — model with per-scope stubs.
    const otherSheet = new Map<number, number>();
    const otherOps: SheetAppendOps = {
      findEmptyRow: async () => {
        let row = FIRST_ROW;
        while (otherSheet.has(row)) row += 1;
        return row;
      },
      writeAt: async (row: number) => { otherSheet.set(row, 1); },
    };
    const key = randomUUID();
    const a = await appendDbRowIdempotent({
      spreadsheetId: SHEET, section: SECTION, key, business: { ...business }, ops: opsFor(),
      deps: { pool, skipEnsure: true },
    });
    const b = await appendDbRowIdempotent({
      spreadsheetId: OTHER_SHEET, section: SECTION, key, business: { ...business }, ops: otherOps,
      deps: { pool, skipEnsure: true },
    });
    expect(await mirrorCount(SHEET)).toBe(1);
    expect(await mirrorCount(OTHER_SHEET)).toBe(1);
    expect(a.row).toBe(FIRST_ROW);
    expect(b.row).toBe(FIRST_ROW); // same key, separate namespaces, no conflict
    expect(otherSheet.size).toBe(1);
  });

  it("replay runs BEFORE the overlap guard; pending retries exclude the claimed row", async () => {
    const key = randomUUID();
    const seenExclusions: (number | null)[] = [];
    const guard = async (excludeRow: number) => { seenExclusions.push(excludeRow); };
    const first = await appendDbRowIdempotent({
      spreadsheetId: SHEET, section: "직접생산", key,
      business: { 시작일: "2026-09-01", 종료일: "2026-09-05", 소재: "X" },
      ops: opsFor({ checkOverlap: guard }),
      deps: { pool, skipEnsure: true },
    });
    // Lost-ACK retry with a guard that rejects everything: replay must win.
    const replay = await appendDbRowIdempotent({
      spreadsheetId: SHEET, section: "직접생산", key,
      business: { 시작일: "2026-09-01", 종료일: "2026-09-05", 소재: "X" },
      ops: opsFor({
        checkOverlap: async () => { throw new Error("overlap: own prior row"); },
      }),
      deps: { pool, skipEnsure: true },
    });
    expect(replay).toEqual({ row: first.row, replayed: true });
    // Pending retry (crash before commit) passes the claimed row as exclusion.
    const key2 = randomUUID();
    let attempt = 0;
    const crashOps = opsFor({
      checkOverlap: guard,
      writeAt: async (row: number) => {
        attempt += 1;
        writes.push(row);
        sheet.set(row, (sheet.get(row) ?? 0) + 1);
        if (attempt === 1) throw new Error("crash before commit");
      },
    });
    await expect(
      appendDbRowIdempotent({
        spreadsheetId: SHEET, section: "직접생산", key: key2,
        business: { 시작일: "2026-10-01", 종료일: "2026-10-05", 소재: "Y" },
        ops: crashOps, deps: { pool, skipEnsure: true },
      }),
    ).rejects.toThrow("crash before commit");
    seenExclusions.length = 0;
    await appendDbRowIdempotent({
      spreadsheetId: SHEET, section: "직접생산", key: key2,
      business: { 시작일: "2026-10-01", 종료일: "2026-10-05", 소재: "Y" },
      ops: crashOps, deps: { pool, skipEnsure: true },
    });
    expect(seenExclusions.length).toBeGreaterThan(0);
    for (const ex of seenExclusions) expect(typeof ex).toBe("number");
  });

  it("lookupDbAppend pre-check mirrors the orchestration verdict", async () => {
    const key = randomUUID();
    const fp = dbAppendFingerprint(SECTION, business);
    expect(await lookupDbAppend(SHEET, SECTION, key, fp, { pool, skipEnsure: true })).toEqual({ status: "miss" });
    const done = await appendDbRowIdempotent({
      spreadsheetId: SHEET, section: SECTION, key, business: { ...business }, ops: opsFor(),
      deps: { pool, skipEnsure: true },
    });
    expect(await lookupDbAppend(SHEET, SECTION, key, fp, { pool, skipEnsure: true })).toEqual({
      status: "complete", row: done.row,
    });
    await expect(
      lookupDbAppend(SHEET, SECTION, key, dbAppendFingerprint(SECTION, { ...business, 주문개수: 7 }), { pool, skipEnsure: true }),
    ).rejects.toThrow("db_idempotency_conflict");
  });
});
