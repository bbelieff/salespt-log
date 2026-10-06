/**
 * 관리자 본인 시험 계정(0기 GM, 2026-10-06) — 트레이너 행이 있는 관리자도 사전등록 수강생 행을 클레임.
 * 일반 사용자·트레이너 코드(T) 클레임은 기존대로 기존 행을 돌려준다. 합성 데이터. (초안: Muse)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const findUserByEmail = vi.fn();
const findSheetByCohortName = vi.fn();
const findExistingSheetIdByCohortName = vi.fn();
const claimRegistry = vi.fn(async () => {});
const isNumericCohortArchived = vi.fn(() => false);
const getArchivedCohortSet = vi.fn(async () => new Set<string>());
const writeProfile = vi.fn(async () => {});
const readProfileBundle = vi.fn();
const findArenaRowBySheetId = vi.fn(async () => null);
const migrateArenaCarryover = vi.fn(async () => {});
const writeCourseDatesToDb = vi.fn(async () => ({ skipped: false, updated: true }));

vi.mock("@/repo/users", () => ({
  findSheetByCohortName: (...a: unknown[]) => findSheetByCohortName(...(a as [])),
  findExistingSheetIdByCohortName: (...a: unknown[]) => findExistingSheetIdByCohortName(...(a as [])),
  claimRegistry: (...a: unknown[]) => claimRegistry(...(a as [])),
  findUserByEmail: (...a: unknown[]) => findUserByEmail(...(a as [])),
  isNumericCohortArchived: (...a: unknown[]) => isNumericCohortArchived(...(a as [])),
}));
vi.mock("@/repo/cohorts", () => ({
  getArchivedCohortSet: (...a: unknown[]) => getArchivedCohortSet(...(a as [])),
}));
vi.mock("@/repo/sales", () => ({
  writeProfile: (...a: unknown[]) => writeProfile(...(a as [])),
  readProfileBundle: (...a: unknown[]) => readProfileBundle(...(a as [])),
}));
vi.mock("@/service/arena-carryover", () => ({
  migrateArenaCarryover: (...a: unknown[]) => migrateArenaCarryover(...(a as [])),
}));
vi.mock("@/repo/users-claim", () => ({
  findArenaRowBySheetId: (...a: unknown[]) => findArenaRowBySheetId(...(a as [])),
}));
vi.mock("@/repo/db/course-dates", () => ({
  writeCourseDatesToDb: (...a: unknown[]) => writeCourseDatesToDb(...(a as [])),
}));

import { claimAccount } from "@/service/auth";

const COURSE_START = new Date(2026, 9, 2);
const GRADUATION = new Date(2026, 10, 21);

beforeEach(() => {
  findUserByEmail.mockReset();
  findSheetByCohortName.mockReset().mockResolvedValue("sheet-123");
  findExistingSheetIdByCohortName.mockReset().mockResolvedValue(null);
  claimRegistry.mockReset().mockResolvedValue(undefined);
  isNumericCohortArchived.mockReset().mockReturnValue(false);
  getArchivedCohortSet.mockReset().mockResolvedValue(new Set<string>());
  writeProfile.mockReset().mockResolvedValue(undefined);
  readProfileBundle.mockReset().mockResolvedValue({
    cohort: "0",
    name: "GM",
    courseStart: COURSE_START,
    graduation: GRADUATION,
  });
  findArenaRowBySheetId.mockReset().mockResolvedValue(null);
  migrateArenaCarryover.mockReset().mockResolvedValue(undefined);
  writeCourseDatesToDb.mockReset().mockResolvedValue({ skipped: false, updated: true });
});

describe("claimAccount admin trainee claim", () => {
  it("① 관리자 + 기존 트레이너 행 + cohort 0 → 일반 흐름 진행", async () => {
    const email = "admin@example.com";
    const trainerRow = {
      email,
      cohort: "T",
      name: "관리자",
      spreadsheetId: "",
      role: "trainer",
      status: "active",
    };
    const persistedRow = {
      email,
      cohort: "0",
      name: "GM",
      spreadsheetId: "sheet-123",
      role: "trainee",
      status: "active",
    };
    findUserByEmail.mockReset();
    findUserByEmail.mockResolvedValueOnce(trainerRow);
    findUserByEmail.mockResolvedValue(persistedRow);

    await claimAccount(email, "0", "GM", { isAdmin: true });

    expect(claimRegistry).toHaveBeenCalled();
  });

  it("② 일반 사용자 + 기존 트레이너 행 + cohort 0 → 기존 행 반환", async () => {
    const email = "user@example.com";
    const trainerRow = {
      email,
      cohort: "T",
      name: "관리자",
      spreadsheetId: "",
      role: "trainer",
      status: "active",
    };
    findUserByEmail.mockReset().mockResolvedValue(trainerRow);

    const result = await claimAccount(email, "0", "홍길동", { isAdmin: false });

    expect(claimRegistry).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      email,
      cohort: "T",
      role: "trainer",
      status: "active",
    });
  });

  it("③ 관리자 + 기존 트레이너 행 + cohort T → 기존 행 반환", async () => {
    const email = "admin@example.com";
    const trainerRow = {
      email,
      cohort: "T",
      name: "관리자",
      spreadsheetId: "",
      role: "trainer",
      status: "active",
    };
    findUserByEmail.mockReset().mockResolvedValue(trainerRow);

    const result = await claimAccount(email, "T", "관리자", { isAdmin: true });

    expect(claimRegistry).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      email,
      cohort: "T",
      role: "trainer",
      status: "active",
    });
  });
});
