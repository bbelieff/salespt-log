/**
 * mirror_pending 표식 헬퍼 (db-write-flip §2.2·§3·§7-3) 단위 회귀.
 * 고정하는 계약:
 *   ① DATABASE_URL 미설정 = 전면 no-op(쿼리 0, list=[], count=null) — 비파일럿 불변.
 *   ② mark/clear = row_key+spreadsheet_id+tab 3중 지정 UPDATE(시트 간 충돌 방지, #495 교훈).
 *   ③ clear 는 `and mirror_pending` 가드(이미 false 면 0 rows), list 는 오래된 것부터 limit.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbEnabled = vi.fn(() => true);
const ensureSchema = vi.fn(async () => {});
const query = vi.fn();
const getDbPool = vi.fn(() => ({ query }));

vi.mock("@/repo/db/client", () => ({
  dbEnabled: (...a: unknown[]) => dbEnabled(...(a as [])),
  ensureSchema: (...a: unknown[]) => ensureSchema(...(a as [])),
  getDbPool: (...a: unknown[]) => getDbPool(...(a as [])),
}));

import {
  clearMirrorPending,
  countMirrorPending,
  listMirrorPending,
  markMirrorPending,
} from "@/repo/db/mirror-pending";

const REF = { spreadsheetId: "sheet-1", tab: "todos" as const, rowKey: "t1" };

beforeEach(() => {
  dbEnabled.mockReset().mockReturnValue(true);
  ensureSchema.mockReset().mockResolvedValue(undefined);
  query.mockReset().mockResolvedValue({ rows: [] });
  getDbPool.mockReset().mockReturnValue({ query });
});

describe("DATABASE_URL 미설정 = 전면 no-op(비파일럿 불변)", () => {
  beforeEach(() => dbEnabled.mockReturnValue(false));

  it("mark/clear 는 쿼리도 스키마 보장도 안 함", async () => {
    await markMirrorPending(REF);
    await clearMirrorPending(REF);
    expect(query).not.toHaveBeenCalled();
    expect(ensureSchema).not.toHaveBeenCalled();
  });

  it("list=[], count=null", async () => {
    expect(await listMirrorPending("sheet-1", "todos")).toEqual([]);
    expect(await countMirrorPending()).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });
});

describe("mark/clear = 3중 키 UPDATE", () => {
  it("markMirrorPending → mirror_pending=true, 파라미터 [sid,tab,key]", async () => {
    await markMirrorPending(REF);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/update sheet_rows set mirror_pending = true/i);
    expect(sql).toMatch(/spreadsheet_id = \$1 and tab = \$2 and row_key = \$3/i);
    expect(params).toEqual(["sheet-1", "todos", "t1"]);
  });

  it("clearMirrorPending → mirror_pending=false + `and mirror_pending` 가드", async () => {
    await clearMirrorPending(REF);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/set mirror_pending = false/i);
    expect(sql).toMatch(/and mirror_pending/i); // 이미 false 면 0 rows
    expect(params).toEqual(["sheet-1", "todos", "t1"]);
  });
});

describe("list/count", () => {
  it("listMirrorPending → row_key 목록, 오래된 것부터 + limit", async () => {
    query.mockResolvedValue({ rows: [{ row_key: "a" }, { row_key: "b" }] });
    const out = await listMirrorPending("sheet-1", "sales", 10);
    expect(out).toEqual(["a", "b"]);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/where spreadsheet_id = \$1 and tab = \$2 and mirror_pending/i);
    expect(sql).toMatch(/order by updated_at asc/i);
    expect(params).toEqual(["sheet-1", "sales", 10]);
  });

  it("listMirrorPending limit 기본값 25", async () => {
    await listMirrorPending("sheet-1", "todos");
    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual(["sheet-1", "todos", 25]);
  });

  it("countMirrorPending → 전체 pending 수", async () => {
    query.mockResolvedValue({ rows: [{ n: 3 }] });
    expect(await countMirrorPending()).toBe(3);
    const [sql] = query.mock.calls[0] as [string];
    expect(sql).toMatch(/count\(\*\)::int.*where mirror_pending/is);
  });
});
