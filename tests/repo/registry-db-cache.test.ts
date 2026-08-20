/**
 * DB 읽기 경로의 캐시 회귀 (BBE-247).
 *
 * `registry-read-fallback.test.ts` 는 `unstable_cache` 를 pass-through 로 목킹해
 * "DB 가 값을 주면 시트를 안 읽는다"만 고정한다 — 캐시 자체가 걸리는지는 검증하지 않는다.
 * 여기선 `unstable_cache` 를 실제 메모이즈로 목킹해 "연속 요청 시 DB 쿼리 1회"(카드 완주 기준)
 * 를 users·cohorts 양쪽에서 고정한다. 수정 전에는 이 테스트가 실패한다(매 호출 DB 쿼리 발생).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// 라이브 unstable_cache 의 캐시 히트를 모사 — key(첫 배열 인자)별로 결과를 영구 메모이즈.
// revalidateTag 는 태그가 걸린 모든 키를 지운다(라이브의 태그 기반 무효화를 단순화해 재현).
// __clearAllForTests 는 이 목 전용(라이브 next/cache 에는 없음) — 테스트 간 store 격리용.
vi.mock("next/cache", () => {
  const store = new Map<string, unknown>();
  const tagsByKey = new Map<string, string[]>();
  return {
    unstable_cache:
      (fn: (...a: unknown[]) => Promise<unknown>, keyParts: string[], opts?: { tags?: string[] }) =>
      async (...a: unknown[]) => {
        const key = keyParts.join("|");
        if (!store.has(key)) {
          store.set(key, await fn(...a));
          tagsByKey.set(key, opts?.tags ?? []);
        }
        return store.get(key);
      },
    revalidateTag: (tag: string) => {
      for (const [key, tags] of tagsByKey) {
        if (tags.includes(tag)) store.delete(key);
      }
    },
    __clearAllForTests: () => {
      store.clear();
      tagsByKey.clear();
    },
  };
});

const readUserRowsFromDb = vi.fn(async (): Promise<string[][] | null> => null);
const readCohortRowsFromDb = vi.fn(async (): Promise<string[][] | null> => null);
const readRange = vi.fn(async (): Promise<string[][]> => []);

vi.mock("@/repo/db/registry-read", () => ({
  readUserRowsFromDb: (...a: unknown[]) => readUserRowsFromDb(...(a as [])),
  readCohortRowsFromDb: (...a: unknown[]) => readCohortRowsFromDb(...(a as [])),
}));
vi.mock("@/repo/sheets-client", () => ({
  readRange: (...a: unknown[]) => readRange(...(a as [])),
  appendRows: vi.fn(),
  sheetsClient: vi.fn(),
}));
vi.mock("@/config", () => ({
  registry: () => ({ spreadsheetId: "reg-sheet", tab: "users" }),
  cohortsTab: () => "cohorts",
  adminEmails: () => [],
  adminNames: () => ({}),
}));
vi.mock("@/repo/registry-row", () => ({ nextRegistryRowNumber: vi.fn() }));
vi.mock("@/repo/db/registry-mirror", () => ({
  cohortRowFromSheetRow: vi.fn(),
  mirrorCohortCells: vi.fn(),
  mirrorCohortRow: vi.fn(),
}));

import { cachedRegistryRows, invalidateRegistry } from "@/repo/users-rows";
import { listCohorts } from "@/repo/cohorts";
import * as nextCacheMock from "next/cache";

const DB_USER_ROW = ["db@b.com", "A2-8기", "김디비", "sid2", "trainee", "active"];
const DB_COHORT_ROW = ["A2", "active", "", "arena", "", "", "", "", "", "2026-08-07"];

beforeEach(() => {
  readUserRowsFromDb.mockReset().mockResolvedValue([DB_USER_ROW]);
  readCohortRowsFromDb.mockReset().mockResolvedValue([DB_COHORT_ROW]);
  readRange.mockReset().mockResolvedValue([]);
  (nextCacheMock as unknown as { __clearAllForTests: () => void }).__clearAllForTests();
});

describe("users-rows.ts — DB 경로도 60초 캐시(BBE-247)", () => {
  it("연속 호출 시 DB 쿼리는 1회만 나간다", async () => {
    const a = await cachedRegistryRows();
    const b = await cachedRegistryRows();
    const c = await cachedRegistryRows();
    expect(a).toEqual(b);
    expect(b).toEqual(c);
    expect(readUserRowsFromDb).toHaveBeenCalledTimes(1);
  });

  it("fresh:true 는 여전히 캐시를 우회한다(claim 직후 경로 보존)", async () => {
    await cachedRegistryRows();
    await cachedRegistryRows({ fresh: true });
    expect(readUserRowsFromDb).toHaveBeenCalledTimes(2);
  });

  it("invalidateRegistry() 가 DB 캐시도 함께 지운다(같은 태그)", async () => {
    await cachedRegistryRows();
    invalidateRegistry();
    await cachedRegistryRows();
    expect(readUserRowsFromDb).toHaveBeenCalledTimes(2);
  });
});

describe("cohorts.ts — DB 경로도 60초 캐시(BBE-247, 동형 결함)", () => {
  it("연속 호출 시 DB 쿼리는 1회만 나간다", async () => {
    await listCohorts();
    await listCohorts();
    expect(readCohortRowsFromDb).toHaveBeenCalledTimes(1);
  });
});
