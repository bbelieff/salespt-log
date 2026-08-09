/**
 * BBE-61(R3-4b) — writeProductionCountCell(db-production-cell.ts) 의 syncDb 게이트.
 *  · opts.syncDb=true(파일럿) → mirrorSheetRowAwaitable 로 **기다린다**(non-throw)
 *  · opts 생략/false(비파일럿) → 기존 mirrorSheetRow(fire-and-forget) 불변
 *  · 양쪽 다 resolveWriteKey 로 현재 매핑 키를 조회해서 씀(BBE-59 유령행 방지 유지)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const valuesUpdate = vi.fn(async () => ({}));
const mirrorSheetRow = vi.fn();
const mirrorSheetRowAwaitable = vi.fn(async () => true);
const resolveWriteKey = vi.fn(async (_sid: string, section: string, row: number) => `${section}:resolved-${row}`);

vi.mock("@/repo/sheets-client", () => ({
  sheetsClient: () => ({ spreadsheets: { values: { update: valuesUpdate } } }),
}));
vi.mock("@/repo/db/mirror", () => ({
  mirrorSheetRow: (...a: unknown[]) => mirrorSheetRow(...(a as [])),
  mirrorSheetRowAwaitable: (...a: unknown[]) => mirrorSheetRowAwaitable(...(a as [])),
}));
vi.mock("@/repo/db/row-key", () => ({
  resolveWriteKey: (...a: Parameters<typeof resolveWriteKey>) => resolveWriteKey(...a),
}));

import { writeProductionCountCell } from "@/repo/db-production-cell";

beforeEach(() => {
  valuesUpdate.mockReset().mockResolvedValue({});
  mirrorSheetRow.mockReset();
  mirrorSheetRowAwaitable.mockReset().mockResolvedValue(true);
  resolveWriteKey.mockReset().mockImplementation(
    async (_sid: string, section: string, row: number) => `${section}:resolved-${row}`,
  );
});

describe("writeProductionCountCell — syncDb 게이트(BBE-61)", () => {
  it("syncDb:true — mirrorSheetRowAwaitable 로 await, fire-and-forget 미사용", async () => {
    await writeProductionCountCell("sheet-1", 5, 12, { syncDb: true });
    expect(resolveWriteKey).toHaveBeenCalledWith("sheet-1", "직접생산", 5);
    expect(mirrorSheetRowAwaitable).toHaveBeenCalledWith({
      spreadsheetId: "sheet-1", tab: "db", rowKey: "직접생산:resolved-5", payload: { 생산개수: 12 },
    });
    expect(mirrorSheetRow).not.toHaveBeenCalled();
  });

  it("syncDb:true 인데 DB 반영이 실패해도(awaitable=false) throw 없음 — 시트 셀 쓰기는 이미 완료", async () => {
    mirrorSheetRowAwaitable.mockResolvedValue(false);
    await expect(writeProductionCountCell("sheet-1", 5, 12, { syncDb: true })).resolves.toBeUndefined();
    expect(valuesUpdate).toHaveBeenCalledTimes(1); // 시트 쓰기는 DB 결과와 무관하게 이미 성공
  });

  it("opts 생략 — 기존 mirrorSheetRow(fire-and-forget) 경로, awaitable 미사용", async () => {
    await writeProductionCountCell("sheet-1", 5, 12);
    expect(mirrorSheetRow).toHaveBeenCalledWith({
      spreadsheetId: "sheet-1", tab: "db", rowKey: "직접생산:resolved-5", payload: { 생산개수: 12 },
    });
    expect(mirrorSheetRowAwaitable).not.toHaveBeenCalled();
  });

  it("syncDb:false 명시 — opts 생략과 동일(fire-and-forget)", async () => {
    await writeProductionCountCell("sheet-1", 7, 3, { syncDb: false });
    expect(mirrorSheetRow).toHaveBeenCalledWith({
      spreadsheetId: "sheet-1", tab: "db", rowKey: "직접생산:resolved-7", payload: { 생산개수: 3 },
    });
    expect(mirrorSheetRowAwaitable).not.toHaveBeenCalled();
  });
});
