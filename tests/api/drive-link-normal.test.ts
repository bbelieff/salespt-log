/**
 * POST /api/drive-link — 일반 기수 auto/manual 회귀.
 * 발견 helper 를 mock 해 라우트 보존·게이트만 검증한다.
 * 가짜 id 만 사용. DB·시트 쓰기는 updateDriveLink mock 으로 관찰만 한다.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getWritableUserEmail: vi.fn(),
  findUserByEmail: vi.fn(),
  updateDriveLink: vi.fn(),
  listCohorts: vi.fn(),
  driveGetMeta: vi.fn(),
  drivePrefix: vi.fn(),
  discover: vi.fn(),
  verifySaved: vi.fn(),
}));

vi.mock("@/auth/identity", () => ({
  getWritableUserEmail: api.getWritableUserEmail,
}));
vi.mock("@/repo/users", () => ({
  findUserByEmail: api.findUserByEmail,
  updateDriveLink: api.updateDriveLink,
}));
vi.mock("@/repo/cohorts", () => ({ listCohorts: api.listCohorts }));
vi.mock("@/repo/users-arena", () => ({
  isArenaCohort: (c: string) => /^A\d+-\d+$/.test(String(c).replace(/기\s*$/, "").trim()),
  normalizeArenaCohort: (c: string) => String(c).replace(/기\s*$/, "").trim(),
}));
vi.mock("@/repo/drive-client", () => ({
  findFolderByNamePrefix: api.drivePrefix,
  getDriveFileMeta: api.driveGetMeta,
}));
vi.mock("@/repo/drive-feedback-discovery", () => ({
  discoverFeedbackFolder: api.discover,
  verifySavedFeedbackFolder: api.verifySaved,
}));
vi.mock("@/service/cohort-token", () => ({
  buildArenaCompanyFolderName: (...a: unknown[]) => String(a.join("-")),
}));
vi.mock("@/repo/name-match", () => ({
  nameMatchCandidates: (s: string) => [String(s).trim()].filter(Boolean),
}));
vi.mock("@/lib/analytics/api-timing", () => ({
  withApiTiming: (_label: string, handler: unknown) => handler,
}));

import { POST } from "@/app/api/drive-link/route";

const EMAIL = "trainee@example.com";
const SHEET = "sheet-registered-001";
const SAVED = "feedback-saved-001";
const FOUND = "feedback-found-001";
const PARENT = "parent-proven-001";
const OTHER = "feedback-other-999";

function normalUser(overrides: Record<string, unknown> = {}) {
  return {
    email: EMAIL,
    cohort: "8기",
    name: "김수강",
    spreadsheetId: SHEET,
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

/** updateDriveLink 가 기존값을 지웠는가(빈 folder 로의 clear). */
function cleared(): boolean {
  return (api.updateDriveLink.mock.calls as unknown[][]).some((call) => {
    const data = call[1] as Record<string, string>;
    return data.feedbackFolderId === "";
  });
}

