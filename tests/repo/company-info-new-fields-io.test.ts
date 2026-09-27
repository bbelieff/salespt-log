/**
 * 업체정보 확장2 — 시트 I/O 회귀 (company-info-new-fields 리뷰 수정, 2026-09-28).
 *  ① 04 읽기 경로는 grid 를 넓히지 않는다 — BN 범위 초과 400 이면 A:AS 로 폴백
 *  ② 이월: 이전 시트가 45~46열이어도 AQ~AS 값은 살아남는다(AQ:BN 실패 → AQ:AS 재읽기)
 *  ③ 이월: 주민등록번호(BA)는 DB payload·아레나 시트 모두 앞 6자리만
 *  ④ 이월 시트 쓰기: 확장 열 문자열에 apostrophe — USER_ENTERED 날짜·숫자 오변환 방지
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const valuesGet = vi.fn();
const valuesBatchUpdate = vi.fn();
const spreadsheetsGet = vi.fn();
const ensureGridColumns = vi.fn(async () => {});
const mirrorSheetRow = vi.fn();

vi.mock("@/repo/sheets-client", () => ({
  sheetsClient: () => ({
    spreadsheets: {
      get: (...a: unknown[]) => spreadsheetsGet(...a),
      values: {
        get: (...a: unknown[]) => valuesGet(...a),
        batchUpdate: (...a: unknown[]) => valuesBatchUpdate(...a),
      },
    },
  }),
  ensureGridColumns: (...a: unknown[]) => ensureGridColumns(...(a as [])),
}));
vi.mock("@/repo/db/mirror", () => ({
  mirrorSheetRow: (...a: unknown[]) => mirrorSheetRow(...a),
  mirrorClearRow: vi.fn(),
}));

import { readAllMeetings, readMeetingRows } from "@/repo/meetings";
import {
  appendCarriedMeeting,
  carriedMeetingPayload,
  listCarrySourceMeetings,
  sanitizeCarryRaw,
} from "@/repo/carryover";
import { COMPANY_EXT2_START, COMPANY_FIELDS_EXT2 } from "@/repo/meetings-rows";

const gridError = () =>
  Object.assign(new Error("Range ('04'!A2:BN) exceeds grid limits. Max columns: 46"), { code: 400 });
const RRN_IDX = COMPANY_EXT2_START + COMPANY_FIELDS_EXT2.indexOf("주민등록번호"); // BA

beforeEach(() => {
  valuesGet.mockReset();
  valuesBatchUpdate.mockReset();
  spreadsheetsGet.mockReset();
  ensureGridColumns.mockClear();
  mirrorSheetRow.mockReset();
});

describe("① 04 읽기 — grid 확장 없이 A:AS 폴백", () => {
  it("BN 범위 초과 400 → A2:AS 로 다시 읽고, grid 는 건드리지 않는다", async () => {
    valuesGet.mockRejectedValueOnce(gridError()).mockResolvedValueOnce({ data: { values: [["x"]] } });
    const rows = await readMeetingRows("sid", (last) => `R!A2:${last}`);
    expect(rows).toEqual([["x"]]);
    expect(valuesGet.mock.calls.map((c) => (c[0] as { range: string }).range)).toEqual([
      "R!A2:BN",
      "R!A2:AS",
    ]);
    expect(ensureGridColumns).not.toHaveBeenCalled();
    expect(spreadsheetsGet).not.toHaveBeenCalled();
  });

  it("grid 외 오류는 그대로 던진다(폴백 없음)", async () => {
    valuesGet.mockRejectedValueOnce(Object.assign(new Error("quota"), { code: 429 }));
    await expect(readMeetingRows("sid", (l) => `R!A2:${l}`)).rejects.toThrow("quota");
    expect(valuesGet).toHaveBeenCalledTimes(1);
  });

  it("readAllMeetings 도 읽기 전에 grid 를 넓히지 않는다", async () => {
    valuesGet.mockResolvedValueOnce({ data: { values: [] } });
    await readAllMeetings("sid");
    expect(ensureGridColumns).not.toHaveBeenCalled();
    expect(spreadsheetsGet).not.toHaveBeenCalled();
  });
});

describe("② 이월 원본 읽기 — 46열 이전 시트", () => {
  it("AQ2:BN 이 범위 초과면 AQ2:AS 로 다시 읽어 AQ~AS 값을 살린다", async () => {
    const base = Array.from({ length: 40 }, () => "");
    base[0] = "m-old-1";
    base[9] = "예약";
    valuesGet.mockImplementation(async ({ range }: { range: string }) => {
      if (range.endsWith("!A2:AN")) return { data: { values: [base] } };
      if (range.endsWith("!AQ2:BN")) throw gridError();
      if (range.endsWith("!AQ2:AS")) return { data: { values: [["88.01.24", "24' 148백만", "23' 70백만"]] } };
      throw new Error(`unexpected ${range}`);
    });
    const [src] = await listCarrySourceMeetings("old");
    expect(src!.raw[42]).toBe("88.01.24");
    expect(src!.raw[44]).toBe("23' 70백만");
  });
});

describe("③④ 이월 쓰기 — 주민등록번호 앞자리 · apostrophe", () => {
  const raw = Array.from({ length: 66 }, () => "" as unknown);
  raw[0] = "m-old-1";
  raw[1] = "예시상사";
  raw[42] = "1988-01-24"; // 대표자생년월일 — USER_ENTERED 면 날짜로 바뀔 문자열
  raw[RRN_IDX] = "800101-1234567"; // 이전 시트에 직접 친 전체 번호
  raw[COMPANY_EXT2_START + COMPANY_FIELDS_EXT2.indexOf("부채비율")] = "120%";
  const src = { 원본id: "m-old-1", raw };

  it("sanitizeCarryRaw/carriedMeetingPayload — BA 는 NNNNNN- 만", () => {
    expect(sanitizeCarryRaw(raw)[RRN_IDX]).toBe("800101-");
    const p = carriedMeetingPayload(src, "new-1");
    expect(p.BA).toBe("800101-");
    expect(JSON.stringify(p)).not.toContain("1234567");
  });

  it("appendCarriedMeeting — 시트 BA·미러 payload 모두 뒷자리 없음, 확장 문자열은 ' 접두", async () => {
    valuesGet.mockResolvedValue({ data: { values: [["m-a"]] } }); // A2:A → 다음 빈 행 3
    await appendCarriedMeeting("arena", src, "new-1");
    const body = valuesBatchUpdate.mock.calls[0]![0] as {
      requestBody: { valueInputOption: string; data: { range: string; values: unknown[][] }[] };
    };
    expect(JSON.stringify(body)).not.toContain("1234567");
    const aq = body.requestBody.data.find((d) => d.range.endsWith("!AQ3:AS3"))!;
    expect(aq.values[0]![0]).toBe("'1988-01-24");
    expect(aq.values[0]![1]).toBe(""); // 빈 칸은 접두 없음
    const au = body.requestBody.data.find((d) => d.range.endsWith("!AU3:BN3"))!;
    expect(au.values[0]![RRN_IDX - COMPANY_EXT2_START]).toBe("'800101-");
    expect(au.values[0]![COMPANY_FIELDS_EXT2.indexOf("부채비율")]).toBe("'120%");
    const payload = mirrorSheetRow.mock.calls[0]![0] as { payload: Record<string, unknown> };
    expect(payload.payload.BA).toBe("800101-");
  });
});
