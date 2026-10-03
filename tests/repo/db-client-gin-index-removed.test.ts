/**
 * sheet_rows.payload GIN 인덱스 제거 회귀 (BBE-250, BBE-242 처방 d).
 *
 * 인덱스는 마이그레이션(0004)뿐 아니라 client.ts 의 doEnsureSchema()(지연생성,
 * IF NOT EXISTS)에도 있었다 — 마이그레이션만 지우고 이 줄을 남기면 다음 ensureSchema()
 * 호출(모든 쓰기 경로가 호출)이 즉시 재생성해 마이그레이션이 무의미해진다. 이 테스트는
 * doEnsureSchema() 가 실제로 발행하는 SQL 을 캡처해 GIN 인덱스 문이 더 이상 없는지,
 * 나머지 스키마(테이블·다른 인덱스·mirror_pending)는 그대로인지 고정한다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queries: string[] = [];
const queryMock = vi.fn(async (sql: string) => {
  queries.push(sql);
  return { rows: [] };
});

vi.mock("pg", () => ({
  Pool: vi.fn().mockImplementation(() => ({ query: queryMock })),
}));

const ORIGINAL_URL = process.env.DATABASE_URL;

beforeEach(() => {
  vi.resetModules();
  queries.length = 0;
  queryMock.mockClear();
  process.env.DATABASE_URL = "postgres://test/db";
});

afterEach(() => {
  if (ORIGINAL_URL === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = ORIGINAL_URL;
});

describe("doEnsureSchema — GIN 인덱스 제거 확정 + 나머지 스키마 보존", () => {
  it("sheet_rows_payload GIN 인덱스 문이 더 이상 발행되지 않는다", async () => {
    const { ensureSchema } = await import("@/repo/db/client");
    await ensureSchema();
    const combined = queries.join("\n");
    expect(combined).not.toMatch(/using gin/i);
    expect(combined).not.toContain("sheet_rows_payload");
  });

  it("나머지 스키마(테이블·cohort_tab 인덱스·mirror_pending·pending 부분인덱스)는 그대로다", async () => {
    const { ensureSchema } = await import("@/repo/db/client");
    await ensureSchema();
    const combined = queries.join("\n");
    expect(combined).toContain("create table if not exists sheet_rows");
    expect(combined).toContain("unique (spreadsheet_id, tab, row_key)");
    expect(combined).toContain("sheet_rows_cohort_tab");
    expect(combined).toContain("mirror_pending boolean not null default false");
    expect(combined).toContain("sheet_rows_pending");
  });

  it("정확히 4개 DDL 문만 발행한다(GIN 제거로 5→4)", async () => {
    const { ensureSchema } = await import("@/repo/db/client");
    await ensureSchema();
    expect(queryMock).toHaveBeenCalledTimes(4);
  });

  it("ensureSchema() 는 멱등 캐시 — 두 번 호출해도 쿼리는 1세트만 나간다", async () => {
    const { ensureSchema } = await import("@/repo/db/client");
    await ensureSchema();
    await ensureSchema();
    expect(queryMock).toHaveBeenCalledTimes(4);
  });
});

describe("대표 쓰기 경로 — GIN 제거 후에도 정상 동작(카드 완주 기준)", () => {
  it("upsertSheetRow — INSERT ... ON CONFLICT 로 sheet_rows 에 upsert된다", async () => {
    const { upsertSheetRow } = await import("@/repo/db/client");
    const result = await upsertSheetRow({
      cohort: "8",
      email: "a@b.com",
      spreadsheetId: "sid",
      tab: "meetings",
      rowKey: "row-1",
      payload: { 업체명: "테스트업체" },
    });
    expect(result.skipped).toBe(false);
    const upsertCall = queries.find((q) => q.includes("insert into sheet_rows"));
    expect(upsertCall).toBeDefined();
    expect(upsertCall).toContain("on conflict (spreadsheet_id, tab, row_key)");
  });

  it("writeRowToDb / clearRowInDb — 단일행 쓰기·클리어 정상 동작", async () => {
    const { writeRowToDb, clearRowInDb } = await import("@/repo/db/client");
    await writeRowToDb({
      spreadsheetId: "sid",
      cohort: "8",
      email: "a@b.com",
      tab: "todos",
      rowKey: "row-2",
      payload: { title: "할일" },
    });
    await clearRowInDb({
      spreadsheetId: "sid",
      cohort: "8",
      email: "a@b.com",
      tab: "todos",
      rowKey: "row-2",
    });
    const writes = queries.filter((q) => q.includes("insert into sheet_rows"));
    expect(writes.length).toBe(2);
  });
});
