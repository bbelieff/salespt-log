import { beforeEach, describe, expect, it, vi } from "vitest";

const { batchGet, get, batchUpdate } = vi.hoisted(() => ({
  batchGet: vi.fn(),
  get: vi.fn(),
  batchUpdate: vi.fn(),
}));

vi.mock("@/repo/sheets-client", () => ({
  sheetsClient: () => ({
    spreadsheets: {
      values: { batchGet, get, batchUpdate },
    },
  }),
}));

import { installFormulas } from "@/repo/setup-formulas";

function valuesForRange(range: string): unknown[][] {
  if (range.endsWith("!M3:M5")) return [["manual M3"], ["=old M4"], [0]];
  if (range.endsWith("!D3:D4")) return [["manual D3"], ["=old D4"]];
  if (range.endsWith("!O5")) return [[true]];
  return [];
}

describe("installFormulas pre-read batching", () => {
  beforeEach(() => {
    batchGet.mockReset().mockImplementation(({ ranges }: { ranges: string[] }) =>
      Promise.resolve({
        data: {
          valueRanges: ranges.map((range) => ({
            range,
            values: valuesForRange(range),
          })),
        },
      }),
    );
    get.mockReset().mockImplementation(({ range }: { range: string }) =>
      Promise.resolve({ data: { values: valuesForRange(range) } }),
    );
    batchUpdate.mockReset().mockResolvedValue({ data: {} });
  });

  it("uses one FORMULA batchGet for every guarded range and preserves raw header values", async () => {
    const report = await installFormulas("sheet-1");

    expect(batchGet).toHaveBeenCalledTimes(1);
    expect(get).not.toHaveBeenCalled();
    expect(batchGet).toHaveBeenCalledWith({
      spreadsheetId: "sheet-1",
      ranges: [
        "'04 업체관리(앱자동작성용)'!N2:N1000",
        "'04 업체관리(앱자동작성용)'!O2:O1000",
        "'04 업체관리(앱자동작성용)'!Q2:Q1000",
        "'01 영업관리'!I10:P275",
        "'01 영업관리'!D10:D275",
        "'01 영업관리'!M3:M5",
        "'01 영업관리'!R4:U5",
        "'01 영업관리'!F4:F5",
        "'02 계약수납관리'!D3:D4",
        "'01 영업관리'!O5",
      ],
      valueRenderOption: "FORMULA",
    });

    expect(batchUpdate).toHaveBeenCalledTimes(1);
    const request = batchUpdate.mock.calls[0]![0] as {
      requestBody: { data: Array<{ range: string }> };
    };
    const writtenRanges = request.requestBody.data.map(({ range }) => range);

    expect(writtenRanges).not.toContain("'01 영업관리'!M3");
    expect(writtenRanges).toContain("'01 영업관리'!M4");
    expect(writtenRanges).not.toContain("'01 영업관리'!M5");
    expect(writtenRanges).not.toContain("'02 계약수납관리'!D3");
    expect(writtenRanges).toContain("'02 계약수납관리'!D4");
    expect(writtenRanges).not.toContain("'01 영업관리'!O5");
    expect(report.preservedCells).toEqual(
      expect.arrayContaining([
        "영업관리 M3",
        "영업관리 M5",
        "02 계약수납 D3",
        "영업관리 O5",
      ]),
    );
  });
});
