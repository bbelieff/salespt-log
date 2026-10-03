/**
 * updateDriveLink 게이트 회귀 — DB ON 원자 UPDATE 후 무효화, OFF 구동작.
 * Sheets·DB 실호출 없음. 모두 mock 관찰.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidateTag: vi.fn(),
}));

const gate = vi.hoisted(() => ({ enabled: vi.fn() }));
const driveDb = vi.hoisted(() => ({ updateInDb: vi.fn() }));
const rowsMod = vi.hoisted(() => ({ cached: vi.fn(), invalidate: vi.fn() }));
const sheets = vi.hoisted(() => ({ readRange: vi.fn(), update: vi.fn() }));
const quals = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock("@/repo/db/registry-read", () => ({
  registryDbReadEnabled: gate.enabled,
}));
vi.mock("@/repo/users-drive-db", () => ({
  updateDriveLinkInDb: driveDb.updateInDb,
}));
vi.mock("@/repo/users-rows", () => ({
  cachedRegistryRows: rowsMod.cached,
  invalidateRegistry: rowsMod.invalidate,
}));
vi.mock("@/repo/sheets-client", () => ({
  readRange: sheets.readRange,
  sheetsClient: () => ({ spreadsheets: { values: { update: sheets.update } } }),
}));
vi.mock("@/repo/db/trainer-recruitment", () => ({
  listTrainerQualifications: quals.list,
}));
vi.mock("@/repo/db/registry-mirror", () => ({
  mirrorUserCells: vi.fn(),
  mirrorUserRekey: vi.fn(),
  mirrorUserRow: vi.fn(),
  registryRowFromUser: (u: unknown) => u,
}));

import { updateDriveLink } from "@/repo/users";

const EMAIL = "trainee@example.com";

// parseRow 가 받는 A~T 20열. trainee/active 로 고정.
function sheetRows(email = EMAIL) {
  return [[
    email, "8기", "김수강", "sheet-registered-001", "trainee", "active",
    "", "", "", "", "", "", "0", "", "", "", "", "", "", "",
  ]];
}

describe("updateDriveLink 게이트", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    quals.list.mockResolvedValue([]);
    rowsMod.cached.mockResolvedValue(sheetRows());
    rowsMod.invalidate.mockReturnValue(undefined);
    sheets.readRange.mockResolvedValue(sheetRows());
    sheets.update.mockResolvedValue({});
    driveDb.updateInDb.mockResolvedValue(undefined);
  });

  it("DB ON 성공 — DB await 후 무효화, 시트 쓰기 없음", async () => {
    gate.enabled.mockReturnValue(true);
    await updateDriveLink(EMAIL, {
      driveParentPath: "parent-proven-001",
      feedbackFolderId: "feedback-found-001",
      driveLinkStatus: "ok",
    });
    expect(driveDb.updateInDb).toHaveBeenCalledTimes(1);
    expect(driveDb.updateInDb).toHaveBeenCalledWith(
      { email: EMAIL, cohort: "8기", name: "김수강" },
      {
        driveParentPath: "parent-proven-001",
        feedbackFolderId: "feedback-found-001",
        driveLinkStatus: "ok",
      },
    );
    // 같은 preferred user 로 해결 — fresh 조회.
    expect(rowsMod.cached).toHaveBeenCalledWith({ fresh: true });
    expect(rowsMod.invalidate).toHaveBeenCalledTimes(1);
    expect(sheets.update).not.toHaveBeenCalled();
  });

  it("DB 실패 — throw 하고 캐시 무효화·시트 폴백 없음", async () => {
    gate.enabled.mockReturnValue(true);
    driveDb.updateInDb.mockRejectedValueOnce(new Error("db down"));
    await expect(
      updateDriveLink(EMAIL, { driveLinkStatus: "ok" }),
    ).rejects.toThrow("db down");
    expect(rowsMod.invalidate).not.toHaveBeenCalled();
    expect(sheets.update).not.toHaveBeenCalled();
  });

  it("게이트 OFF — 구 시트 셀 순차, DB 호출 없음", async () => {
    gate.enabled.mockReturnValue(false);
    await updateDriveLink(EMAIL, {
      driveParentPath: "parent-proven-001",
      feedbackFolderId: "feedback-found-001",
      driveLinkStatus: "ok",
    });
    expect(driveDb.updateInDb).not.toHaveBeenCalled();
    expect(sheets.update).toHaveBeenCalledTimes(3);
    expect(rowsMod.invalidate).toHaveBeenCalled();
  });
});
