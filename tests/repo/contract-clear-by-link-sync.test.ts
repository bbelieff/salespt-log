/**
 * BBE-246 — `clearRowByLink` 의 파일럿 DB-only 계약(요청 경로에서 시트 동기 호출 제거).
 *
 * 이전(R3-3): 파일럿은 DB `_cleared` 를 먼저 확정한 뒤 시트도 같은 요청 안에서 동기로 지웠다
 * ("DB-first" — 시트를 먼저 지우면 DB 실패 시 다음 재시도가 findRowByLink 로 행을 못 찾아
 * 유령 계약을 영원히 못 지우는 문제 때문이었다).
 *
 * 이후(BBE-246): 파일럿은 **DB 만** 동기로 확정하고 반환한다 — 시트는 `queueContractRowSync`
 * 에 큐잉되어 응답 이후 비동기로 수렴한다(contract-sheet-sync.ts). clearRow 자체가 이 분기를
 * 전담하므로(clearRow 테스트 참고) 이 함수는 그저 위임한다. "DB 먼저" 라는 순서 문제 자체가
 * 소멸했다 — 시트가 같은 요청 안에서 "먼저/나중" 일 수가 없다(아예 안 건드리므로).
 * 비파일럿(시트 정본 + async 미러)은 기존 동작 그대로.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const clearContractRowInDbSync = vi.fn(async () => {});
const valuesClear = vi.fn(async () => ({}));
const mirrorClearRow = vi.fn();
const queueContractRowSync = vi.fn();
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
vi.mock("@/repo/contract-sheet-sync", () => ({
  queueContractRowSync: (...a: unknown[]) => {
    order.push("queue");
    return queueContractRowSync(...(a as []));
  },
}));
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
  queueContractRowSync.mockReset();
});

describe("파일럿({syncDb:true})", () => {
  it("DB _cleared 만 동기로 확정 — 시트는 건드리지 않고 큐잉만 한다", async () => {
    const row = await clearRowByLink(SHEET, 계약일, 업체명, { syncDb: true });
    expect(row).not.toBeNull();
    expect(clearContractRowInDbSync).toHaveBeenCalledTimes(1);
    expect(valuesClear).not.toHaveBeenCalled();
    expect(queueContractRowSync).toHaveBeenCalledWith(SHEET, row);
    expect(order).toEqual(["db", "queue"]);
  });

  it("DB 실패 시 **시트도 큐도 건드리지 않고** throw (재시도 성립)", async () => {
    clearContractRowInDbSync.mockRejectedValueOnce(new Error("db down"));
    await expect(clearRowByLink(SHEET, 계약일, 업체명, { syncDb: true })).rejects.toThrow("db down");
    expect(valuesClear).not.toHaveBeenCalled();
    expect(queueContractRowSync).not.toHaveBeenCalled();
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
