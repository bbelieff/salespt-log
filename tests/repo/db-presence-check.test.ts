/**
 * BBE-259 — 03 DB관리 4섹션 저비용 존재확인(readXFilledRows, BBE-248/#824 이식) 회귀.
 *
 * 각 섹션의 "의미있음" 판정에 필요한 최소 열만 읽어(전체 섹션 열 대비 축소) 채워진 row
 * 번호 집합을 얻는다 — 판정 로직(phantomX)은 findFirstEmptyRow 가 이미 쓰는 것과 동일해
 * read/append 양쪽이 "빈 행" 기준을 공유한다(드리프트 불가).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const valuesGet = vi.fn(async () => ({ data: { values: [] as unknown[][] } }));

vi.mock("@/repo/sheets-client", () => ({
  sheetsClient: () => ({ spreadsheets: { values: { get: valuesGet } } }),
}));
vi.mock("@/repo/db/mirror", () => ({ mirrorSheetRow: vi.fn() }));
vi.mock("@/repo/db-tab-append-mirror", () => ({ mirrorDbTabRowDurable: vi.fn() }));
vi.mock("@/repo/db/row-key", () => ({ mintRowKey: vi.fn(() => "x:uuid") }));

import {
  readBannerFilledRows,
  readLeadFilledRows,
  readProductionFilledRows,
  readPurchaseFilledRows,
} from "@/repo/db";

const TAB = "'03 DB관리'";

beforeEach(() => {
  valuesGet.mockReset().mockResolvedValue({ data: { values: [] as unknown[][] } });
});

describe("readPurchaseFilledRows — B열 1개만 probe (전체 B:H 7열 대비)", () => {
  it("범위: B4:B100 (전체 섹션 대비 1열)", async () => {
    await readPurchaseFilledRows("sheet-1");
    expect(valuesGet).toHaveBeenCalledWith(
      expect.objectContaining({ spreadsheetId: "sheet-1", range: `${TAB}!B4:B100` }),
    );
  });

  it("날짜(ISO) 있는 행만 채워짐으로 판정, 합계 행·빈 행 제외", async () => {
    valuesGet.mockResolvedValue({
      data: { values: [["2026-07-10"], [""], ["합계"], ["2026-07-12"]] },
    });
    const rows = await readPurchaseFilledRows("sheet-1");
    expect(rows).toEqual(new Set([4, 7])); // firstDataRow=4 → i=0,3 → row 4,7
  });
});

describe("readProductionFilledRows — I열 1개만 probe (전체 I:O 7열 대비)", () => {
  it("범위: I4:I100", async () => {
    await readProductionFilledRows("sheet-1");
    expect(valuesGet).toHaveBeenCalledWith(
      expect.objectContaining({ range: `${TAB}!I4:I100` }),
    );
  });
});

describe("readBannerFilledRows — P열 1개만 probe (전체 P:W 8열 대비)", () => {
  it("범위: P4:P100", async () => {
    await readBannerFilledRows("sheet-1");
    expect(valuesGet).toHaveBeenCalledWith(
      expect.objectContaining({ range: `${TAB}!P4:P100` }),
    );
  });
});

describe("readLeadFilledRows — X:AC 6열 probe (전체 X:AD 7열 대비, 판정열이 흩어져 있어 절감폭 작음)", () => {
  it("범위: X4:AC100 (AD=조건 만 제외)", async () => {
    await readLeadFilledRows("sheet-1");
    expect(valuesGet).toHaveBeenCalledWith(
      expect.objectContaining({ range: `${TAB}!X4:AC100` }),
    );
  });

  it("대표자명(Z)·업체명(AA)·연락처(AC) 중 하나라도 있으면 채워짐 — 나머지 3열은 빈값이어도 무관", async () => {
    valuesGet.mockResolvedValue({
      data: {
        values: [
          ["전화", "2026-07-10", "김대표", "", "", ""], // Z(idx2)=대표자명 있음
          ["", "", "", "", "", ""], // 전부 빈값 — phantom
          ["전화", "", "", "", "", "010-1234"], // AC(idx5)=연락처 있음
        ],
      },
    });
    const rows = await readLeadFilledRows("sheet-1");
    expect(rows).toEqual(new Set([4, 6])); // row 5(i=1)는 phantom 이라 제외
  });
});
