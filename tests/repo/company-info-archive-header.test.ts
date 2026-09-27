/**
 * 06 업체정보 헤더 보강 (company-info-new-fields) — 확장 전 탭(A~AB 28열 헤더)에 AC~AV 라벨을
 * **빈 셀에만** 쓰고, 사용자가 이미 적은 헤더 문구는 덮지 않는다(§2.5). grid 는 48열(AV) 보장.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const valuesGet = vi.fn();
const valuesUpdate = vi.fn();
const valuesBatchUpdate = vi.fn();
const spreadsheetsGet = vi.fn();
const ensureGridColumns = vi.fn(async () => {});

vi.mock("@/repo/db/client", () => ({ dbEnabled: () => false }));
vi.mock("@/repo/db/company-archive-sync", () => ({
  persistCompanyArchiveRow: vi.fn(),
  persistCompanyArchiveRename: vi.fn(),
  readCompanyArchiveRowPayload: vi.fn(),
}));
vi.mock("@/repo/db/mirror-pending", () => ({
  markMirrorPending: vi.fn(),
  clearMirrorPending: vi.fn(),
  listMirrorPending: vi.fn(async () => []),
}));
vi.mock("@/lib/analytics/api-timing", () => ({ captureServerEvent: vi.fn() }));
vi.mock("@/repo/sheets-client", () => ({
  sheetsClient: () => ({
    spreadsheets: {
      get: (...a: unknown[]) => spreadsheetsGet(...a),
      batchUpdate: vi.fn(),
      values: {
        get: (...a: unknown[]) => valuesGet(...a),
        update: (...a: unknown[]) => valuesUpdate(...a),
        batchUpdate: (...a: unknown[]) => valuesBatchUpdate(...a),
      },
    },
  }),
  ensureGridColumns: (...a: unknown[]) => ensureGridColumns(...(a as [])),
}));

import { ARCHIVE_ROW_WIDTH, ensureCompanyInfoTab } from "@/repo/company-info-archive";

beforeEach(() => {
  for (const m of [valuesGet, valuesUpdate, valuesBatchUpdate, spreadsheetsGet, ensureGridColumns]) {
    m.mockClear();
  }
  spreadsheetsGet.mockResolvedValue({ data: { sheets: [{ properties: { title: "06 업체정보" } }] } });
});

describe("06 헤더 보강 — 빈 셀에만", () => {
  it("28열 헤더 + 사용자가 AD1 에 쓴 문구 → AC·AE~AV 만 채움, AD 보존", async () => {
    const header = Array(28).fill("h");
    header[29] = "내가 적은 제목"; // AD1
    valuesGet.mockResolvedValue({ data: { values: [header] } });
    await ensureCompanyInfoTab("sheet-hdr-1");

    expect(ARCHIVE_ROW_WIDTH).toBe(48);
    expect(ensureGridColumns).toHaveBeenCalledWith("sheet-hdr-1", "06 업체정보", 48);
    expect(valuesUpdate).not.toHaveBeenCalled(); // 헤더 전체 덮어쓰기 없음
    const data = valuesBatchUpdate.mock.calls[0]![0].requestBody.data as {
      range: string;
      values: string[][];
    }[];
    const ranges = data.map((d) => d.range);
    expect(ranges).toContain("'06 업체정보'!AC1");
    expect(ranges).not.toContain("'06 업체정보'!AD1");
    expect(ranges).toContain("'06 업체정보'!AV1");
    expect(data).toHaveLength(19);
    expect(data.find((d) => d.range.endsWith("!AC1"))!.values).toEqual([["과세유형"]]);
  });

  it("헤더가 이미 다 있으면 쓰기 없음", async () => {
    valuesGet.mockResolvedValue({ data: { values: [Array(48).fill("h")] } });
    await ensureCompanyInfoTab("sheet-hdr-2");
    expect(valuesBatchUpdate).not.toHaveBeenCalled();
    expect(valuesUpdate).not.toHaveBeenCalled();
  });

  it("빈 탭(A1 없음)은 전체 헤더 48칸을 한 번에", async () => {
    valuesGet.mockResolvedValue({ data: { values: [] } });
    await ensureCompanyInfoTab("sheet-hdr-3");
    const values = valuesUpdate.mock.calls[0]![0].requestBody.values as string[][];
    expect(values[0]).toHaveLength(48);
    expect(values[0]![28]).toBe("과세유형");
    expect(values[0]![47]).toBe("매출증가율");
  });
});
