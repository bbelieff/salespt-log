/**
 * 삭제의 DB 동기 반영 (Dev3-A 작업1 — 조용한 반쪽 삭제 금지) 회귀:
 *  ① 성공 시 _cleared upsert 1회 ② 1회 실패 → 재시도로 성공 ③ 2회 실패 → 사용자 에러 throw
 *  ④ dbEnabled=false → no-op ⑤ owner 조회 실패해도 upsert 는 진행("?"/"")
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertSheetRow = vi.fn();
const dbEnabled = vi.fn(() => true);
const findOwnerBySpreadsheetId = vi.fn(async () => ({ cohort: "8", email: "u@x.y" }));

vi.mock("@/repo/db/client", () => ({
  dbEnabled: (...a: unknown[]) => dbEnabled(...(a as [])),
  upsertSheetRow: (...a: unknown[]) => upsertSheetRow(...(a as [])),
}));
vi.mock("@/repo/users", () => ({
  findOwnerBySpreadsheetId: (...a: unknown[]) =>
    findOwnerBySpreadsheetId(...(a as [])),
}));

import { clearContractRowInDbSync } from "@/repo/db/contracts-clear";

beforeEach(() => {
  upsertSheetRow.mockReset().mockResolvedValue({ skipped: false });
  dbEnabled.mockReset().mockReturnValue(true);
  findOwnerBySpreadsheetId
    .mockReset()
    .mockResolvedValue({ cohort: "8", email: "u@x.y" });
});

describe("clearContractRowInDbSync", () => {
  it("① 성공 — _cleared 마킹을 spreadsheet_id+row_key 로 1회 upsert", async () => {
    await clearContractRowInDbSync("sheet-1", 7);
    expect(upsertSheetRow).toHaveBeenCalledTimes(1);
    expect(upsertSheetRow).toHaveBeenCalledWith({
      cohort: "8",
      email: "u@x.y",
      spreadsheetId: "sheet-1",
      tab: "contracts",
      rowKey: "r7",
      payload: { _cleared: true },
    });
  });

  it("② 1회 실패 후 재시도 성공 — throw 없음", async () => {
    upsertSheetRow
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce({ skipped: false });
    await expect(clearContractRowInDbSync("sheet-1", 7)).resolves.toBeUndefined();
    expect(upsertSheetRow).toHaveBeenCalledTimes(2);
  });

  it("③ 2회 연속 실패 — 사용자 에러 throw (반쪽 삭제 금지)", async () => {
    upsertSheetRow.mockRejectedValue(new Error("down"));
    await expect(clearContractRowInDbSync("sheet-1", 7)).rejects.toThrow(
      "반영되지 않았어요",
    );
    expect(upsertSheetRow).toHaveBeenCalledTimes(2);
  });

  it("④ DB 미설정 환경 — no-op", async () => {
    dbEnabled.mockReturnValue(false);
    await clearContractRowInDbSync("sheet-1", 7);
    expect(upsertSheetRow).not.toHaveBeenCalled();
  });

  it("⑤ owner 조회 실패 — '?'/'' 로 진행 (미러와 동일 규칙)", async () => {
    findOwnerBySpreadsheetId.mockRejectedValue(new Error("registry down"));
    await clearContractRowInDbSync("sheet-1", 7);
    expect(upsertSheetRow).toHaveBeenCalledWith(
      expect.objectContaining({ cohort: "?", email: "", rowKey: "r7" }),
    );
  });
});