describe("POST /api/drive-link — 일반 기수", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getWritableUserEmail.mockResolvedValue(EMAIL);
    api.findUserByEmail.mockResolvedValue(normalUser());
    api.updateDriveLink.mockResolvedValue(undefined);
    api.verifySaved.mockResolvedValue({ ok: false, reason: "folder_missing" });
    api.discover.mockResolvedValue({
      ok: true,
      feedbackFolderId: FOUND,
      parentId: PARENT,
      parentSource: "sa",
    });
  });

  it.each(["12", "13기", "20"])("auto — 신규 %s 기수도 등록 시트 기준으로 연결한다", async (cohort) => {
    api.findUserByEmail.mockResolvedValue(normalUser({ cohort }));
    const body = await (await POST(request({ mode: "auto" }))).json();
    expect(body).toEqual({ ok: true, feedbackFolderId: FOUND, status: "ok" });
    expect(api.discover).toHaveBeenCalledWith(SHEET);
    expect(api.updateDriveLink).toHaveBeenCalledTimes(1);
    expect(api.updateDriveLink).toHaveBeenCalledWith(EMAIL, {
      driveParentPath: PARENT, feedbackFolderId: FOUND, driveLinkStatus: "ok",
    });
  });

  it("auto — 저장된 유효 폴더는 부모 조회 없이 재사용한다", async () => {
    api.findUserByEmail.mockResolvedValue(normalUser({ feedbackFolderId: SAVED }));
    api.verifySaved.mockResolvedValue({ ok: true });

    const body = await (await POST(request({ mode: "auto" }))).json();

    expect(body.ok).toBe(true);
    expect(body.feedbackFolderId).toBe(SAVED);
    expect(api.discover).not.toHaveBeenCalled();
    expect(api.updateDriveLink).toHaveBeenCalledWith(
      EMAIL,
      expect.objectContaining({ feedbackFolderId: SAVED, driveLinkStatus: "ok" }),
    );
  });

  it("auto — 저장값이 깨졌으면 발견으로 이어진다", async () => {
    api.findUserByEmail.mockResolvedValue(normalUser({ feedbackFolderId: SAVED }));
    api.verifySaved.mockResolvedValue({ ok: false, reason: "folder_not_shared" });

    const body = await (await POST(request({ mode: "auto" }))).json();

    expect(body.ok).toBe(true);
    expect(api.discover).toHaveBeenCalledWith(SHEET);
    expect(body.feedbackFolderId).toBe(FOUND);
  });

  it("auto — 발견 실패는 기존값을 보존한다(지우지 않음)", async () => {
    api.findUserByEmail.mockResolvedValue(
      normalUser({ feedbackFolderId: SAVED, driveLinkStatus: "ok" }),
    );
    api.verifySaved.mockResolvedValue({ ok: false, reason: "folder_missing" });
    api.discover.mockResolvedValue({
      ok: false,
      reason: "folder_missing",
      message: "상위 폴더에서 ‘01’로 시작하는 피드백 폴더를 찾지 못했어요. 폴더 이름과 공유 권한을 확인해 주세요.",
    });

    const body = await (await POST(request({ mode: "auto" }))).json();

    expect(body.errorKind).toBe("folder_missing");
    expect(cleared()).toBe(false);
  });

  it("auto — folder_not_shared 는 전용 kind 로, 그 외는 일반 kind 로", async () => {
    api.discover.mockResolvedValue({
      ok: false,
      reason: "folder_not_shared",
      message: "폴더 공유 권한을 확인해 주세요. 서비스 계정에 폴더 공유가 필요해요.",
    });
    const shared = await (await POST(request({ mode: "auto" }))).json();
    expect(shared.errorKind).toBe("folder_not_shared");

    api.discover.mockResolvedValue({
      ok: false,
      reason: "folder_ambiguous",
      message: "‘01’로 시작하는 폴더가 여러 개 있어 자동으로 고를 수 없어요. 운영자에게 알려주세요.",
    });
    const amb = await (await POST(request({ mode: "auto" }))).json();
    expect(amb.errorKind).toBe("folder_ambiguous");
    expect(cleared()).toBe(false);
  });

  it("auto — 본문 임의 sheetId 로 admin 조회를 유도할 수 없다", async () => {
    await POST(request({ mode: "auto", spreadsheetId: "evil-sheet-999", sheetId: "evil-2" }));
    expect(api.discover).toHaveBeenCalledTimes(1);
    expect(api.discover).toHaveBeenCalledWith(SHEET);
  });

  it("manual — 발견된 내 폴더면 연결된다", async () => {
    const body = await (
      await POST(
        request({ mode: "manual", parentFolderUrl: `https://drive.google.com/drive/folders/${FOUND}` }),
      )
    ).json();
    expect(body.ok).toBe(true);
    expect(api.updateDriveLink).toHaveBeenCalledWith(
      EMAIL,
      expect.objectContaining({ feedbackFolderId: FOUND, driveLinkStatus: "ok" }),
    );
  });

  it("manual — proven 부모를 붙여넣으면 자식으로 해결된다", async () => {
    const body = await (
      await POST(
        request({ mode: "manual", parentFolderUrl: `https://drive.google.com/drive/folders/${PARENT}` }),
      )
    ).json();
    expect(body.ok).toBe(true);
    expect(body.feedbackFolderId).toBe(FOUND);
  });

  it("★manual — 임의 01 폴더 URL 은 거부하고 기존값을 보존한다", async () => {
    api.findUserByEmail.mockResolvedValue(
      normalUser({ feedbackFolderId: SAVED, driveLinkStatus: "ok" }),
    );
    const body = await (
      await POST(
        request({ mode: "manual", parentFolderUrl: `https://drive.google.com/drive/folders/${OTHER}` }),
      )
    ).json();
    expect(body.errorKind).toBe("folder_missing");
    expect(cleared()).toBe(false);
  });

  it("manual — 저장 driveParentPath 는 소유 증명이 아니다", async () => {
    // 저장 경로에 OTHER 가 있어도 발견값과 다르면 거부해야 한다.
    api.findUserByEmail.mockResolvedValue(normalUser({ driveParentPath: OTHER }));
    const body = await (
      await POST(
        request({ mode: "manual", parentFolderUrl: `https://drive.google.com/drive/folders/${OTHER}` }),
      )
    ).json();
    expect(body.ok).not.toBe(true);
  });

  it("route 401 — 미인증 throw·미등록은 401", async () => {
    api.getWritableUserEmail.mockRejectedValueOnce(new Error("need login"));
    const r1 = await POST(request({ mode: "auto" }));
    expect(r1.status).toBe(401);

    api.findUserByEmail.mockResolvedValueOnce(null);
    const r2 = await POST(request({ mode: "auto" }));
    expect(r2.status).toBe(401);
  });

  it("route Drive 403 — 검증 실패만 folder_not_shared", async () => {
    api.discover.mockResolvedValue({
      ok: false,
      reason: "folder_not_shared",
      message: "폴더 공유 권한을 확인해 주세요. 서비스 계정에 폴더 공유가 필요해요.",
    });
    const body = await (await POST(request({ mode: "auto" }))).json();
    expect(body.errorKind).toBe("folder_not_shared");
    expect(cleared()).toBe(false);
  });
});
