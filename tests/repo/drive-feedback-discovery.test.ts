/**
 * drive-feedback-discovery 회귀 — 주입 가짜 Drive 클라이언트로 검증.
 * 가짜 id·이름만 사용. DB·시트 쓰기·공유 변경 없음.
 */
import { describe, expect, it, vi } from "vitest";
import {
  discoverFeedbackFolder,
  verifySavedFeedbackFolder,
  type MinimalDrive,
} from "@/repo/drive-feedback-discovery";

const SHEET = "sheet-registered-001";
const PARENT = "parent-proven-001";
const FEEDBACK = "feedback-01-folder-001";
const OTHER_PARENT = "parent-other-999";
const OTHER_FEEDBACK = "feedback-01-other-999";

const FOLDER_MIME = "application/vnd.google-apps.folder";
const SHEET_MIME = "application/vnd.google-apps.spreadsheet";

type GetImpl = (params: { fileId: string }) => Promise<{ data: unknown }>;
type ListImpl = (params: Record<string, unknown>) => Promise<{ data: unknown }>;

function fakeDrive(getImpl: GetImpl, listImpl: ListImpl): MinimalDrive & {
  getCalls: unknown[];
  listCalls: Record<string, unknown>[];
} {
  const getCalls: unknown[] = [];
  const listCalls: Record<string, unknown>[] = [];
  return {
    getCalls,
    listCalls,
    files: {
      get: vi.fn(async (p: { fileId: string }) => {
        getCalls.push(p);
        return getImpl(p) as Promise<{ data: unknown }>;
      }),
      list: vi.fn(async (p: Record<string, unknown>) => {
        listCalls.push(p);
        return listImpl(p) as Promise<{ data: unknown }>;
      }),
    },
  };
}

function sheetGet(parents: string[] | undefined, extra: Record<string, unknown> = {}) {
  return async ({ fileId }: { fileId: string }) => {
    if (fileId !== SHEET) {
      const e = { code: 404 } as unknown as Error;
      throw e;
    }
    return {
      data: { id: fileId, name: "trainee sheet", mimeType: SHEET_MIME, trashed: false, parents, ...extra },
    };
  };
}

/** 자식 1개 + 검증 통과용 list. */
function listOneChildWithVerify(parentId: string, childId: string, childParents?: string[]) {
  return async (p: Record<string, unknown>) => {
    const q = String(p.q ?? "");
    if (q.includes(`${childId}' in parents`)) return { data: { files: [] } };
    return {
      data: {
        files: [
          {
            id: childId,
            name: "01 feedback",
            mimeType: FOLDER_MIME,
            trashed: false,
            ...(childParents !== undefined ? { parents: childParents } : {}),
          },
        ],
      },
    };
  };
}

function folderGetOk(childId: string) {
  return async ({ fileId }: { fileId: string }) => {
    if (fileId === SHEET) {
      return {
        data: { id: fileId, name: "sheet", mimeType: SHEET_MIME, trashed: false, parents: [PARENT] },
      };
    }
    if (fileId === childId) {
      return {
        data: { id: fileId, name: "01 feedback", mimeType: FOLDER_MIME, trashed: false, parents: [PARENT] },
      };
    }
    const e = { code: 404 } as unknown as Error;
    throw e;
  };
}

