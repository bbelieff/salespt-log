/**
 * R3-3 편집 DB 동기 정본 헬퍼 (upsertContractRowToDbSync) 회귀:
 *  ① 성공 시 r{row} 병합 upsert 1회(payload 그대로) ② 1회 실패→재시도 성공(멱등)
 *  ③ 2회 실패→사용자 에러 throw(시트폴백 금지) ④ dbEnabled=false→no-op
 *  ⑤ owner 역조회 실패해도 "?"/"" 로 진행 ⑥ clear 헬퍼는 기존 동작 불변(공유 코어 회귀).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertSheetRow = vi.fn();
const dbEnabled = vi.fn(() => true);
const findOwnerBySpreadsheetId = vi.fn(async () => ({ cohort: "8", email: "u@x.y" }));
const mirrorSheetRow = vi.fn();

vi.mock("@/repo/db/client", () => ({
  dbEnabled: (...a: unknown[]) => dbEnabled(...(a as [])),
  upsertSheetRow: (...a: unknown[]) => upsertSheetRow(...(a as [])),
}));
vi.mock("@/repo/users", () => ({
  findOwnerBySpreadsheetId: (...a: unknown[]) => findOwnerBySpreadsheetId(...(a as [])),
}));
vi.mock("@/repo/db/mirror", () => ({
  mirrorSheetRow: (...a: unknown[]) => mirrorSheetRow(...(a as [])),
  mirrorClearRow: vi.fn(),
}));

import {
  clearContractRowInDbSync,
  persistContractRow,
  upsertContractRowToDbSync,
} from "@/repo/db/contracts-clear";

beforeEach(() => {
  upsertSheetRow.mockReset().mockResolvedValue({ skipped: false });
  dbEnabled.mockReset().mockReturnValue(true);
  findOwnerBySpreadsheetId.mockReset().mockResolvedValue({ cohort: "8", email: "u@x.y" });
  mirrorSheetRow.mockReset();
});

describe("upsertContractRowToDbSync (R3-3 편집 정본)", () => {
  it("① 성공 — r{row} 로 payload 병합 upsert 1회 (부분 payload 그대로)", async () => {
    await upsertContractRowToDbSync("sheet-1", 9, { 수임비: 1_500_000 });
    expect(upsertSheetRow).toHaveBeenCalledTimes(1);
    expect(upsertSheetRow).toHaveBeenCalledWith({
      cohort: "8",
      email: "u@x.y",
      spreadsheetId: "sheet-1",
      tab: "contracts",
      rowKey: "r9",
      payload: { 수임비: 1_500_000 },
    });
  });

  it("② 1회 실패 후 재시도 성공 — throw 없음(병합 멱등)", async () => {
    upsertSheetRow
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce({ skipped: false });
    await expect(
      upsertContractRowToDbSync("sheet-1", 9, { 해지숨김: true }),
    ).resolves.toBeUndefined();
    expect(upsertSheetRow).toHaveBeenCalledTimes(2);
  });

  it("③ 2회 연속 실패 — 저장 실패 에러 throw(시트폴백 금지)", async () => {
    upsertSheetRow.mockRejectedValue(new Error("down"));
    await expect(
      upsertContractRowToDbSync("sheet-1", 9, { 수임비: 1 }),
    ).rejects.toThrow("반영되지 않았어요");
    expect(upsertSheetRow).toHaveBeenCalledTimes(2);
  });

  it("④ DB 미설정 — no-op(호출 0)", async () => {
    dbEnabled.mockReturnValue(false);
    await upsertContractRowToDbSync("sheet-1", 9, { 수임비: 1 });
    expect(upsertSheetRow).not.toHaveBeenCalled();
  });

  it("⑤ owner 역조회 실패 — '?'/'' 로 진행", async () => {
    findOwnerBySpreadsheetId.mockRejectedValue(new Error("registry down"));
    await upsertContractRowToDbSync("sheet-1", 9, { 수임비: 1 });
    expect(upsertSheetRow).toHaveBeenCalledWith(
      expect.objectContaining({ cohort: "?", email: "", rowKey: "r9" }),
    );
  });
});

describe("persistContractRow (라우터 — 불변식 1: 비파일럿=미러 no-throw)", () => {
  it("syncDb:true(파일럿) → DB 동기 upsert 경로(2회 실패=throw), 미러 미사용", async () => {
    upsertSheetRow.mockRejectedValue(new Error("down"));
    await expect(
      persistContractRow("sheet-1", 9, { 수임비: 1 }, { syncDb: true }),
    ).rejects.toThrow("반영되지 않았어요");
    expect(mirrorSheetRow).not.toHaveBeenCalled();
  });

  it("syncDb:false(비파일럿) → 미러(async fire-forget) 경로, 동기 upsert 미사용·throw 없음", async () => {
    await expect(
      persistContractRow("sheet-1", 9, { 수임비: 1 }, { syncDb: false }),
    ).resolves.toBeUndefined();
    expect(mirrorSheetRow).toHaveBeenCalledWith({
      spreadsheetId: "sheet-1",
      tab: "contracts",
      rowKey: "r9",
      payload: { 수임비: 1 },
    });
    expect(upsertSheetRow).not.toHaveBeenCalled();
  });

  it("opts 생략 → 미러 경로(비파일럿 기본, throw 없음)", async () => {
    await expect(persistContractRow("sheet-1", 9, { 수임비: 1 })).resolves.toBeUndefined();
    expect(mirrorSheetRow).toHaveBeenCalledTimes(1);
    expect(upsertSheetRow).not.toHaveBeenCalled();
  });
});

describe("clearContractRowInDbSync (공유 코어 회귀 — 기존 동작 불변)", () => {
  it("_cleared:true 병합 + 삭제 문구 throw 유지", async () => {
    await clearContractRowInDbSync("sheet-1", 7);
    expect(upsertSheetRow).toHaveBeenCalledWith(
      expect.objectContaining({ rowKey: "r7", payload: { _cleared: true } }),
    );
    upsertSheetRow.mockRejectedValue(new Error("down"));
    await expect(clearContractRowInDbSync("sheet-1", 7)).rejects.toThrow(
      "삭제가 화면 데이터에 아직 반영되지 않았어요",
    );
  });
});
