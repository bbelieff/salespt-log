/**
 * ADR-0038 3단계 전 결정 — 명단 DB 읽기가 실패해 시트 명단으로 넘어갔는데 그 이메일이 없으면
 * (= 시트 명단에 없는 시트 없는 수강생) DB 를 잠깐 기다렸다 다시 읽는다. 시트에 있는 사람은 재시도 0.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const readUserRowsFromDb = vi.fn(async (): Promise<string[][] | null> => null);
const registryDbReadEnabled = vi.fn(() => true);
const readRange = vi.fn(async (): Promise<string[][]> => []);

vi.mock("@/repo/db/registry-read", () => ({
  readUserRowsFromDb: (...a: unknown[]) => readUserRowsFromDb(...(a as [])),
  registryDbReadEnabled: () => registryDbReadEnabled(),
}));
vi.mock("@/repo/sheets-client", () => ({ readRange: (...a: unknown[]) => readRange(...(a as [])), appendRows: vi.fn(), sheetsClient: vi.fn() }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: vi.fn() }));
vi.mock("@/config", () => ({ registry: () => ({ spreadsheetId: "reg-sheet", tab: "users" }), adminEmails: () => [], adminNames: () => ({}) }));
vi.mock("@/repo/db/trainer-recruitment", () => ({ listTrainerQualifications: async () => [] }));

import { findUserByEmail } from "@/repo/users";

const SHEET_ROWS = [["a@example.test", "7", "합성A", "1SyntheticSheet", "trainee", "active"]];
const LOCAL = "local:11111111-1111-4111-8111-111111111111";
const DB_ROWS = [...SHEET_ROWS, ["b@example.test", "0", "합성B", LOCAL, "trainee", "active"]];

beforeEach(() => {
  readUserRowsFromDb.mockReset().mockResolvedValue(null);
  registryDbReadEnabled.mockReset().mockReturnValue(true);
  readRange.mockReset().mockResolvedValue(SHEET_ROWS);
});

describe("명단 DB 실패 시 시트 없는 수강생 로그인", () => {
  it("시트 명단에 없으면 DB 를 다시 읽어 찾는다", async () => {
    readUserRowsFromDb.mockResolvedValueOnce(null).mockResolvedValueOnce(DB_ROWS);
    const u = await findUserByEmail("b@example.test", { fresh: true });
    expect(u?.spreadsheetId).toBe(LOCAL);
    expect(readUserRowsFromDb).toHaveBeenCalledTimes(2);
  });

  it("시트 명단에 있는 수강생은 재시도하지 않는다(기존 동작 그대로)", async () => {
    const u = await findUserByEmail("a@example.test", { fresh: true });
    expect(u?.cohort).toBe("7");
    expect(readUserRowsFromDb).toHaveBeenCalledTimes(1);
  });

  it("DB 가 계속 실패하면 두 번 더 시도하고 없음으로 끝낸다", async () => {
    const u = await findUserByEmail("b@example.test", { fresh: true });
    expect(u).toBeNull();
    expect(readUserRowsFromDb).toHaveBeenCalledTimes(3);
  });

  it("명단 DB 읽기 스위치가 꺼져 있으면 재시도하지 않는다", async () => {
    registryDbReadEnabled.mockReturnValue(false);
    expect(await findUserByEmail("b@example.test", { fresh: true })).toBeNull();
    expect(readUserRowsFromDb).toHaveBeenCalledTimes(1);
  });

  it("DB 가 처음부터 정상이면 없는 이메일도 재시도 없이 바로 없음", async () => {
    readUserRowsFromDb.mockResolvedValue(DB_ROWS);
    expect(await findUserByEmail("nobody@example.test", { fresh: true })).toBeNull();
    expect(readUserRowsFromDb).toHaveBeenCalledTimes(1);
  });
});
