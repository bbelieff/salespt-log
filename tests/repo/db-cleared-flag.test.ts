/**
 * critic-2 회귀 — 03 행 삭제 후 같은 시트 행 재추가 시 DB 의 _cleared:true 가 병합에 잔존해
 * 재추가 행이 파일럿 화면(readDbTabFromDb 의 _cleared=false 필터)에서 사라지는 사고 방지.
 * 수정: append + update 의 DB payload 는 항상 _cleared:false 를 포함해 재추가/편집이 행을 부활시킨다.
 * 실제 db.ts 함수를 호출(sheets-client 스텁) → mirror/persist 로 넘어가는 payload 를 검증.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DBPurchase } from "@/types";

const valuesGet = vi.fn(async () => ({ data: { values: [[]] } })); // 첫 데이터행 = phantom(빈) → row=FIRST_DATA_ROW
const valuesUpdate = vi.fn(async () => ({}));
const valuesClear = vi.fn(async () => ({}));
const mirrorSheetRow = vi.fn();
const persistDbRow = vi.fn();
const clearDbRow = vi.fn();

vi.mock("@/repo/sheets-client", () => ({
  sheetsClient: () => ({
    spreadsheets: { values: { get: valuesGet, update: valuesUpdate, clear: valuesClear } },
  }),
}));
vi.mock("@/repo/db/mirror", () => ({
  mirrorSheetRow: (...a: unknown[]) => mirrorSheetRow(...(a as [])),
  mirrorClearRow: vi.fn(),
}));
vi.mock("@/repo/db/db-tab-sync", () => ({
  persistDbRow: (...a: unknown[]) => persistDbRow(...(a as [])),
  clearDbRow: (...a: unknown[]) => clearDbRow(...(a as [])),
}));

import { appendPurchase, updatePurchase } from "@/repo/db";

const P: DBPurchase = {
  구매일: "2026-07-10", 업체명: "가나", 개당단가: 1000, 주문개수: 3,
  주문금액: 3000, 기타: "", 부가세여부: false,
};

beforeEach(() => {
  valuesGet.mockReset().mockResolvedValue({ data: { values: [[]] } });
  valuesUpdate.mockReset().mockResolvedValue({});
  mirrorSheetRow.mockReset();
  persistDbRow.mockReset();
  clearDbRow.mockReset();
});

describe("_cleared:false 부활 플래그", () => {
  it("appendPurchase → 미러 payload 에 _cleared:false 포함(재추가 부활)", async () => {
    await appendPurchase("sheet-1", P);
    expect(mirrorSheetRow).toHaveBeenCalledTimes(1);
    const arg = mirrorSheetRow.mock.calls[0]?.[0] as { payload: Record<string, unknown> };
    expect(arg.payload._cleared).toBe(false);
    expect(arg.payload.업체명).toBe("가나");
  });

  it("updatePurchase → persistDbRow payload 에 _cleared:false 포함(편집도 부활)", async () => {
    await updatePurchase("sheet-1", 9, P, { syncDb: true });
    expect(persistDbRow).toHaveBeenCalledTimes(1);
    const [sid, rowKey, payload, opts] = persistDbRow.mock.calls[0] as [
      string, string, Record<string, unknown>, { syncDb?: boolean },
    ];
    expect(sid).toBe("sheet-1");
    expect(rowKey).toBe("매입DB:r9");
    expect(payload._cleared).toBe(false);
    expect(opts).toEqual({ syncDb: true });
  });
});
