/**
 * BBE-59(R7-#10 Phase 1) — lib/repo/db/row-key.ts 단위 테스트.
 *  ① mintRowKey — `{섹션}:{uuid}` 형식, 매 호출 다른 값(멱등 아님 — 새 논리행마다 새 키)
 *  ② findCurrentRowKey — dbEnabled=false 면 즉시 null(쿼리 0회, 순환참조 없는 독립 조회 확인)
 *  ③ findCurrentRowKey — 쿼리 결과 row_key 그대로 반환
 *  ④ findCurrentRowKey — 결과 없음 → null
 *  ⑤ resolveWriteKey — 조회 성공 시 그 키, 실패/null/throw 시 레거시 `{섹션}:r{row}` 폴백
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

import { findCurrentRowKey, mintRowKey, resolveWriteKey } from "@/repo/db/row-key";

beforeEach(() => {
  dbEnabled.mockReset().mockReturnValue(true);
  ensureSchema.mockReset().mockResolvedValue(undefined);
  query.mockReset().mockResolvedValue({ rows: [] });
});

describe("mintRowKey", () => {
  it("① `{섹션}:{uuid}` 형식, 호출마다 다른 값", () => {
    const a = mintRowKey("매입DB");
    const b = mintRowKey("매입DB");
    expect(a).toMatch(/^매입DB:[0-9a-f-]{36}$/);
    expect(a).not.toBe(b);
  });
});

describe("findCurrentRowKey", () => {
  it("② DB 미설정 — 쿼리 없이 즉시 null", async () => {
    dbEnabled.mockReturnValue(false);
    const r = await findCurrentRowKey("sheet-1", "매입DB", 9);
    expect(r).toBeNull();
    expect(query).not.toHaveBeenCalled();
    expect(ensureSchema).not.toHaveBeenCalled();
  });

  it("③ 매치된 row_key 반환(레거시·신규 무관 — 쿼리가 판정)", async () => {
    query.mockResolvedValue({ rows: [{ row_key: "매입DB:abc-uuid" }] });
    const r = await findCurrentRowKey("sheet-1", "매입DB", 9);
    expect(r).toBe("매입DB:abc-uuid");
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("from sheet_rows"),
      ["sheet-1", "매입DB:r9", "매입DB:%", 9],
    );
  });

  it("④ 매치 없음 — null", async () => {
    query.mockResolvedValue({ rows: [] });
    const r = await findCurrentRowKey("sheet-1", "매입DB", 9);
    expect(r).toBeNull();
  });
});

describe("resolveWriteKey", () => {
  it("⑤-a 조회 성공 — 그 키 그대로", async () => {
    query.mockResolvedValue({ rows: [{ row_key: "매입DB:abc-uuid" }] });
    const key = await resolveWriteKey("sheet-1", "매입DB", 9);
    expect(key).toBe("매입DB:abc-uuid");
  });

  it("⑤-b 조회 결과 없음 — 레거시 `{섹션}:r{row}` 폴백", async () => {
    query.mockResolvedValue({ rows: [] });
    const key = await resolveWriteKey("sheet-1", "매입DB", 9);
    expect(key).toBe("매입DB:r9");
  });

  it("⑤-c DB 미설정 — 레거시 폴백(동작 불변)", async () => {
    dbEnabled.mockReturnValue(false);
    const key = await resolveWriteKey("sheet-1", "직접생산", 5);
    expect(key).toBe("직접생산:r5");
  });

  it("⑤-d 조회 중 예외 — throw 없이 레거시 폴백", async () => {
    query.mockRejectedValue(new Error("connection reset"));
    const key = await resolveWriteKey("sheet-1", "현수막", 7);
    expect(key).toBe("현수막:r7");
  });
});
