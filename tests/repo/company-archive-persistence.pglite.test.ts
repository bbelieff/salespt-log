/**
 * PR #1089 업체정보 자동저장 경로의 실제 DB 어댑터 왕복 증거.
 *
 * 일회성 PGlite만 사용한다. DATABASE_URL은 어댑터 게이트를 여는 더미 문자열이고,
 * pg.Pool의 전송만 인프로세스 PostgreSQL로 연결하므로 네트워크·운영 DB·Sheets를
 * 전혀 사용하지 않는다.
 */
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { CompanyInfo } from "@/types";

const fixture = vi.hoisted(() => ({ db: null as PGlite | null }));

vi.mock("pg", () => ({
  Pool: class {
    async query(text: string, params?: unknown[]) {
      if (!fixture.db) throw new Error("isolated datastore is not ready");
      const result = await fixture.db.query(text, (params ?? []) as never[]);
      return {
        rows: result.rows,
        rowCount: result.affectedRows ?? result.rows.length,
      };
    }
  },
}));

vi.mock("@/repo/users", () => ({
  findOwnerBySpreadsheetId: async () => ({
    cohort: "fixture",
    email: "owner@example.test",
  }),
}));

const ORIGINAL_URL = process.env.DATABASE_URL;
const SHEET_ID = "synthetic-company-info-sheet";
const ROW_KEY = "2026-09-29|합성업체";

let persistCompanyArchiveRow: typeof import("@/repo/db/company-archive-sync").persistCompanyArchiveRow;
let readCompanyArchiveRowPayload: typeof import("@/repo/db/company-archive-sync").readCompanyArchiveRowPayload;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

async function rowCount(): Promise<number> {
  const result = await fixture.db!.query(
    "select count(*)::int as n from sheet_rows where spreadsheet_id=$1 and tab='company_archive' and row_key=$2",
    [SHEET_ID, ROW_KEY],
  );
  return Number((result.rows[0] as { n: number }).n);
}

beforeAll(async () => {
  fixture.db = new PGlite();
  process.env.DATABASE_URL = "postgres://isolated.invalid/unused";
  vi.resetModules();
  ({ persistCompanyArchiveRow, readCompanyArchiveRowPayload } =
    await import("@/repo/db/company-archive-sync"));
}, 60_000);

afterAll(async () => {
  await fixture.db?.close();
  fixture.db = null;
  if (ORIGINAL_URL === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = ORIGINAL_URL;
});

describe("company_archive persistence adapter — isolated real SQL roundtrip", () => {
  it("updates one nonfinancial synthetic memo and restores the exact original payload", async () => {
    const originalInfo = CompanyInfo.parse({
      업체기타메모: "격리 테스트 원본 메모",
    });
    await persistCompanyArchiveRow(
      SHEET_ID,
      ROW_KEY,
      {
        업체명: "합성업체",
        계약일: "2026-09-29",
        ...originalInfo,
      },
      { syncDb: true },
    );

    expect(await rowCount()).toBe(1);
    const original = await readCompanyArchiveRowPayload(SHEET_ID, ROW_KEY);
    expect(original).not.toBeNull();
    const originalHash = sha256(original);

    await persistCompanyArchiveRow(
      SHEET_ID,
      ROW_KEY,
      { 업체기타메모: "격리 테스트 자동저장 편집 메모" },
      { syncDb: true },
    );
    const edited = await readCompanyArchiveRowPayload(SHEET_ID, ROW_KEY);
    expect(edited?.업체기타메모).toBe("격리 테스트 자동저장 편집 메모");
    expect(sha256(edited)).not.toBe(originalHash);
    expect(await rowCount()).toBe(1);

    await persistCompanyArchiveRow(SHEET_ID, ROW_KEY, original!, { syncDb: true });
    const restored = await readCompanyArchiveRowPayload(SHEET_ID, ROW_KEY);
    expect(restored).toEqual(original);
    expect(sha256(restored)).toBe(originalHash);
    expect(await rowCount()).toBe(1);
  });
});
