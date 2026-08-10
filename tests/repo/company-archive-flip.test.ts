/**
 * R7-#11(BBE-60) — company_archive(06) 진짜 flip 회귀.
 *
 * 스코프: upsertCompanyInfoArchive(생성·갱신)만. 파일럿(opts.syncDb)은 DB 동기 정본(실패=throw)
 * 먼저 쓰고, 시트는 큐잉된 비동기 수렴 잡(meetings-write.ts queueMeetingSheetSync 동형 패턴)에
 * 맡긴다 — db-write-flip §2 목표(시트 왕복 제거)를 이 upsert 경로에서 달성. renameCompanyInfoKey
 * (개명)는 이번 스코프 밖(기존 dual-sync 불변) — company-archive-write-sync.test.ts 가 계속 고정.
 *
 * hasCompanyInfoArchiveRow(fromDb) — 파일럿에서 upsert 직후 시트가 아직 안 따라잡은 창에서
 * "없음"으로 오판하는 read-your-writes 회귀 방지(R3-2 §6 교훈).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbEnabled = vi.fn(() => true);
const persistCompanyArchiveRow = vi.fn();
const readCompanyArchiveRowPayload = vi.fn();
const markMirrorPending = vi.fn();
const clearMirrorPending = vi.fn();
const listMirrorPending = vi.fn();
const captureServerEvent = vi.fn();
const valuesGet = vi.fn();
const valuesUpdate = vi.fn();
const spreadsheetsGet = vi.fn();
const batchUpdate = vi.fn();

vi.mock("@/repo/db/client", () => ({
  dbEnabled: (...a: unknown[]) => dbEnabled(...(a as [])),
}));
vi.mock("@/repo/db/company-archive-sync", () => ({
  persistCompanyArchiveRow: (...a: unknown[]) => persistCompanyArchiveRow(...(a as [])),
  persistCompanyArchiveRename: vi.fn(),
  readCompanyArchiveRowPayload: (...a: unknown[]) => readCompanyArchiveRowPayload(...(a as [])),
}));
vi.mock("@/repo/db/mirror-pending", () => ({
  markMirrorPending: (...a: unknown[]) => markMirrorPending(...(a as [])),
  clearMirrorPending: (...a: unknown[]) => clearMirrorPending(...(a as [])),
  listMirrorPending: (...a: unknown[]) => listMirrorPending(...(a as [])),
}));
vi.mock("@/lib/analytics/api-timing", () => ({
  captureServerEvent: (...a: unknown[]) => captureServerEvent(...(a as [])),
}));
vi.mock("@/repo/sheets-client", () => ({
  sheetsClient: () => ({
    spreadsheets: {
      get: (...a: unknown[]) => spreadsheetsGet(...a),
      batchUpdate: (...a: unknown[]) => batchUpdate(...a),
      values: {
        get: (...a: unknown[]) => valuesGet(...a),
        update: (...a: unknown[]) => valuesUpdate(...a),
      },
    },
  }),
  ensureGridColumns: vi.fn(async () => {}),
}));

import { hasCompanyInfoArchiveRow, upsertCompanyInfoArchive } from "@/repo/company-info-archive";

const SHEET = "sheet-pilot";
const REF = "2026-07-10|가나상사";

beforeEach(() => {
  for (const m of [
    dbEnabled, persistCompanyArchiveRow, readCompanyArchiveRowPayload,
    markMirrorPending, clearMirrorPending, listMirrorPending, captureServerEvent,
    valuesGet, valuesUpdate, spreadsheetsGet, batchUpdate,
  ]) m.mockReset();
  dbEnabled.mockReturnValue(true);
  persistCompanyArchiveRow.mockResolvedValue(undefined);
  readCompanyArchiveRowPayload.mockResolvedValue(null); // 기본 = 동기화할 정본 없음(조용히 종료)
  markMirrorPending.mockResolvedValue(undefined);
  clearMirrorPending.mockResolvedValue(undefined);
  listMirrorPending.mockResolvedValue([]);
  // ensureCompanyInfoTab 캐시 대응(첫 호출에서만 실제 실행) — 탭 이미 존재 + 헤더 완비로 no-op화.
  spreadsheetsGet.mockResolvedValue({
    data: { sheets: [{ properties: { title: "06 업체정보" } }] },
  });
  valuesGet.mockImplementation(async ({ range }: { range: string }) => {
    if (range.includes("!A1:")) {
      return { data: { values: [Array(28).fill("h")] } }; // 헤더 완비
    }
    if (range.endsWith("C2:C")) return { data: { values: [] } }; // 기존 행 검색 — 기본 없음
    if (range.endsWith("A2:A")) return { data: { values: [] } }; // 빈 행 탐색 — 기본 처음부터
    return { data: {} };
  });
  valuesUpdate.mockResolvedValue({ data: {} });
});

afterEach(async () => {
  await new Promise((r) => setTimeout(r, 10));
});

const DATA = { 업체명: "가나상사", 계약일: "2026-07-10", 업체정보: { 개업일: "2020-01-01" } as never };

describe("upsertCompanyInfoArchive — 파일럿(syncDb:true) 진짜 flip", () => {
  it("DB 동기 정본 실패 → throw, 시트(sheetsClient) 미개입(큐잉 이전에 실패)", async () => {
    persistCompanyArchiveRow.mockRejectedValue(new Error("반영되지 않았어요"));
    await expect(
      upsertCompanyInfoArchive(SHEET, DATA, { syncDb: true }),
    ).rejects.toThrow("반영되지 않았어요");
    expect(valuesUpdate).not.toHaveBeenCalled();
  });

  it("DB 동기 정본 성공 → persistCompanyArchiveRow(ref, payload, opts) 호출, 반환값은 -1/false(미사용 고정)", async () => {
    const res = await upsertCompanyInfoArchive(SHEET, DATA, { syncDb: true });
    expect(persistCompanyArchiveRow).toHaveBeenCalledWith(
      SHEET,
      REF,
      { 업체명: "가나상사", 계약일: "2026-07-10", 개업일: "2020-01-01" },
      { syncDb: true },
    );
    expect(res).toEqual({ row: -1, created: false });
  });

  it("성공 후 큐잉된 수렴 잡이 최신 DB 상태로 A:AB find-or-append 쓴다", async () => {
    readCompanyArchiveRowPayload.mockResolvedValue({
      _cleared: false,
      업체명: "가나상사",
      계약일: "2026-07-10",
      개업일: "2020-01-01",
    });
    valuesGet.mockImplementation(async ({ range }: { range: string }) => {
      if (range.includes("!A1:")) return { data: { values: [Array(28).fill("h")] } };
      if (range.endsWith("C2:C")) return { data: { values: [["2026-07-10|가나상사"]] } }; // row 2 = 기존 키
      return { data: {} };
    });
    await upsertCompanyInfoArchive(SHEET, DATA, { syncDb: true });
    await vi.waitFor(() => expect(valuesUpdate).toHaveBeenCalled());
    const call = valuesUpdate.mock.calls[0]![0] as {
      spreadsheetId: string; range: string; requestBody: { values: string[][] };
    };
    expect(call.spreadsheetId).toBe(SHEET);
    expect(call.range).toBe("'06 업체정보'!A2:AB2");
    expect(call.requestBody.values[0]![0]).toBe("가나상사");
    expect(call.requestBody.values[0]![2]).toBe("2026-07-10|가나상사");
  });

  it("DB 행이 _cleared(rename 으로 지워짐) → 시트 반영 스킵(no-op, 그래도 성공 취급)", async () => {
    readCompanyArchiveRowPayload.mockResolvedValue({ _cleared: true });
    await upsertCompanyInfoArchive(SHEET, DATA, { syncDb: true });
    await vi.waitFor(() => expect(clearMirrorPending).toHaveBeenCalled());
    expect(valuesUpdate).not.toHaveBeenCalled(); // 반영할 정본이 없어 시트는 건드리지 않음
  });
});

describe("upsertCompanyInfoArchive — 비파일럿(opts 없음/false) 불변(R2)", () => {
  it("시트 동기 update 먼저(inline) + persistCompanyArchiveRow(비파일럿 미러) 뒤", async () => {
    await upsertCompanyInfoArchive(SHEET, DATA);
    expect(valuesUpdate).toHaveBeenCalledTimes(1); // ensureCompanyInfoTab 은 첫 호출 캐시로 헤더쓰기 스킵
    expect(persistCompanyArchiveRow).toHaveBeenCalledWith(
      SHEET,
      REF,
      { 업체명: "가나상사", 계약일: "2026-07-10", 개업일: "2020-01-01" },
      undefined,
    );
  });

  it("syncDb:false 명시 — 동일(불변)", async () => {
    const res = await upsertCompanyInfoArchive(SHEET, DATA, { syncDb: false });
    expect(res.created).toBe(true); // 신규 행(빈 A2:A → append)
    expect(persistCompanyArchiveRow).toHaveBeenCalledWith(
      SHEET, REF, expect.anything(), { syncDb: false },
    );
  });
});

describe("mirror_pending 안전망 — company_archive 수렴 잡(§7-3 동형)", () => {
  it("시트 수렴 최종 실패 → markMirrorPending(tab=company_archive) + captureServerEvent", async () => {
    readCompanyArchiveRowPayload.mockRejectedValue(new Error("sheet read down"));
    await upsertCompanyInfoArchive(SHEET, DATA, { syncDb: true });
    await vi.waitFor(
      () => expect(markMirrorPending).toHaveBeenCalledWith({
        spreadsheetId: SHEET,
        tab: "company_archive",
        rowKey: REF,
      }),
      { timeout: 3000 },
    );
    expect(captureServerEvent).toHaveBeenCalledWith("sheet_mirror_error", { tab: "company_archive" });
    expect(clearMirrorPending).not.toHaveBeenCalled();
  });

  it("시트 수렴 성공 → clearMirrorPending(tab=company_archive)", async () => {
    readCompanyArchiveRowPayload.mockResolvedValue({ 업체명: "가나상사", 계약일: "2026-07-10" });
    await upsertCompanyInfoArchive(SHEET, DATA, { syncDb: true });
    await vi.waitFor(() => expect(clearMirrorPending).toHaveBeenCalledWith({
      spreadsheetId: SHEET,
      tab: "company_archive",
      rowKey: REF,
    }));
    expect(markMirrorPending).not.toHaveBeenCalled();
  });

  it("self-heal: 같은 시트의 밀린 pending 키도 재드라이브", async () => {
    listMirrorPending.mockResolvedValueOnce(["2026-01-01|옛업체"]);
    readCompanyArchiveRowPayload.mockResolvedValue({ 업체명: "가나상사", 계약일: "2026-07-10" });
    await upsertCompanyInfoArchive(SHEET, DATA, { syncDb: true });
    await vi.waitFor(() => expect(clearMirrorPending).toHaveBeenCalledWith({
      spreadsheetId: SHEET,
      tab: "company_archive",
      rowKey: "2026-01-01|옛업체",
    }));
  });
});

describe("hasCompanyInfoArchiveRow — fromDb(파일럿) read-your-writes 회귀", () => {
  it("fromDb:true + DB 에 활성 행 있음 → true, 시트(values.get) 미확인", async () => {
    readCompanyArchiveRowPayload.mockResolvedValue({ 업체명: "가나상사", _cleared: false });
    const ok = await hasCompanyInfoArchiveRow(SHEET, "2026-07-10", "가나상사", { fromDb: true });
    expect(ok).toBe(true);
  });

  it("fromDb:true + DB 공백(미러 갭) → 시트 확인으로 self-heal(기존 동작)", async () => {
    readCompanyArchiveRowPayload.mockResolvedValue(null);
    valuesGet.mockImplementation(async ({ range }: { range: string }) => {
      if (range.includes("!A1:")) return { data: { values: [Array(28).fill("h")] } };
      if (range.endsWith("C2:C")) return { data: { values: [["2026-07-10|가나상사"]] } };
      return { data: {} };
    });
    const ok = await hasCompanyInfoArchiveRow(SHEET, "2026-07-10", "가나상사", { fromDb: true });
    expect(ok).toBe(true);
  });

  it("fromDb:true + DB _cleared → 시트 확인으로 폴백(DB만으로 확정 안 함)", async () => {
    readCompanyArchiveRowPayload.mockResolvedValue({ _cleared: true });
    valuesGet.mockImplementation(async ({ range }: { range: string }) => {
      if (range.includes("!A1:")) return { data: { values: [Array(28).fill("h")] } };
      if (range.endsWith("C2:C")) return { data: { values: [] } };
      return { data: {} };
    });
    const ok = await hasCompanyInfoArchiveRow(SHEET, "2026-07-10", "가나상사", { fromDb: true });
    expect(ok).toBe(false);
  });

  it("fromDb 생략(기본) → DB 미호출, 시트로만 확인(비파일럿 불변)", async () => {
    valuesGet.mockImplementation(async ({ range }: { range: string }) => {
      if (range.includes("!A1:")) return { data: { values: [Array(28).fill("h")] } };
      if (range.endsWith("C2:C")) return { data: { values: [["2026-07-10|가나상사"]] } };
      return { data: {} };
    });
    const ok = await hasCompanyInfoArchiveRow(SHEET, "2026-07-10", "가나상사");
    expect(ok).toBe(true);
    expect(readCompanyArchiveRowPayload).not.toHaveBeenCalled();
  });

  it("fromDb:true + DB 조회 실패 → 시트 폴백(삼킴)", async () => {
    readCompanyArchiveRowPayload.mockRejectedValue(new Error("db down"));
    valuesGet.mockImplementation(async ({ range }: { range: string }) => {
      if (range.includes("!A1:")) return { data: { values: [Array(28).fill("h")] } };
      if (range.endsWith("C2:C")) return { data: { values: [] } };
      return { data: {} };
    });
    const ok = await hasCompanyInfoArchiveRow(SHEET, "2026-07-10", "가나상사", { fromDb: true });
    expect(ok).toBe(false);
  });
});
