/**
 * R3-3 잔여 — `clearRowByLink` 의 파일럿 DB-first 순서 계약.
 *
 * 왜 순서를 뒤집나: 이 함수의 키는 (계약일, 업체명) 뿐이다. 시트를 먼저 지우면 DB 동기가 실패했을 때
 * 다음 시도에서 `findRowByLink` 가 행을 못 찾아 **DB 의 유령 계약을 영원히 못 지운다**(치유 불가).
 * 그래서 파일럿은 DB `_cleared` 를 먼저 확정하고, 성공했을 때만 시트를 지운다.
 *  · DB 실패 → 시트 무변경 + throw → 재시도가 그대로 성립(멱등)
 *  · DB 성공·시트 실패 → 정본(DB)은 정확, 시트 행이 남아 재시도가 수렴
 * 비파일럿(시트 정본 + async 미러)은 기존 동작 그대로.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const clearContractRowInDbSync = vi.fn(async () => {});
const valuesClear = vi.fn(async () => ({}));
const mirrorClearRow = vi.fn();
const order: string[] = [];

vi.mock("@/repo/db/contracts-clear", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/repo/db/contracts-clear")>();
  return {
    ...actual,
    clearContractRowInDbSync: (...a: unknown[]) => {
      order.push("db");
      return clearContractRowInDbSync(...(a as []));
    },
  };
});
vi.mock("@/repo/sheets-client", () => ({
  sheetsClient: () => ({
    spreadsheets: {
      get: async () => ({ data: { sheets: [{ properties: { title: "02 계약수납관리" } }] } }),
      values: {
        get: async () => ({
          // C(계약일)·D(업체명) — firstDataRow 부터. ISO 문자열은 serialToISODate 가 그대로 통과시킨다.
          data: { values: [["2026-07-10", "가나상사"]] },
        }),
        clear: (...a: unknown[]) => {
          order.push("sheet");
          return valuesClear(...(a as []));
        },
        update: vi.fn(async () => ({})),
        batchUpdate: vi.fn(async () => ({})),
      },
    },
  }),
  ensureGridColumns: vi.fn(async () => {}),
}));
vi.mock("@/repo/db/mirror", () => ({
  mirrorSheetRow: vi.fn(),
  mirrorClearRow: (...a: unknown[]) => mirrorClearRow(...(a as [])),
}));

import { clearRowByLink } from "@/repo/contract-payment";

const SHEET = "sheet-1";
const 계약일 = "2026-07-10";
const 업체명 = "가나상사";

beforeEach(() => {
  order.length = 0;
  clearContractRowInDbSync.mockReset();
  clearContractRowInDbSync.mockResolvedValue(undefined);
  valuesClear.mockReset();
  valuesClear.mockResolvedValue({});
  mirrorClearRow.mockReset();
});

describe("파일럿({syncDb:true})", () => {
  it("DB _cleared 를 시트 clear 보다 **먼저** 쓴다", async () => {
    const row = await clearRowByLink(SHEET, 계약일, 업체명, { syncDb: true });
    expect(row).not.toBeNull();
    expect(clearContractRowInDbSync).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["db", "sheet"]);
  });

  it("DB 실패 시 **시트를 건드리지 않고** throw (재시도 성립)", async () => {
    clearContractRowInDbSync.mockRejectedValueOnce(new Error("db down"));
    await expect(clearRowByLink(SHEET, 계약일, 업체명, { syncDb: true })).rejects.toThrow("db down");
    expect(valuesClear).not.toHaveBeenCalled();
    expect(order).toEqual(["db"]);
  });
});

describe("비파일럿(opts 없음 / {syncDb:false}) — 기존 동작 불변", () => {
  it("DB 동기 호출 0회, 시트만 clear + async 미러", async () => {
    await clearRowByLink(SHEET, 계약일, 업체명);
    expect(clearContractRowInDbSync).not.toHaveBeenCalled();
    expect(order).toEqual(["sheet"]);
    expect(mirrorClearRow).toHaveBeenCalledWith(
      expect.objectContaining({ tab: "contracts", spreadsheetId: SHEET }),
    );
  });

  it("{syncDb:false} 도 동일", async () => {
    await clearRowByLink(SHEET, 계약일, 업체명, { syncDb: false });
    expect(clearContractRowInDbSync).not.toHaveBeenCalled();
    expect(order).toEqual(["sheet"]);
  });
});

describe("매칭 행 없음", () => {
  it("null 반환 — 시트·DB 어느 쪽도 쓰지 않는다", async () => {
    const row = await clearRowByLink(SHEET, "2026-01-01", "없는업체", { syncDb: true });
    expect(row).toBeNull();
    expect(order).toEqual([]);
  });
});
