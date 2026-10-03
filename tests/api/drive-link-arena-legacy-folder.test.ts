/**
 * 아레나 참가자 구제 경로 — 업체관리 폴더가 없으면 수강생 시절 `01 피드백업체` 로.
 *
 * 배경(2026-09-01 belie 신고 "8기 김현민 드라이브 연결 안 됨"):
 * ops 배치(`arena-season2-batch.mjs`)로 편입된 A2 7·8기 참가자는 16C 하위에
 * 업체관리 폴더가 없다(Drive 전수 확인 0개). 폴더를 뒤늦게 만들어도 업체 폴더의
 * 주인이 수강생 본인이라 운영자가 옮길 수 없어(`The caller does not have permission`),
 * **원래 자리를 그대로 가리키는** 것이 유일한 해법이다.
 *
 * 여기서 지키는 것:
 *   ① 16C 에 폴더가 있으면 그쪽이 우선 — 기존 A1 참가자 동작 불변
 *   ② 없으면 본인 시트 부모의 `01…` 폴더로 연결
 *   ③ ★공유드라이브 전체 검색 금지 — 남의 업체 폴더가 붙으면 안 된다
 *   ④ manual 은 **id 일치**일 때만 허용 — 남의 폴더 URL 은 여전히 거부
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getWritableUserEmail: vi.fn(),
  findUserByEmail: vi.fn(),
  updateDriveLink: vi.fn(),
  findFolderByNamePrefix: vi.fn(),
  findFolderByNameInDrive: vi.fn(),
  getDriveFileMeta: vi.fn(),
  listCohorts: vi.fn(),
}));

vi.mock("@/auth/identity", () => ({
  getWritableUserEmail: api.getWritableUserEmail,
}));
vi.mock("@/repo/users", () => ({
  findUserByEmail: api.findUserByEmail,
  updateDriveLink: api.updateDriveLink,
}));
vi.mock("@/repo/drive-client", () => ({
  findFolderByNamePrefix: api.findFolderByNamePrefix,
  findFolderByNameInDrive: api.findFolderByNameInDrive,
  getDriveFileMeta: api.getDriveFileMeta,
}));
vi.mock("@/repo/cohorts", () => ({ listCohorts: api.listCohorts }));
vi.mock("@/lib/analytics/api-timing", () => ({
  withApiTiming: (_label: string, handler: unknown) => handler,
}));

import { POST } from "@/app/api/drive-link/route";

const SHEET_ID = "sheet-a2-8-kim";
const OWN_PARENT = "parent-of-own-sheet";
const LEGACY_FOLDER = "legacy-01-feedback";
const SEASON_PARENT = "16C-company-parent";

/** A2-8 참가자 — ops 배치로 편입돼 업체관리 폴더가 없는 사람. */
function arenaUser(overrides: Record<string, unknown> = {}) {
  return {
    email: "trainee@example.com",
    cohort: "A2-8기",
    name: "김현민",
    spreadsheetId: SHEET_ID,
    role: "trainee",
    status: "active",
    feedbackFolderId: "",
    driveParentPath: "",
    driveLinkStatus: "",
    ...overrides,
  };
}

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/drive-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/drive-link — 아레나 업체관리 폴더 부재 구제", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getWritableUserEmail.mockResolvedValue("trainee@example.com");
    api.findUserByEmail.mockResolvedValue(arenaUser());
    api.updateDriveLink.mockResolvedValue(undefined);
    api.listCohorts.mockResolvedValue([
      { label: "A2", companyParentFolderId: SEASON_PARENT },
    ]);
    // 본인 시트는 자기 폴더 안에 있다.
    api.getDriveFileMeta.mockImplementation(async (id: string) =>
      id === SHEET_ID
        ? { ok: true, name: "세일즈PT_A2_8기 김현민_대표님 경영일지", parentId: OWN_PARENT }
        : { ok: false, code: 404 },
    );
    // 16C 하위에는 업체관리 폴더가 없다(= 실제 A2 상태). 본인 폴더엔 01 폴더가 있다.
    api.findFolderByNamePrefix.mockImplementation(
      async (_prefix: string, parentId: string) =>
        parentId === OWN_PARENT ? LEGACY_FOLDER : null,
    );
    api.findFolderByNameInDrive.mockResolvedValue(null);
  });

  it("auto — 16C 에 업체관리 폴더가 없으면 수강생 시절 01 폴더로 연결된다", async () => {
    const res = await POST(request({ mode: "auto" }));
    const body = await res.json();

    expect(body.errorKind).toBeUndefined();
    expect(api.updateDriveLink).toHaveBeenCalledWith(
      "trainee@example.com",
      expect.objectContaining({ feedbackFolderId: LEGACY_FOLDER }),
    );
  });

  it("★auto — 공유드라이브 전체 검색은 쓰지 않는다 (남의 업체 폴더 오연결 방지)", async () => {
    await POST(request({ mode: "auto" }));
    expect(api.findFolderByNameInDrive).not.toHaveBeenCalled();
  });

  it("auto — 16C 에 본인 업체관리 폴더가 있으면 그쪽이 우선이다 (A1 참가자 동작 불변)", async () => {
    const ARENA_FOLDER = "arena-company-folder";
    api.findFolderByNamePrefix.mockImplementation(
      async (_prefix: string, parentId: string) =>
        parentId === SEASON_PARENT ? ARENA_FOLDER : LEGACY_FOLDER,
    );

    await POST(request({ mode: "auto" }));

    expect(api.updateDriveLink).toHaveBeenCalledWith(
      "trainee@example.com",
      expect.objectContaining({ feedbackFolderId: ARENA_FOLDER }),
    );
  });

  it("auto — 01 폴더도 없으면 기존 안내(arena_folder_missing)가 그대로 뜬다", async () => {
    api.findFolderByNamePrefix.mockResolvedValue(null);

    const body = await (await POST(request({ mode: "auto" }))).json();

    expect(body.errorKind).toBe("arena_folder_missing");
  });

  it("auto — 시트가 없는 참가자는 조용히 기존 안내로 떨어진다 (예외 아님)", async () => {
    api.findUserByEmail.mockResolvedValue(arenaUser({ spreadsheetId: "" }));
    api.findFolderByNamePrefix.mockResolvedValue(null);

    const body = await (await POST(request({ mode: "auto" }))).json();

    expect(body.errorKind).toBe("arena_folder_missing");
  });

  it("manual — 본인 01 폴더 주소를 붙여넣으면 연결된다", async () => {
    api.getDriveFileMeta.mockImplementation(async (id: string) =>
      id === SHEET_ID
        ? { ok: true, name: "세일즈PT_A2_8기 김현민_대표님 경영일지", parentId: OWN_PARENT }
        : { ok: true, name: "01 피드백업체", parentId: OWN_PARENT },
    );
    api.findFolderByNamePrefix.mockImplementation(
      async (_prefix: string, parentId: string) =>
        parentId === OWN_PARENT ? LEGACY_FOLDER : null,
    );

    const body = await (
      await POST(
        request({
          mode: "manual",
          parentFolderUrl: `https://drive.google.com/drive/folders/${LEGACY_FOLDER}`,
        }),
      )
    ).json();

    expect(body.errorKind).toBeUndefined();
    expect(api.updateDriveLink).toHaveBeenCalledWith(
      "trainee@example.com",
      expect.objectContaining({ feedbackFolderId: LEGACY_FOLDER }),
    );
  });

  it("★manual — 남의 01 폴더 주소는 여전히 거부한다 (id 불일치)", async () => {
    const SOMEONE_ELSE = "someone-elses-01-folder";
    api.getDriveFileMeta.mockImplementation(async (id: string) =>
      id === SHEET_ID
        ? { ok: true, name: "세일즈PT_A2_8기 김현민_대표님 경영일지", parentId: OWN_PARENT }
        : { ok: true, name: "01 피드백업체", parentId: "someone-elses-parent" },
    );
    api.findFolderByNamePrefix.mockImplementation(
      async (_prefix: string, parentId: string) =>
        parentId === OWN_PARENT ? LEGACY_FOLDER : null,
    );

    const body = await (
      await POST(
        request({
          mode: "manual",
          parentFolderUrl: `https://drive.google.com/drive/folders/${SOMEONE_ELSE}`,
        }),
      )
    ).json();

    expect(body.errorKind).toBe("arena_folder_mismatch");
  });
});
