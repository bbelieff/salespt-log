/**
 * 읽기 초크포인트(`cachedRegistryRows`)의 **시트 폴백** 회귀 (BBE-56).
 *
 * registry-read-gate.test.ts 가 "DB 계층이 null 을 준다"를 고정한다면, 이 파일은
 * **호출부가 그 null 을 받아 실제로 시트를 읽는지**를 고정한다 — 로그인 경로가 걸려 있어
 * 여기가 뚫리면 전 사용자가 못 들어온다.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const readUserRowsFromDb = vi.fn(async (): Promise<string[][] | null> => null);
const readRange = vi.fn(async (): Promise<string[][]> => []);

vi.mock("@/repo/db/registry-read", () => ({
  readUserRowsFromDb: (...a: unknown[]) => readUserRowsFromDb(...(a as [])),
}));
vi.mock("@/repo/sheets-client", () => ({
  readRange: (...a: unknown[]) => readRange(...(a as [])),
  appendRows: vi.fn(),
  sheetsClient: vi.fn(),
}));
// unstable_cache 는 테스트에서 그냥 통과시킨다(캐시 래핑 여부가 이 테스트의 관심사가 아님).
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidateTag: vi.fn(),
}));
vi.mock("@/config", () => ({
  registry: () => ({ spreadsheetId: "reg-sheet", tab: "users" }),
  adminEmails: () => [],
  adminNames: () => ({}),
}));

import { cachedRegistryRows, findUserByEmail } from "@/repo/users";

const SHEET_ROWS = [
  ["a@b.com", "A2-7기", "홍길동", "sid", "trainee", "active"],
];

beforeEach(() => {
  readUserRowsFromDb.mockReset().mockResolvedValue(null);
  readRange.mockReset().mockResolvedValue(SHEET_ROWS);
});

describe("DB 가 null 을 주면 시트를 읽는다", () => {
  it("게이트 OFF(=null) → 시트 read 발생", async () => {
    const rows = await cachedRegistryRows();
    expect(rows).toEqual(SHEET_ROWS);
    expect(readRange).toHaveBeenCalled();
  });

  it("DB 0행/오류(=null)여도 로그인 조회가 정상 동작한다", async () => {
    const u = await findUserByEmail("a@b.com");
    expect(u?.email).toBe("a@b.com");
    expect(u?.cohort).toBe("A2-7기");
    expect(readRange).toHaveBeenCalled();
  });
});

describe("DB 가 행을 주면 시트를 읽지 않는다", () => {
  beforeEach(() => {
    readUserRowsFromDb.mockResolvedValue([
      ["db@b.com", "A2-8기", "김디비", "sid2", "trainee", "active"],
    ]);
  });

  it("DB 행이 그대로 쓰이고 시트 왕복이 사라진다", async () => {
    const rows = await cachedRegistryRows();
    expect(rows[0]![0]).toBe("db@b.com");
    expect(readRange).not.toHaveBeenCalled();
  });

  it("DB 행도 parseRow 를 그대로 통과한다(모양 호환)", async () => {
    const u = await findUserByEmail("db@b.com");
    expect(u?.name).toBe("김디비");
    expect(u?.cohort).toBe("A2-8기");
    expect(readRange).not.toHaveBeenCalled();
  });
});
