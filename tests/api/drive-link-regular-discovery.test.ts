import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getWritableUserEmail: vi.fn(), findUserByEmail: vi.fn(), updateDriveLink: vi.fn(),
  getDriveFileMeta: vi.fn(), findFolderByNamePrefix: vi.fn(),
  findFolderByNameInDrive: vi.fn(), listCohorts: vi.fn(), list: vi.fn(),
}));
vi.mock("@/auth/identity", () => ({ getWritableUserEmail: api.getWritableUserEmail }));
vi.mock("@/repo/users", () => ({ findUserByEmail: api.findUserByEmail, updateDriveLink: api.updateDriveLink }));
vi.mock("@/repo/cohorts", () => ({ listCohorts: api.listCohorts }));
vi.mock("@/repo/drive-client", () => ({
  getDriveFileMeta: api.getDriveFileMeta,
  findFolderByNamePrefix: api.findFolderByNamePrefix,
  findFolderByNameInDrive: api.findFolderByNameInDrive,
  driveClient: () => ({ files: { list: api.list } }),
}));
vi.mock("@/lib/analytics/api-timing", () => ({ withApiTiming: (_: string, h: unknown) => h }));
import { POST } from "@/app/api/drive-link/route";

const FOLDER = "application/vnd.google-apps.folder";
const SHEET = "application/vnd.google-apps.spreadsheet";
const folder = (id: string, name = id) => ({ id, name, mimeType: FOLDER });
const sheet = (id: string) => ({ id, name: "경영일지", mimeType: SHEET });
let children: Record<string, unknown[]>;
let pageMeta: Record<string, Record<string, unknown>>;
const request = (body = { mode: "auto" } as Record<string, string>) => new Request("http://localhost/api/drive-link", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

describe("일반기수 auto — 등록 시트 소유 증명", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.getWritableUserEmail.mockResolvedValue("own@example.com");
    api.findUserByEmail.mockResolvedValue({ email: "own@example.com", cohort: "11", name: "동명이인", spreadsheetId: "own-sheet" });
    api.listCohorts.mockResolvedValue([{ label: "11", type: "cohort", rootFolderId: "cohort-root" }]);
    api.getDriveFileMeta.mockResolvedValue({ ok: true, name: "경영일지", parentId: null, parentsCount: 0, driveId: null });
    pageMeta = {};
    children = {
      "cohort-root": [folder("other-parent", "동명이인"), folder("own-parent", "이름이 달라도 본인")],
      "other-parent": [sheet("other-sheet"), folder("other-feedback", "01 피드백업체")],
      "own-parent": [sheet("own-sheet"), folder("own-feedback", "01 피드백업체")],
    };
    api.list.mockImplementation(async ({ q }: { q: string }) => {
      const parent = q.match(/'([^']+)' in parents/)?.[1];
      if (!parent || !(parent in children)) throw new Error("Unbounded or unexpected query");
      return { data: { files: children[parent], ...pageMeta[parent] } };
    });
  });

  it.each(["cohort-root", "own-parent", "other-parent"]) ("%s 목록의 다음 페이지를 무시하고 연결하지 않는다", async (parent) => {
    pageMeta[parent] = { nextPageToken: "more" };
    expect((await (await POST(request())).json()).ok).toBe(false);
    expect(api.updateDriveLink).not.toHaveBeenCalled();
  });

  it.each(["cohort-root", "own-parent", "other-parent"]) ("%s incompleteSearch는 연결하지 않는다", async (parent) => {
    pageMeta[parent] = { incompleteSearch: true };
    expect((await (await POST(request())).json()).ok).toBe(false);
    expect(api.updateDriveLink).not.toHaveBeenCalled();
  });

  it("개인폴더 50개 예산을 넘으면 자식 탐색도 시작하지 않는다", async () => {
    const extras = Array.from({ length: 49 }, (_, i) => folder(`extra-${i}`));
    children["cohort-root"]!.push(...extras);
    for (const f of extras) children[f.id] = [];
    expect((await (await POST(request())).json()).ok).toBe(false);
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(api.updateDriveLink).not.toHaveBeenCalled();
  });

  it("기존 parent 경로도 여러 01 후보 중 하나를 고르지 않는다", async () => {
    api.getDriveFileMeta.mockResolvedValue({ ok: true, parentId: "own-parent", driveId: "shared-drive" });
    api.findFolderByNamePrefix.mockResolvedValue("own-feedback");
    children["own-parent"]!.push(folder("another-feedback", "01"));
    expect((await (await POST(request())).json()).ok).toBe(false);
    expect(api.updateDriveLink).not.toHaveBeenCalled();
    expect(api.findFolderByNameInDrive).not.toHaveBeenCalled();
  });

  it("같은 기수 root 설정이 중복되면 임의로 하나를 선택하지 않는다", async () => {
    api.listCohorts.mockResolvedValue([
      { label: "11", rootFolderId: "cohort-root" }, { label: "11", rootFolderId: "another-root" },
    ]);
    expect((await (await POST(request())).json()).reason).toBe("root_ambiguous");
    expect(api.list).not.toHaveBeenCalled();
    expect(api.updateDriveLink).not.toHaveBeenCalled();
  });

  it("조회 실패 시 내부 Drive 오류를 노출하지 않고 incomplete로 끝낸다", async () => {
    api.list.mockRejectedValue(new Error("PRIVATE_REMOTE_DETAIL"));
    const body = await (await POST(request())).json();
    expect(body.reason).toBe("incomplete");
    expect(JSON.stringify(body)).not.toContain("PRIVATE_REMOTE_DETAIL");
    expect(api.updateDriveLink).not.toHaveBeenCalled();
  });

  it("잘못된 root ID를 쿼리에 삽입하지 않는다", async () => {
    api.listCohorts.mockResolvedValue([{ label: "11", rootFolderId: "root' or trashed = true" }]);
    expect((await (await POST(request())).json()).reason).toBe("incomplete");
    expect(api.list).not.toHaveBeenCalled();
  });

  it("조회는 5초 timeout/재시도 없음이며 UI 25초보다 짧은 15초 탐색예산으로 중단한다", async () => {
    let now = 0;
    const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
    const list = api.list.getMockImplementation()!;
    api.list.mockImplementation(async (...args: unknown[]) => {
      const result = await list(...args);
      now += 8_000;
      return result;
    });
    try {
      const body = await (await POST(request())).json();
      expect(body.reason).toBe("incomplete");
      expect(api.list).toHaveBeenCalledTimes(2);
      expect(api.list.mock.calls[0]![1]).toEqual({ timeout: 5000, retry: false });
      expect(api.updateDriveLink).not.toHaveBeenCalled();
    } finally { clock.mockRestore(); }
  });

  it("부모 메타가 복수이면 첫 부모를 임의로 선택하지 않는다", async () => {
    api.getDriveFileMeta.mockResolvedValue({ ok: true, parentId: "own-parent", parentsCount: 2 });
    expect((await (await POST(request())).json()).reason).toBe("ambiguous");
    expect(api.list).not.toHaveBeenCalled();
    expect(api.updateDriveLink).not.toHaveBeenCalled();
  });

  it.each([
    ["cohort-root", { name: "개인폴더", mimeType: FOLDER }],
    ["own-parent", { id: "unknown-folder", mimeType: FOLDER }],
    ["own-parent", { id: "unknown-mime", name: "01 피드백업체" }],
    ["own-parent", { id: "bad'folder", name: "01 피드백업체", mimeType: FOLDER }],
  ])("%s의 불완전한 항목도 후보 부재로 간주하지 않는다", async (parent, file) => {
    children[parent as string]!.push(file);
    expect((await (await POST(request())).json()).reason).toBe("incomplete");
    expect(api.updateDriveLink).not.toHaveBeenCalled();
  });

  it("시트가 없고 이름만 같은 개인폴더는 연결하지 않는다", async () => {
    children["own-parent"] = [folder("own-feedback", "01 피드백업체")];
    api.findFolderByNameInDrive.mockResolvedValue("other-feedback");
    api.getDriveFileMeta.mockResolvedValue({ ok: true, parentId: null, driveId: "shared-drive" });
    const body = await (await POST(request())).json();
    expect(body).toMatchObject({ ok: false, reason: "not_found" });
    expect(body.errorKind).not.toBe("folder_not_shared");
    expect(api.findFolderByNameInDrive).not.toHaveBeenCalled();
    expect(api.updateDriveLink).not.toHaveBeenCalled();
  });

  it("정확한 시트가 두 개인폴더에 보이면 01 존재 여부와 무관하게 모호", async () => {
    children["other-parent"] = [sheet("own-sheet")];
    expect((await (await POST(request())).json()).reason).toBe("ambiguous");
    expect(api.updateDriveLink).not.toHaveBeenCalled();
  });

  it("본인 시트를 찾았어도 01이 없으면 남의 01을 가져오지 않는다", async () => {
    children["own-parent"] = [sheet("own-sheet")];
    expect((await (await POST(request())).json()).reason).toBe("not_found");
    expect(api.updateDriveLink).not.toHaveBeenCalled();
  });

  it("본인 개인폴더의 01 후보가 두 개면 정확명/짧은 이름 우선 없이 모호", async () => {
    children["own-parent"]!.push(folder("other-01", "01"));
    expect((await (await POST(request())).json()).reason).toBe("ambiguous");
    expect(api.updateDriveLink).not.toHaveBeenCalled();
  });

  it.each([[], [{ label: "111", rootFolderId: "cohort-root" }],
    [{ label: "11", rootFolderId: "" }], [{ label: "11", type: "arena", rootFolderId: "cohort-root" }],
  ])("같은 일반기수의 등록 root 없으면 Drive를 넓혀 찾지 않는다: %j", async (...rows) => {
    api.listCohorts.mockResolvedValue(rows);
    expect((await (await POST(request())).json()).reason).toBe("root_missing");
    expect(api.list).not.toHaveBeenCalled();
    expect(api.updateDriveLink).not.toHaveBeenCalled();
  });

  it("부모 메타가 있으면 root 조회 없이 기존 개인폴더를 연결", async () => {
    api.getDriveFileMeta.mockResolvedValue({ ok: true, parentId: "own-parent", parentsCount: 1 });
    expect((await (await POST(request())).json()).feedbackFolderId).toBe("own-feedback");
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(api.listCohorts).not.toHaveBeenCalled();
  });

  it("기존 parent에 01이 없으면 root의 시트 포함 폴더로만 폴백", async () => {
    api.getDriveFileMeta.mockResolvedValue({ ok: true, parentId: "old-parent", parentsCount: 1 });
    children["old-parent"] = [];
    expect((await (await POST(request())).json()).feedbackFolderId).toBe("own-feedback");
    expect(api.findFolderByNameInDrive).not.toHaveBeenCalled();
  });

  it.each(["nextPageToken", "incompleteSearch"])("기존 parent %s도 실패 폐쇄", async (key) => {
    api.getDriveFileMeta.mockResolvedValue({ ok: true, parentId: "own-parent", parentsCount: 1 });
    pageMeta["own-parent"] = { [key]: key === "nextPageToken" ? "more" : true };
    expect((await (await POST(request())).json()).reason).toBe("incomplete");
    expect(api.listCohorts).not.toHaveBeenCalled();
    expect(api.updateDriveLink).not.toHaveBeenCalled();
  });

  it("잘못된 MIME의 본인 ID나 시트 바로가기는 소유 증명이 아니다", async () => {
    children["own-parent"] = [folder("own-sheet"), folder("own-feedback", "01 피드백업체")];
    expect((await (await POST(request())).json()).reason).toBe("not_found");
    expect(api.updateDriveLink).not.toHaveBeenCalled();
  });

  it("하위 손자폴더의 시트를 재귀 탐색하지 않는다", async () => {
    children["own-parent"] = [folder("nested")];
    children.nested = [sheet("own-sheet"), folder("own-feedback", "01 피드백업체")];
    expect((await (await POST(request())).json()).reason).toBe("not_found");
    expect(api.list).toHaveBeenCalledTimes(3);
  });

  it("50개까지 탐색하되 최초 성공 뒤에도 전량 검증, query는 부모 범위만", async () => {
    const extras = Array.from({ length: 48 }, (_, i) => folder(`extra-${i}`));
    children["cohort-root"]!.push(...extras);
    for (const f of extras) children[f.id] = [];
    expect((await (await POST(request())).json()).feedbackFolderId).toBe("own-feedback");
    expect(api.list).toHaveBeenCalledTimes(51);
    for (const [params, options] of api.list.mock.calls) {
      expect(params.q).toContain("in parents");
      expect(params.q).not.toContain("name contains");
      expect(params.q).toContain("trashed = false");
      expect(params).not.toHaveProperty("corpora");
      expect(params).not.toHaveProperty("driveId");
      expect(params.fields).toContain("nextPageToken,incompleteSearch");
      expect(params).toMatchObject({ supportsAllDrives: true, includeItemsFromAllDrives: true });
      expect(options).toMatchObject({ retry: false });
    }
  });

  it("일반 manual 직접 01 URL 계약은 변경하지 않는다", async () => {
    api.getDriveFileMeta.mockResolvedValue({ ok: true, name: "01 피드백업체" });
    const body = await (await POST(request({ mode: "manual", parentFolderUrl: "https://drive.google.com/drive/folders/manual-feedback" }))).json();
    expect(body.feedbackFolderId).toBe("manual-feedback");
    expect(api.list).not.toHaveBeenCalled();
    expect(api.listCohorts).not.toHaveBeenCalled();
  });

  it("일반 manual 상위 URL은 기존 prefix resolver를 사용한다", async () => {
    api.getDriveFileMeta.mockResolvedValue({ ok: true, name: "개인폴더" });
    api.findFolderByNamePrefix.mockResolvedValue("manual-feedback");
    const body = await (await POST(request({ parentFolderUrl: "https://drive.google.com/drive/folders/manual-parent" }))).json();
    expect(body.feedbackFolderId).toBe("manual-feedback");
    expect(api.findFolderByNamePrefix).toHaveBeenCalledWith("01", "manual-parent");
    expect(api.list).not.toHaveBeenCalled();
  });

  it("parents와 driveId가 없어도 같은 기수 root 안의 정확한 시트 포함 폴더만 연결", async () => {
    const res = await POST(request());
    expect(await res.json()).toEqual({ ok: true, status: "ok", feedbackFolderId: "own-feedback" });
    expect(api.updateDriveLink).toHaveBeenCalledWith("own@example.com", { driveParentPath: "own-parent" });
    expect(api.updateDriveLink).toHaveBeenCalledWith("own@example.com", { feedbackFolderId: "own-feedback", driveLinkStatus: "ok" });
    expect(api.findFolderByNameInDrive).not.toHaveBeenCalled();
  });
});
