/**
 * migrateRegistryCache() → writeCourseDatesToDb 백필 배선 회귀 (BBE-57).
 * 고정하는 계약:
 *   ① email 있는 row 만 writeCourseDatesToDb 호출(prep row=빈 email 은 스킵).
 *   ② DB 쓰기 실패해도 Sheets I~L 캐시 갱신(MigrateResult)은 그대로 성공 —
 *      DB 실패가 이 함수의 failed[] 계약을 오염시키지 않는다.
 *   ③ sheetId 없는 row(트레이너/admin) → DB 호출도 안 함(기존 skip 로직과 대칭).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const readRange = vi.fn();
const readProfileBundle = vi.fn();
const invalidateRegistry = vi.fn();
const writeCourseDatesToDb = vi.fn(async () => ({ skipped: false, updated: true }));
const valuesBatchUpdate = vi.fn(async () => ({}));

vi.mock("@/config", () => ({
  registry: () => ({ spreadsheetId: "registry-sheet", tab: "users" }),
}));
vi.mock("@/repo/sheets-client", () => ({
  readRange: (...a: unknown[]) => readRange(...(a as [])),
  sheetsClient: () => ({
    spreadsheets: { values: { batchUpdate: valuesBatchUpdate } },
  }),
}));
vi.mock("@/repo/sales", () => ({
  readProfileBundle: (...a: unknown[]) => readProfileBundle(...(a as [])),
}));
vi.mock("@/repo/users", () => ({
  invalidateRegistry: (...a: unknown[]) => invalidateRegistry(...(a as [])),
}));
vi.mock("@/repo/db/course-dates", () => ({
  writeCourseDatesToDb: (...a: unknown[]) => writeCourseDatesToDb(...(a as [])),
}));

import { migrateRegistryCache } from "@/repo/users-cache-migrate";

const COURSE_START = new Date(2026, 5, 1);
const GRADUATION = new Date(2026, 6, 21);

beforeEach(() => {
  readRange.mockReset();
  readProfileBundle.mockReset().mockResolvedValue({
    cohort: "8", name: "홍길동", courseStart: COURSE_START, graduation: GRADUATION,
  });
  invalidateRegistry.mockReset();
  writeCourseDatesToDb.mockReset().mockResolvedValue({ skipped: false, updated: true });
  valuesBatchUpdate.mockReset().mockResolvedValue({});
});

describe("migrateRegistryCache — DB 백필 배선", () => {
  it("email 있는 row → writeCourseDatesToDb(email, cohort, courseStartISO, graduationISO) 호출", async () => {
    readRange.mockResolvedValue([
      ["trainee@x.com", "8", "홍길동", "sheet-1"],
    ]);
    const result = await migrateRegistryCache();
    expect(result.updated).toBe(1);
    expect(writeCourseDatesToDb).toHaveBeenCalledTimes(1);
    expect(writeCourseDatesToDb).toHaveBeenCalledWith("trainee@x.com", "8", "2026-06-01", "2026-07-21");
  });

  it("prep row(email 빈값) → writeCourseDatesToDb 호출 안 함(Sheets 캐시는 갱신)", async () => {
    readRange.mockResolvedValue([
      ["", "8", "홍길동", "sheet-1"],
    ]);
    const result = await migrateRegistryCache();
    expect(result.updated).toBe(1); // Sheets I~L 은 그대로 갱신
    expect(writeCourseDatesToDb).not.toHaveBeenCalled();
  });

  it("sheetId 없는 row(트레이너/admin) → 시트 read 도 DB 쓰기도 안 함(기존 skip 유지)", async () => {
    readRange.mockResolvedValue([
      ["trainer@x.com", "T", "김강사", ""],
    ]);
    const result = await migrateRegistryCache();
    expect(result.skipped).toBe(1);
    expect(readProfileBundle).not.toHaveBeenCalled();
    expect(writeCourseDatesToDb).not.toHaveBeenCalled();
  });

  it("writeCourseDatesToDb 가 throw 해도 MigrateResult 는 정상(failed[] 오염 안 됨)", async () => {
    readRange.mockResolvedValue([
      ["trainee@x.com", "8", "홍길동", "sheet-1"],
    ]);
    writeCourseDatesToDb.mockRejectedValue(new Error("DB 연결 실패"));
    const result = await migrateRegistryCache();
    expect(result.updated).toBe(1);
    expect(result.failed).toEqual([]);
  });

  it("같은 spreadsheetId 공유하는 멀티 계정 row 둘 다 각자 email 로 DB 쓰기 호출", async () => {
    readRange.mockResolvedValue([
      ["a@x.com", "8", "김철수", "shared-sheet"],
      ["b@x.com", "8", "김영희", "shared-sheet"],
    ]);
    const result = await migrateRegistryCache();
    expect(result.updated).toBe(2);
    expect(readProfileBundle).toHaveBeenCalledTimes(1); // 시트 read 는 캐시로 1회
    expect(writeCourseDatesToDb).toHaveBeenCalledTimes(2);
    expect(writeCourseDatesToDb).toHaveBeenNthCalledWith(1, "a@x.com", "8", "2026-06-01", "2026-07-21");
    expect(writeCourseDatesToDb).toHaveBeenNthCalledWith(2, "b@x.com", "8", "2026-06-01", "2026-07-21");
  });
});
