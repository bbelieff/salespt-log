/** 관리자는 원하는 폴더를 바로 연결한다(belie 2026-10-06). 합성 데이터. 초안: Muse. */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth/identity", () => ({
  getWritableUserEmail: vi.fn(),
  getSessionEmail: vi.fn(),
  isAdminEmail: (e: string) => e === "admin@example.com",
}));

vi.mock("@/repo/users", () => ({
  findUserByEmail: vi.fn(),
  updateDriveLink: vi.fn(),
}));

vi.mock("@/repo/drive-client", () => ({
  extractFolderId: (url: string) => {
    const m = String(url).match(/folders\/([A-Za-z0-9_-]+)/);
    return m ? m[1] : null;
  },
  findFolderByNamePrefix: vi.fn(),
  getDriveFileMeta: vi.fn(),
}));

vi.mock("@/repo/drive-feedback-discovery", () => ({
  discoverFeedbackFolder: vi.fn(),
  verifySavedFeedbackFolder: vi.fn(),
}));

vi.mock("@/repo/cohorts", () => ({
  listCohorts: vi.fn(async () => []),
}));

vi.mock("@/repo/users-arena", () => ({
  isArenaCohort: () => false,
  normalizeArenaCohort: (c: string) => c,
}));

vi.mock("@/repo/name-match", () => ({
  nameMatchCandidates: vi.fn(() => []),
}));

vi.mock("@/service/cohort-token", () => ({
  buildArenaCompanyFolderName: vi.fn(() => "arena-0"),
}));

vi.mock("@/lib/analytics/api-timing", () => ({
  withApiTiming: (_n: string, h: unknown) => h,
}));

import { POST } from "@/app/api/drive-link/route";
import { getSessionEmail, getWritableUserEmail } from "@/auth/identity";
import { findUserByEmail, updateDriveLink } from "@/repo/users";

function makeRequest() {
  return new Request("http://x/api/drive-link", {
    method: "POST",
    body: JSON.stringify({ parentFolderUrl: "https://drive.google.com/drive/folders/FOLDER123456" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getWritableUserEmail).mockResolvedValue("gm@example.com");
  vi.mocked(findUserByEmail).mockResolvedValue({
    email: "gm@example.com",
    cohort: "0",
    name: "GM",
    role: "trainee",
    status: "active",
    spreadsheetId: "s1",
  } as never);
});

describe("관리자가 폴더 URL을 직접 연결한다", () => {
  it("관리자 요청은 폴더 id를 바로 연결한다", async () => {
    vi.mocked(getSessionEmail).mockResolvedValue("admin@example.com");
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(updateDriveLink).toHaveBeenCalledWith("gm@example.com", {
      feedbackFolderId: "FOLDER123456",
      driveLinkStatus: "ok",
      driveParentPath: "관리자 지정",
    });
    expect(json.ok).toBe(true);
  });

  it("관리자가 아니면 바로 연결하지 않는다", async () => {
    vi.mocked(getSessionEmail).mockResolvedValue("user@example.com");
    await POST(makeRequest());
    expect(updateDriveLink).not.toHaveBeenCalledWith("gm@example.com", {
      feedbackFolderId: "FOLDER123456",
      driveLinkStatus: "ok",
      driveParentPath: "관리자 지정",
    });
  });
});