describe("discoverFeedbackFolder", () => {
  it("SA 부모가 있으면 admin 호출 없이 성공한다", async () => {
    const sa = fakeDrive(folderGetOk(FEEDBACK), listOneChildWithVerify(PARENT, FEEDBACK));
    const admin = fakeDrive(
      async () => {
        throw new Error("admin must not be called");
      },
      async () => ({ data: { files: [] } }),
    );
    const r = await discoverFeedbackFolder(SHEET, { saDrive: sa, adminDrive: admin });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.feedbackFolderId).toBe(FEEDBACK);
      expect(r.parentId).toBe(PARENT);
      expect(r.parentSource).toBe("sa");
    }
    expect(vi.mocked(admin.files.get)).not.toHaveBeenCalled();
  });

  it("SA parents 누락이면 등록 시트 1개만 admin READ 로 부모를 확정한다", async () => {
    const sa = fakeDrive(sheetGet([]), listOneChildWithVerify(PARENT, FEEDBACK));
    const adminGet = vi.fn(async ({ fileId }: { fileId: string }) => ({
      data: { id: fileId, name: "sheet", mimeType: SHEET_MIME, trashed: false, parents: [PARENT] },
    }));
    const admin: MinimalDrive = {
      files: { get: adminGet as unknown as MinimalDrive["files"]["get"], list: vi.fn(async () => ({ data: { files: [] } })) as unknown as MinimalDrive["files"]["list"] },
    };
    // 폴더 검증 GET/LIST 는 SA 로 수행되므로 sa.get 도 폴더를 알아야 한다.
    vi.mocked(sa.files.get).mockImplementation(async (p: { fileId: string }) => {
      if (p.fileId === SHEET) {
        return { data: { id: SHEET, name: "s", mimeType: SHEET_MIME, trashed: false, parents: [] } };
      }
      return { data: { id: FEEDBACK, name: "01 feedback", mimeType: FOLDER_MIME, trashed: false, parents: [PARENT] } };
    });
    const r = await discoverFeedbackFolder(SHEET, { saDrive: sa, adminDrive: admin });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.parentSource).toBe("admin");
    // admin 조회는 등록 시트 1회에 한정(둘째 인자 timeout·retry 옵션 허용).
    expect(adminGet).toHaveBeenCalledTimes(1);
    expect(adminGet.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ fileId: SHEET }));
  });

  it("토큰 미설정(admin 팩토리 throw)은 원문 없이 parent_metadata_unavailable", async () => {
    const sa = fakeDrive(sheetGet([]), async () => ({ data: { files: [] } }));
    const r = await discoverFeedbackFolder(SHEET, {
      saDrive: sa,
      getAdminDrive: () => {
        throw new Error("ADMIN_DRIVE_REFRESH_TOKEN missing with secret xyz");
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("parent_metadata_unavailable");
      expect(r.message).not.toMatch(/ADMIN|xyz|token/i);
    }
  });

  it("admin OAuth 실패(403)는 공유 오류가 아니라 parent_metadata_unavailable", async () => {
    const sa = fakeDrive(sheetGet([]), async () => ({ data: { files: [] } }));
    const admin = fakeDrive(
      async () => {
        throw { code: 403 };
      },
      async () => ({ data: { files: [] } }),
    );
    const r = await discoverFeedbackFolder(SHEET, { saDrive: sa, adminDrive: admin });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("parent_metadata_unavailable");
  });

  it("시트 404 → sheet_not_found, SA 403 → parent_metadata_unavailable", async () => {
    const notFound = fakeDrive(
      async () => {
        throw { code: 404 };
      },
      async () => ({ data: { files: [] } }),
    );
    const r1 = await discoverFeedbackFolder(SHEET, { saDrive: notFound, adminDrive: null });
    expect(!r1.ok && r1.reason).toBe("sheet_not_found");

    const forbidden = fakeDrive(
      async () => {
        throw { code: 403 };
      },
      async () => ({ data: { files: [] } }),
    );
    const r2 = await discoverFeedbackFolder(SHEET, { saDrive: forbidden, adminDrive: null });
    expect(!r2.ok && r2.reason).toBe("parent_metadata_unavailable");
  });

  it("후보 검증 GET 403 → folder_not_shared (검증된 실패만 공유 오류)", async () => {
    const sa = fakeDrive(
      async ({ fileId }: { fileId: string }) => {
        if (fileId === SHEET) {
          return { data: { id: SHEET, name: "s", mimeType: SHEET_MIME, trashed: false, parents: [PARENT] } };
        }
        throw { code: 403 };
      },
      async (p: Record<string, unknown>) => {
        const q = String(p.q ?? "");
        if (q.includes(`${PARENT}' in parents`)) {
          return { data: { files: [{ id: FEEDBACK, name: "01 feedback", mimeType: FOLDER_MIME, trashed: false }] } };
        }
        return { data: { files: [] } };
      },
    );
    const r = await discoverFeedbackFolder(SHEET, { saDrive: sa, adminDrive: null });
    expect(!r.ok && r.reason).toBe("folder_not_shared");
  });

  it("잘못된 MIME·trashed 후보는 folder_missing", async () => {
    for (const bad of [
      { mimeType: SHEET_MIME, trashed: false },
      { mimeType: FOLDER_MIME, trashed: true },
    ]) {
      const sa = fakeDrive(
        async ({ fileId }: { fileId: string }) => {
          if (fileId === SHEET) {
            return { data: { id: SHEET, name: "s", mimeType: SHEET_MIME, trashed: false, parents: [PARENT] } };
          }
          return { data: { id: FEEDBACK, name: "01 feedback", ...bad, parents: [PARENT] } };
        },
        async (p: Record<string, unknown>) => {
          const q = String(p.q ?? "");
          if (q.includes(`${PARENT}' in parents`)) {
            return { data: { files: [{ id: FEEDBACK, name: "01 feedback", ...bad }] } };
          }
          return { data: { files: [] } };
        },
      );
      const r = await discoverFeedbackFolder(SHEET, { saDrive: sa, adminDrive: null });
      expect(!r.ok && r.reason).toBe("folder_missing");
    }
  });

  it("페이지네이션 전체 순회 — 2페이지에 걸친 2개 후보는 모호함", async () => {
    const sa = fakeDrive(
      async ({ fileId }: { fileId: string }) => {
        if (fileId === SHEET) {
          return { data: { id: SHEET, name: "s", mimeType: SHEET_MIME, trashed: false, parents: [PARENT] } };
        }
        return { data: { id: fileId, name: "01 x", mimeType: FOLDER_MIME, trashed: false, parents: [PARENT] } };
      },
      async (p: Record<string, unknown>) => {
        if (!p.pageToken) {
          return {
            data: {
              files: [{ id: "cand-page1", name: "01 alpha", mimeType: FOLDER_MIME, trashed: false }],
              nextPageToken: "tok2",
            },
          };
        }
        return {
          data: {
            files: [{ id: "cand-page2", name: "01 beta", mimeType: FOLDER_MIME, trashed: false }],
          },
        };
      },
    );
    const r = await discoverFeedbackFolder(SHEET, { saDrive: sa, adminDrive: null });
    expect(!r.ok && r.reason).toBe("folder_ambiguous");
  });

  it("다른 부모의 폴더는 제외된다", async () => {
    const sa = fakeDrive(
      async ({ fileId }: { fileId: string }) => {
        if (fileId === SHEET) {
          return { data: { id: SHEET, name: "s", mimeType: SHEET_MIME, trashed: false, parents: [PARENT] } };
        }
        return { data: { id: fileId, name: "01 feedback", mimeType: FOLDER_MIME, trashed: false, parents: [PARENT] } };
      },
      async (p: Record<string, unknown>) => {
        const q = String(p.q ?? "");
        if (q.includes(`${PARENT}' in parents`)) {
          return {
            data: {
              files: [
                { id: OTHER_FEEDBACK, name: "01 feedback", mimeType: FOLDER_MIME, trashed: false, parents: [OTHER_PARENT] },
              ],
            },
          };
        }
        return { data: { files: [] } };
      },
    );
    const r = await discoverFeedbackFolder(SHEET, { saDrive: sa, adminDrive: null });
    expect(!r.ok && r.reason).toBe("folder_missing");
  });

  it("★같은 이름이 다른 곳에 있어도 공유 드라이브 전체 탐색을 하지 않는다", async () => {
    const sa = fakeDrive(folderGetOk(FEEDBACK), listOneChildWithVerify(PARENT, FEEDBACK));
    const r = await discoverFeedbackFolder(SHEET, { saDrive: sa, adminDrive: null });
    expect(r.ok).toBe(true);
    const calls = (sa as unknown as { listCalls: Record<string, unknown>[] }).listCalls;
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      expect(String(c.q ?? "")).toMatch(/in parents/);
      expect(c).not.toHaveProperty("corpora");
      expect(c).not.toHaveProperty("driveId");
    }
    const gets = (sa as unknown as { getCalls: unknown[] }).getCalls as { fileId: string }[];
    for (const g of gets) {
      expect([SHEET, FEEDBACK]).toContain(g.fileId);
    }
  });

  it("재시도 가능 오류(500)는 retryable", async () => {
    const sa = fakeDrive(
      async ({ fileId }: { fileId: string }) => {
        if (fileId === SHEET) {
          return { data: { id: SHEET, name: "s", mimeType: SHEET_MIME, trashed: false, parents: [PARENT] } };
        }
        return { data: { id: FEEDBACK, name: "01 feedback", mimeType: FOLDER_MIME, trashed: false, parents: [PARENT] } };
      },
      async () => {
        throw { code: 500 };
      },
    );
    const r = await discoverFeedbackFolder(SHEET, { saDrive: sa, adminDrive: null });
    expect(!r.ok && r.reason).toBe("retryable");
  });

  it("빈 spreadsheetId 면 Drive 호출 없이 parent_metadata_unavailable", async () => {
    const sa = fakeDrive(
      async () => ({ data: {} }),
      async () => ({ data: { files: [] } }),
    );
    const r = await discoverFeedbackFolder("  ", { saDrive: sa, adminDrive: null });
    expect(!r.ok && r.reason).toBe("parent_metadata_unavailable");
    expect(vi.mocked(sa.files.get)).not.toHaveBeenCalled();
    expect(vi.mocked(sa.files.list)).not.toHaveBeenCalled();
  });
});

describe("verifySavedFeedbackFolder", () => {
  it("SA GET+LIST 통과면 재사용 가능", async () => {
    const sa = fakeDrive(
      async () => ({ data: { id: FEEDBACK, name: "01 feedback", mimeType: FOLDER_MIME, trashed: false } }),
      async () => ({ data: { files: [] } }),
    );
    const r = await verifySavedFeedbackFolder(FEEDBACK, { saDrive: sa });
    expect(r.ok).toBe(true);
  });

  it("trashed 저장값은 재사용 불가", async () => {
    const sa = fakeDrive(
      async () => ({ data: { id: FEEDBACK, name: "01 feedback", mimeType: FOLDER_MIME, trashed: true } }),
      async () => ({ data: { files: [] } }),
    );
    const r = await verifySavedFeedbackFolder(FEEDBACK, { saDrive: sa });
    expect(r.ok).toBe(false);
  });
});
