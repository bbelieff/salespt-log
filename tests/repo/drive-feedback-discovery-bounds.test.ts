/**
 * drive-feedback-discovery bounds 회귀 — 시간·페이지·메타 엄격성.
 * 가짜 id 만 사용. DB·시트·공유 변경 없음.
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

const FOLDER_MIME = "application/vnd.google-apps.folder";
const SHEET_MIME = "application/vnd.google-apps.spreadsheet";

function fakeDrive(
  getImpl: (p: { fileId: string }) => Promise<{ data: unknown }>,
  listImpl: (p: Record<string, unknown>) => Promise<{ data: unknown }>,
): MinimalDrive & { getOpts: unknown[]; listOpts: unknown[] } {
  const getOpts: unknown[] = [];
  const listOpts: unknown[] = [];
  return {
    getOpts,
    listOpts,
    files: {
      get: vi.fn(async (p: { fileId: string }, o?: unknown) => {
        getOpts.push(o);
        return getImpl(p) as Promise<{ data: unknown }>;
      }),
      list: vi.fn(async (p: Record<string, unknown>, o?: unknown) => {
        listOpts.push(o);
        return listImpl(p) as Promise<{ data: unknown }>;
      }),
    },
  };
}

function sheetMeta(parents: unknown, extra: Record<string, unknown> = {}) {
  return {
    data: {
      id: SHEET,
      name: "trainee sheet",
      mimeType: SHEET_MIME,
      trashed: false,
      parents,
      ...extra,
    },
  };
}

function listOne(parentId: string, childId: string, childExtra: Record<string, unknown> = {}) {
  return async (p: Record<string, unknown>) => {
    const q = String(p.q ?? "");
    if (q.includes(`${childId}' in parents`)) return { data: { files: [] } };
    if (q.includes(`${parentId}' in parents`)) {
      return {
        data: {
          files: [
            { id: childId, name: "01 feedback", mimeType: FOLDER_MIME, trashed: false, ...childExtra },
          ],
        },
      };
    }
    return { data: { files: [] } };
  };
}

function folderGetOk(childId: string, parentId: string, name = "01 feedback") {
  return async ({ fileId }: { fileId: string }) => {
    if (fileId === SHEET) return sheetMeta([parentId]);
    if (fileId === childId) {
      return { data: { id: fileId, name, mimeType: FOLDER_MIME, trashed: false, parents: [parentId] } };
    }
    const e = { code: 404 } as unknown as Error;
    throw e;
  };
}

describe("bounds — per-call options + deadline", () => {
  it("모든 외부 호출에 timeout(≤5000)·retry:false 를 붙인다", async () => {
    const sa = fakeDrive(folderGetOk(FEEDBACK, PARENT), listOne(PARENT, FEEDBACK));
    const r = await discoverFeedbackFolder(SHEET, { saDrive: sa, adminDrive: null });
    expect(r.ok).toBe(true);
    for (const o of [...sa.getOpts, ...sa.listOpts]) {
      expect(o).toMatchObject({ retry: false });
      const t = (o as { timeout: number }).timeout;
      expect(t).toBeGreaterThan(0);
      expect(t).toBeLessThanOrEqual(5000);
    }
  });

  it("데드라인 초과면 가짜 시계로 retryable — 남은 호출을 늘리지 않는다", async () => {
    let t = 1000;
    const now = () => t;
    const sa = fakeDrive(
      async ({ fileId }: { fileId: string }) => {
        t += 16000; // 첫 GET 이 데드라인을 넘김
        if (fileId === SHEET) return sheetMeta([PARENT]);
        return { data: { id: fileId, name: "01 feedback", mimeType: FOLDER_MIME, trashed: false } };
      },
      listOne(PARENT, FEEDBACK),
    );
    const r = await discoverFeedbackFolder(SHEET, {
      saDrive: sa,
      adminDrive: null,
      now,
      discoveryDeadlineMs: 15000,
    });
    expect(!r.ok && r.reason).toBe("retryable");
  });

  it("페이지 사이클(같은 토큰 반복)은 부분 성공으로 쓰지 않고 거부한다", async () => {
    const sa = fakeDrive(folderGetOk("cand-cycle-01", PARENT), async (p: Record<string, unknown>) => {
      const q = String(p.q ?? "");
      if (q.includes(`${PARENT}' in parents`)) {
        if (!p.pageToken) {
          return { data: { files: [{ id: "cand-cycle-01", name: "01 a", mimeType: FOLDER_MIME, trashed: false }], nextPageToken: "tok-loop" } };
        }
        return { data: { files: [{ id: "cand-cycle-02", name: "01 b", mimeType: FOLDER_MIME, trashed: false }], nextPageToken: "tok-loop" } };
      }
      return { data: { files: [] } };
    });
    const r = await discoverFeedbackFolder(SHEET, { saDrive: sa, adminDrive: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("retryable");
  });

  it("maxPages 초과는 거부한다", async () => {
    const sa = fakeDrive(folderGetOk("cand-max-01", PARENT), async (p: Record<string, unknown>) => {
      const q = String(p.q ?? "");
      if (q.includes(`${PARENT}' in parents`)) {
        const n = p.pageToken ? Number(String(p.pageToken).replace("t", "")) : 0;
        return {
          data: {
            files: [{ id: `cand-max-0${n}`, name: "01 x", mimeType: FOLDER_MIME, trashed: false }],
            nextPageToken: `t${n + 1}`,
          },
        };
      }
      return { data: { files: [] } };
    });
    const r = await discoverFeedbackFolder(SHEET, { saDrive: sa, adminDrive: null, maxPages: 3 });
    expect(!r.ok && r.reason).toBe("retryable");
  });

  it("incompleteSearch=true 는 유일성 증거로 쓰지 않고 거부한다", async () => {
    const sa = fakeDrive(folderGetOk(FEEDBACK, PARENT), async (p: Record<string, unknown>) => {
      const q = String(p.q ?? "");
      if (q.includes(`${PARENT}' in parents`)) {
        return { data: { files: [{ id: FEEDBACK, name: "01 feedback", mimeType: FOLDER_MIME, trashed: false }], incompleteSearch: true } };
      }
      return { data: { files: [] } };
    });
    const r = await discoverFeedbackFolder(SHEET, { saDrive: sa, adminDrive: null });
    expect(!r.ok && r.reason).toBe("retryable");
  });
});

describe("bounds — 시트 메타 엄격성", () => {
  it("스프레드시트 MIME 이 아니면 parent_metadata_unavailable (admin 호출 없음)", async () => {
    const sa = fakeDrive(
      async () => ({ data: { id: SHEET, name: "x", mimeType: FOLDER_MIME, trashed: false, parents: [PARENT] } }),
      async () => ({ data: { files: [] } }),
    );
    const adminGet = vi.fn(async () => ({ data: {} }));
    const admin: MinimalDrive = {
      files: { get: adminGet as unknown as MinimalDrive["files"]["get"], list: vi.fn(async () => ({ data: { files: [] } })) as unknown as MinimalDrive["files"]["list"] },
    };
    const r = await discoverFeedbackFolder(SHEET, { saDrive: sa, adminDrive: admin });
    expect(!r.ok && r.reason).toBe("parent_metadata_unavailable");
    expect(adminGet).not.toHaveBeenCalled();
  });

  it("부모 2개면 추측 없이 parent_metadata_unavailable", async () => {
    const sa = fakeDrive(
      async () => sheetMeta([PARENT, OTHER_PARENT]),
      async () => ({ data: { files: [] } }),
    );
    const adminGet = vi.fn(async () => ({ data: {} }));
    const admin: MinimalDrive = {
      files: { get: adminGet as unknown as MinimalDrive["files"]["get"], list: vi.fn(async () => ({ data: { files: [] } })) as unknown as MinimalDrive["files"]["list"] },
    };
    const r = await discoverFeedbackFolder(SHEET, { saDrive: sa, adminDrive: admin });
    expect(!r.ok && r.reason).toBe("parent_metadata_unavailable");
    expect(adminGet).not.toHaveBeenCalled();
  });

  it("trashed 시트는 parent_metadata_unavailable", async () => {
    const sa = fakeDrive(
      async () => ({ data: { id: SHEET, name: "s", mimeType: SHEET_MIME, trashed: true, parents: [PARENT] } }),
      async () => ({ data: { files: [] } }),
    );
    const r = await discoverFeedbackFolder(SHEET, { saDrive: sa, adminDrive: null });
    expect(!r.ok && r.reason).toBe("parent_metadata_unavailable");
  });

  it("admin 폴백에도 같은 검증 — admin MIME 불일치면 parent_metadata_unavailable", async () => {
    const sa = fakeDrive(
      async ({ fileId }: { fileId: string }) => {
        if (fileId === SHEET) return sheetMeta([]);
        return { data: { id: fileId, name: "01 feedback", mimeType: FOLDER_MIME, trashed: false } };
      },
      listOne(PARENT, FEEDBACK),
    );
    const admin = fakeDrive(
      async () => ({ data: { id: SHEET, name: "s", mimeType: FOLDER_MIME, trashed: false, parents: [PARENT] } }),
      async () => ({ data: { files: [] } }),
    );
    const r = await discoverFeedbackFolder(SHEET, { saDrive: sa, adminDrive: admin });
    expect(!r.ok && r.reason).toBe("parent_metadata_unavailable");
  });

  it("안전하지 않은 sheetId 는 Drive 호출 없이 parent_metadata_unavailable", async () => {
    const sa = fakeDrive(
      async () => ({ data: {} }),
      async () => ({ data: { files: [] } }),
    );
    const r = await discoverFeedbackFolder("a'b OR true --", { saDrive: sa, adminDrive: null });
    expect(!r.ok && r.reason).toBe("parent_metadata_unavailable");
    expect(vi.mocked(sa.files.get)).not.toHaveBeenCalled();
  });
});

describe("bounds — 후보 검증 + 메시지 + 401", () => {
  it("최종 GET 이름이 01 로 시작하지 않으면 folder_missing", async () => {
    const sa = fakeDrive(folderGetOk(FEEDBACK, PARENT, "02 other"), listOne(PARENT, FEEDBACK));
    const r = await discoverFeedbackFolder(SHEET, { saDrive: sa, adminDrive: null });
    expect(!r.ok && r.reason).toBe("folder_missing");
  });

  it("자식 parents 누락만은 허용(부모 범위 쿼리가 관계 증명) — 명시적 다른 부모는 제외", async () => {
    // 누락 허용 → 성공
    const okDrive = fakeDrive(folderGetOk(FEEDBACK, PARENT), async (p: Record<string, unknown>) => {
      const q = String(p.q ?? "");
      if (q.includes(`${FEEDBACK}' in parents`)) return { data: { files: [] } };
      return { data: { files: [{ id: FEEDBACK, name: "01 feedback", mimeType: FOLDER_MIME, trashed: false }] } };
    });
    const ok = await discoverFeedbackFolder(SHEET, { saDrive: okDrive, adminDrive: null });
    expect(ok.ok).toBe(true);
  });

  it("parent_metadata_unavailable 메시지는 공유 탓이 아니다", async () => {
    const sa = fakeDrive(
      async () => {
        throw { code: 403 };
      },
      async () => ({ data: { files: [] } }),
    );
    const r = await discoverFeedbackFolder(SHEET, { saDrive: sa, adminDrive: null });
    expect(!r.ok && r.reason).toBe("parent_metadata_unavailable");
    if (!r.ok) {
      expect(r.message).toBe("시트 상위 폴더 정보를 확인하지 못했어요. 운영자에게 연결 확인을 요청해 주세요.");
      expect(r.message).not.toMatch(/공유/);
    }
  });

  it("SA 401 은 retryable", async () => {
    const sa = fakeDrive(
      async () => {
        throw { code: 401 };
      },
      async () => ({ data: { files: [] } }),
    );
    const r = await discoverFeedbackFolder(SHEET, { saDrive: sa, adminDrive: null });
    expect(!r.ok && r.reason).toBe("retryable");
  });

  it("verifySaved 도 timeout·retry:false 로 호출한다", async () => {
    const sa = fakeDrive(
      async () => ({ data: { id: FEEDBACK, name: "01 feedback", mimeType: FOLDER_MIME, trashed: false } }),
      async () => ({ data: { files: [] } }),
    );
    const r = await verifySavedFeedbackFolder(FEEDBACK, { saDrive: sa });
    expect(r.ok).toBe(true);
    for (const o of [...sa.getOpts, ...sa.listOpts]) {
      expect(o).toMatchObject({ retry: false });
      expect((o as { timeout: number }).timeout).toBeLessThanOrEqual(5000);
    }
  });
});
