/**
 * claimAccount → writeCourseDatesToDb 배선 회귀 (BBE-57).
 * 고정하는 계약:
 *   ① fetchCachedLabels(readProfileBundle) 성공 후 writeCourseDatesToDb(email, resolved.cohort,
 *      courseStartISO, graduationISO) 를 호출한다.
 *   ② writeCourseDatesToDb 가 throw 해도 claimAccount 는 정상 완료(non-blocking 계약,
 *      Sheets registry 가 여전히 정본 폴백이라 클레임 자체를 막으면 안 됨).
 *   ③ 트레이너 클레임(시트 없음)은 writeCourseDatesToDb 를 아예 호출하지 않는다(spreadsheetId 없음).
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

const COURSE_START = new Date(2026, 5, 1);
const GRADUATION = new Date(2026, 6, 21);

beforeEach(() => {
  findUserByEmail.mockReset();
  findSheetByCohortName.mockReset().mockResolvedValue("sheet-123");
  findExistingSheetIdByCohortName.mockReset().mockResolvedValue(null);
  claimRegistry.mockReset().mockResolvedValue(undefined);
  isNumericCohortArchived.mockReset().mockReturnValue(false);
  getArchivedCohortSet.mockReset().mockResolvedValue(new Set<string>());
  writeProfile.mockReset().mockResolvedValue(undefined);
  readProfileBundle.mockReset().mockResolvedValue({
    cohort: "8",
    name: "홍길동",
    courseStart: COURSE_START,
    graduation: GRADUATION,
  });
  findArenaRowBySheetId.mockReset().mockResolvedValue(null);
  migrateArenaCarryover.mockReset().mockResolvedValue(undefined);
  writeCourseDatesToDb.mockReset().mockResolvedValue({ skipped: false, updated: true });

  // findUserByEmail: 1차 호출(existing 체크)=null, 2차 호출(persisted 재조회)=active 행.
  findUserByEmail.mockImplementation(async () => null);
});

describe("claimAccount → writeCourseDatesToDb 배선", () => {
  it("신규 수강생 클레임 성공 → writeCourseDatesToDb(email, cohort, courseStartISO, graduationISO) 호출", async () => {
    findUserByEmail
      .mockResolvedValueOnce(null) // existing 체크
      .mockResolvedValueOnce({ // persisted 재조회
        email: "trainee@x.com", cohort: "8", name: "홍길동",
        spreadsheetId: "sheet-123", role: "trainee", status: "active",
      });

    await claimAccount("trainee@x.com", "8", "홍길동");

    expect(writeCourseDatesToDb).toHaveBeenCalledTimes(1);
    const [email, cohort, startISO, gradISO] = writeCourseDatesToDb.mock.calls[0] as string[];
    expect(email).toBe("trainee@x.com");
    expect(cohort).toBe("8");
    expect(startISO).toBe("2026-06-01");
    expect(gradISO).toBe("2026-07-21");
  });

  it("writeCourseDatesToDb 가 throw 해도 claimAccount 는 정상 완료(non-blocking)", async () => {
    findUserByEmail
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        email: "trainee@x.com", cohort: "8", name: "홍길동",
        spreadsheetId: "sheet-123", role: "trainee", status: "active",
      });
    writeCourseDatesToDb.mockRejectedValue(new Error("DB 연결 실패"));

    const result = await claimAccount("trainee@x.com", "8", "홍길동");
    expect(result.status).toBe("active");
    expect(claimRegistry).toHaveBeenCalledTimes(1); // 레지스트리(Sheets 정본)는 이미 완료된 뒤라 영향 없음
  });

  it("트레이너 클레임(cohort=T) → 시트 없어 writeCourseDatesToDb 호출 안 함", async () => {
    findUserByEmail.mockResolvedValueOnce(null);
    await claimAccount("trainer@x.com", "T", "김강사");
    expect(writeCourseDatesToDb).not.toHaveBeenCalled();
  });
});
