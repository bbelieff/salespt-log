/**
 * R3-3 PR-2 — 06 업체정보(company_archive) DB 동기 정본 라우터 회귀 (db-write-flip §6·§7):
 *  ① upsert 성공 = 계약ref(자연키) 병합 upsert 1회(payload 그대로)
 *  ② 1회 실패→재시도 성공(멱등, throw 없음) ③ 2회 실패→사용자 에러 throw(시트폴백 금지)
 *  ④ dbEnabled=false→no-op ⑤ owner 역조회 실패해도 "?"/"" 로 진행
 *  ⑥ 비파일럿(syncDb:false·opts 생략)=미러(async fire-forget)·throw 없음·동기 upsert 미사용
 *  ⑦ rename 동기 = old _cleared 후 new 키필드, 순서 보장 ⑧ rename 비파일럿=clear+set 미러.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertSheetRow = vi.fn();
const dbEnabled = vi.fn(() => true);
const findOwnerBySpreadsheetId = vi.fn(async () => ({ cohort: "8", email: "u@x.y" }));
const mirrorSheetRow = vi.fn();
const mirrorClearRow = vi.fn();

vi.mock("@/repo/db/client", () => ({
  dbEnabled: (...a: unknown[]) => dbEnabled(...(a as [])),
  upsertSheetRow: (...a: unknown[]) => upsertSheetRow(...(a as [])),
}));
vi.mock("@/repo/users", () => ({
  findOwnerBySpreadsheetId: (...a: unknown[]) => findOwnerBySpreadsheetId(...(a as [])),
}));
vi.mock("@/repo/db/mirror", () => ({
  mirrorSheetRow: (...a: unknown[]) => mirrorSheetRow(...(a as [])),
  mirrorClearRow: (...a: unknown[]) => mirrorClearRow(...(a as [])),
}));

import {
  persistCompanyArchiveRename,
  persistCompanyArchiveRow,
} from "@/repo/db/company-archive-sync";

const REF = "2026-06-10|A업체";
const NEXT_REF = "2026-06-10|B업체";

beforeEach(() => {
  upsertSheetRow.mockReset().mockResolvedValue({ skipped: false });
  dbEnabled.mockReset().mockReturnValue(true);
  findOwnerBySpreadsheetId.mockReset().mockResolvedValue({ cohort: "8", email: "u@x.y" });
  mirrorSheetRow.mockReset();
  mirrorClearRow.mockReset();
});

describe("persistCompanyArchiveRow — upsert 정본 라우터", () => {
  it("① syncDb:true 성공 — 계약ref(자연키) 로 병합 upsert 1회 (payload 그대로)", async () => {
    await persistCompanyArchiveRow(
      "sheet-1",
      REF,
      { 업체명: "A업체", 계약일: "2026-06-10", 개업일: "2020-01-01" },
      { syncDb: true },
    );
    expect(upsertSheetRow).toHaveBeenCalledTimes(1);
    expect(upsertSheetRow).toHaveBeenCalledWith({
      cohort: "8",
      email: "u@x.y",
      spreadsheetId: "sheet-1",
      tab: "company_archive",
      rowKey: REF,
      payload: { 업체명: "A업체", 계약일: "2026-06-10", 개업일: "2020-01-01" },
    });
    expect(mirrorSheetRow).not.toHaveBeenCalled();
  });

  it("② 1회 실패 후 재시도 성공 — throw 없음(병합 멱등)", async () => {
    upsertSheetRow
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce({ skipped: false });
    await expect(
      persistCompanyArchiveRow("sheet-1", REF, { 업체명: "A업체" }, { syncDb: true }),
    ).resolves.toBeUndefined();
    expect(upsertSheetRow).toHaveBeenCalledTimes(2);
  });

  it("③ 2회 연속 실패 — 저장 실패 에러 throw(시트폴백 금지)", async () => {
    upsertSheetRow.mockRejectedValue(new Error("down"));
    await expect(
      persistCompanyArchiveRow("sheet-1", REF, { 업체명: "A업체" }, { syncDb: true }),
    ).rejects.toThrow("반영되지 않았어요");
    expect(upsertSheetRow).toHaveBeenCalledTimes(2);
  });

  it("④ DB 미설정 — no-op(호출 0, throw 없음)", async () => {
    dbEnabled.mockReturnValue(false);
    await expect(
      persistCompanyArchiveRow("sheet-1", REF, { 업체명: "A업체" }, { syncDb: true }),
    ).resolves.toBeUndefined();
    expect(upsertSheetRow).not.toHaveBeenCalled();
  });

  it("⑤ owner 역조회 실패 — '?'/'' 로 진행", async () => {
    findOwnerBySpreadsheetId.mockRejectedValue(new Error("registry down"));
    await persistCompanyArchiveRow("sheet-1", REF, { 업체명: "A업체" }, { syncDb: true });
    expect(upsertSheetRow).toHaveBeenCalledWith(
      expect.objectContaining({ cohort: "?", email: "", rowKey: REF }),
    );
  });

  it("⑥ syncDb:false(비파일럿) → 미러 경로, 동기 upsert 미사용·throw 없음", async () => {
    await expect(
      persistCompanyArchiveRow("sheet-1", REF, { 업체명: "A업체" }, { syncDb: false }),
    ).resolves.toBeUndefined();
    expect(mirrorSheetRow).toHaveBeenCalledWith({
      spreadsheetId: "sheet-1",
      tab: "company_archive",
      rowKey: REF,
      payload: { 업체명: "A업체" },
    });
    expect(upsertSheetRow).not.toHaveBeenCalled();
  });

  it("opts 생략 → 미러 경로(비파일럿 기본, throw 없음)", async () => {
    await expect(
      persistCompanyArchiveRow("sheet-1", REF, { 업체명: "A업체" }),
    ).resolves.toBeUndefined();
    expect(mirrorSheetRow).toHaveBeenCalledTimes(1);
    expect(upsertSheetRow).not.toHaveBeenCalled();
  });
});

describe("persistCompanyArchiveRename — 키 이동 라우터", () => {
  it("⑦ syncDb:true — old _cleared 후 new 키필드, 2회 upsert 순서 보장", async () => {
    const calls: string[] = [];
    upsertSheetRow.mockImplementation(async (r: { rowKey: string }) => {
      calls.push(r.rowKey);
      return { skipped: false };
    });
    await persistCompanyArchiveRename(
      "sheet-1",
      REF,
      { rowKey: NEXT_REF, payload: { _cleared: false, 업체명: "B업체", 계약일: "2026-06-10" } },
      { syncDb: true },
    );
    expect(calls).toEqual([REF, NEXT_REF]); // clear old → set new
    expect(upsertSheetRow).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ rowKey: REF, payload: { _cleared: true } }),
    );
    expect(upsertSheetRow).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        rowKey: NEXT_REF,
        payload: { _cleared: false, 업체명: "B업체", 계약일: "2026-06-10" },
      }),
    );
    expect(mirrorSheetRow).not.toHaveBeenCalled();
    expect(mirrorClearRow).not.toHaveBeenCalled();
  });

  it("clear old 실패(2회) — throw(시트폴백 금지), new 미도달", async () => {
    upsertSheetRow.mockRejectedValue(new Error("down"));
    await expect(
      persistCompanyArchiveRename(
        "sheet-1",
        REF,
        { rowKey: NEXT_REF, payload: { _cleared: false } },
        { syncDb: true },
      ),
    ).rejects.toThrow("반영되지 않았어요");
  });

  it("⑧ syncDb:false(비파일럿) → mirrorClearRow(old) + mirrorSheetRow(new), 동기 upsert 미사용", async () => {
    await persistCompanyArchiveRename(
      "sheet-1",
      REF,
      { rowKey: NEXT_REF, payload: { _cleared: false, 업체명: "B업체", 계약일: "2026-06-10" } },
      { syncDb: false },
    );
    expect(mirrorClearRow).toHaveBeenCalledWith({
      spreadsheetId: "sheet-1",
      tab: "company_archive",
      rowKey: REF,
    });
    expect(mirrorSheetRow).toHaveBeenCalledWith({
      spreadsheetId: "sheet-1",
      tab: "company_archive",
      rowKey: NEXT_REF,
      payload: { _cleared: false, 업체명: "B업체", 계약일: "2026-06-10" },
    });
    expect(upsertSheetRow).not.toHaveBeenCalled();
  });
});
