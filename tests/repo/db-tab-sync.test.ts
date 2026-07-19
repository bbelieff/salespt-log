/**
 * R3-4 03 DB관리 편집 DB 동기 정본 헬퍼 (persistDbRow / clearDbRow) 회귀:
 *  ① 성공 시 {섹션}:r{row} 병합 upsert 1회(tab="db", payload 그대로)
 *  ② 1회 실패→재시도 성공(멱등) ③ 2회 실패→사용자 에러 throw(시트폴백 금지)
 *  ④ dbEnabled=false→no-op ⑤ owner 역조회 실패해도 "?"/"" 로 진행
 *  ⑥ syncDb:false(비파일럿)→미러(async) 경로, 동기 upsert 미사용·throw 없음(불변식).
 * contracts-write-sync.test.ts 와 동형 — 03 판(rowKey 섹션 프리픽스·tab="db").
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

import { clearDbRow, persistDbRow } from "@/repo/db/db-tab-sync";

beforeEach(() => {
  upsertSheetRow.mockReset().mockResolvedValue({ skipped: false });
  dbEnabled.mockReset().mockReturnValue(true);
  findOwnerBySpreadsheetId.mockReset().mockResolvedValue({ cohort: "8", email: "u@x.y" });
  mirrorSheetRow.mockReset();
  mirrorClearRow.mockReset();
});

describe("persistDbRow (syncDb:true — 03 편집 정본)", () => {
  it("① 성공 — {섹션}:r{row} 로 payload 병합 upsert 1회(tab='db')", async () => {
    await persistDbRow("sheet-1", "매입DB:r9", { 업체명: "가나", _cleared: false }, { syncDb: true });
    expect(upsertSheetRow).toHaveBeenCalledTimes(1);
    expect(upsertSheetRow).toHaveBeenCalledWith({
      cohort: "8",
      email: "u@x.y",
      spreadsheetId: "sheet-1",
      tab: "db",
      rowKey: "매입DB:r9",
      payload: { 업체명: "가나", _cleared: false },
    });
    expect(mirrorSheetRow).not.toHaveBeenCalled();
  });

  it("② 1회 실패 후 재시도 성공 — throw 없음(병합 멱등)", async () => {
    upsertSheetRow
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce({ skipped: false });
    await expect(
      persistDbRow("sheet-1", "직접생산:r5", { 소재: "x" }, { syncDb: true }),
    ).resolves.toBeUndefined();
    expect(upsertSheetRow).toHaveBeenCalledTimes(2);
  });

  it("③ 2회 연속 실패 — 저장 실패 에러 throw(시트폴백=미러 금지)", async () => {
    upsertSheetRow.mockRejectedValue(new Error("down"));
    await expect(
      persistDbRow("sheet-1", "현수막:r7", { 업체명: "a" }, { syncDb: true }),
    ).rejects.toThrow("반영되지 않았어요");
    expect(upsertSheetRow).toHaveBeenCalledTimes(2);
    expect(mirrorSheetRow).not.toHaveBeenCalled();
  });

  it("④ DB 미설정 — no-op(upsert 0·미러 0)", async () => {
    dbEnabled.mockReturnValue(false);
    await persistDbRow("sheet-1", "콜지기소:r4", { 업체명: "a" }, { syncDb: true });
    expect(upsertSheetRow).not.toHaveBeenCalled();
    expect(mirrorSheetRow).not.toHaveBeenCalled();
  });

  it("⑤ owner 역조회 실패 — '?'/'' 로 진행", async () => {
    findOwnerBySpreadsheetId.mockRejectedValue(new Error("registry down"));
    await persistDbRow("sheet-1", "매입DB:r9", { 업체명: "a" }, { syncDb: true });
    expect(upsertSheetRow).toHaveBeenCalledWith(
      expect.objectContaining({ cohort: "?", email: "", rowKey: "매입DB:r9" }),
    );
  });
});

describe("persistDbRow / clearDbRow (불변식 — 비파일럿=미러 async·no-throw)", () => {
  it("syncDb:false → mirrorSheetRow(async) 경로, 동기 upsert 미사용", async () => {
    await expect(
      persistDbRow("sheet-1", "매입DB:r9", { 업체명: "a" }, { syncDb: false }),
    ).resolves.toBeUndefined();
    expect(mirrorSheetRow).toHaveBeenCalledWith({
      spreadsheetId: "sheet-1",
      tab: "db",
      rowKey: "매입DB:r9",
      payload: { 업체명: "a" },
    });
    expect(upsertSheetRow).not.toHaveBeenCalled();
  });

  it("opts 생략 → 미러 경로(비파일럿 기본, throw 없음)", async () => {
    await expect(persistDbRow("sheet-1", "매입DB:r9", { 업체명: "a" })).resolves.toBeUndefined();
    expect(mirrorSheetRow).toHaveBeenCalledTimes(1);
    expect(upsertSheetRow).not.toHaveBeenCalled();
  });
});

describe("clearDbRow (삭제 DB-side 반영)", () => {
  it("syncDb:true → _cleared:true 병합 upsert + 삭제 문구 throw 유지", async () => {
    await clearDbRow("sheet-1", "매입DB:r7", { syncDb: true });
    expect(upsertSheetRow).toHaveBeenCalledWith(
      expect.objectContaining({ tab: "db", rowKey: "매입DB:r7", payload: { _cleared: true } }),
    );
    upsertSheetRow.mockRejectedValue(new Error("down"));
    await expect(clearDbRow("sheet-1", "매입DB:r7", { syncDb: true })).rejects.toThrow(
      "삭제가 화면 데이터에 아직 반영되지 않았어요",
    );
  });

  it("syncDb:false → mirrorClearRow(async) 경로, 동기 upsert 미사용", async () => {
    await clearDbRow("sheet-1", "직접생산:r5", { syncDb: false });
    expect(mirrorClearRow).toHaveBeenCalledWith({
      spreadsheetId: "sheet-1",
      tab: "db",
      rowKey: "직접생산:r5",
    });
    expect(upsertSheetRow).not.toHaveBeenCalled();
  });

  it("R14: extra(발굴id:'') → syncDb:true 는 _cleared 와 함께 무효화 병합", async () => {
    await clearDbRow("sheet-1", "콜지기소:r7", { syncDb: true }, { 발굴id: "" });
    expect(upsertSheetRow).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { _cleared: true, 발굴id: "" } }),
    );
  });

  it("R14: extra 가 있으면 async 경로도 mirrorSheetRow 병합(mirrorClearRow 는 extra 못 실음)", async () => {
    await clearDbRow("sheet-1", "콜지기소:r7", { syncDb: false }, { 발굴id: "" });
    expect(mirrorSheetRow).toHaveBeenCalledWith(
      expect.objectContaining({ tab: "db", rowKey: "콜지기소:r7", payload: { _cleared: true, 발굴id: "" } }),
    );
    expect(mirrorClearRow).not.toHaveBeenCalled();
  });
});
