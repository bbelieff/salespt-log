/**
 * POST /api/drive-link — 일반 기수 저장 단일 호출·보존·누수 방지 회귀.
 * 발견 helper·사용자·저장을 mock 해 라우트 동작만 본다.
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

describe("POST /api/drive-link — 저장 단일 호출·보존", () => {
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

  it("auto 발견 성공은 3필드 단일 호출이다", async () => {
    const body = await (await POST(request({ mode: "auto" }))).json();
    expect(body.ok).toBe(true);
    expect(api.updateDriveLink).toHaveBeenCalledTimes(1);
    expect(api.updateDriveLink).toHaveBeenCalledWith(EMAIL, {
      driveParentPath: PARENT,
      feedbackFolderId: FOUND,
      driveLinkStatus: "ok",
    });
  });

  it("manual 성공도 3필드 단일 호출이다", async () => {
    const body = await (
      await POST(
        request({ mode: "manual", parentFolderUrl: `https://drive.google.com/drive/folders/${FOUND}` }),
      )
    ).json();
    expect(body.ok).toBe(true);
    expect(api.updateDriveLink).toHaveBeenCalledTimes(1);
    expect(api.updateDriveLink).toHaveBeenCalledWith(EMAIL, {
      driveParentPath: PARENT,
      feedbackFolderId: FOUND,
      driveLinkStatus: "ok",
    });
  });

  it("저장값 유효 + 이미 ok 면 저장 없이 반환한다", async () => {
    api.findUserByEmail.mockResolvedValue(
      normalUser({ feedbackFolderId: SAVED, driveLinkStatus: "ok" }),
    );
    api.verifySaved.mockResolvedValue({ ok: true });
    const body = await (await POST(request({ mode: "auto" }))).json();
    expect(body.ok).toBe(true);
    expect(body.feedbackFolderId).toBe(SAVED);
    expect(api.updateDriveLink).not.toHaveBeenCalled();
    expect(api.discover).not.toHaveBeenCalled();
  });

  it("발견 실패·manual 불일치에는 절대 쓰지 않는다", async () => {
    api.discover.mockResolvedValue({
      ok: false,
      reason: "folder_missing",
      message: "상위 폴더에서 ‘01’로 시작하는 피드백 폴더를 찾지 못했어요. 폴더 이름과 공유 권한을 확인해 주세요.",
    });
    await POST(request({ mode: "auto" }));
    expect(api.updateDriveLink).not.toHaveBeenCalled();

    api.discover.mockResolvedValue({
      ok: true,
      feedbackFolderId: FOUND,
      parentId: PARENT,
      parentSource: "sa",
    });
    const bad = await (
      await POST(
        request({ mode: "manual", parentFolderUrl: "https://drive.google.com/drive/folders/feedback-other-999" }),
      )
    ).json();
    expect(bad.ok).not.toBe(true);
    expect(api.updateDriveLink).not.toHaveBeenCalled();
  });

  it("내부 예외는 원문 없이 retryable 500이다", async () => {
    api.discover.mockRejectedValueOnce(new Error("secret-conn-string postgres://abc"));
    const res = await POST(request({ mode: "auto" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.errorKind).toBe("retryable");
    expect(JSON.stringify(body)).not.toMatch(/secret-conn-string|postgres/);
  });
});
