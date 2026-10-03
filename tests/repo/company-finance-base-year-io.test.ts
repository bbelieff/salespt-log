/**
 * 매출기준연도(확장4) 저장 좌표·경로 (company-finance-won-grid, belie 2026-09-28) — 04 CD · 06 BL.
 *  ① 스키마 default "" · 04 코덱 CD(81) · 옛 폭(A~CC) 행은 "" · apostrophe(“2026”·“1,234”·“250.1” 이 숫자로 안 바뀜)
 *  ② 04 쓰기: grid 82열 · 헤더 CD1 빈 셀에만 · 행 AU:CD · 읽기 폴백 CD → CC(확장3 값 보존)
 *  ③ 06: BL(63) 미러 · 읽기 · 옛 63열 행은 ""
 *  ④ 이월: DB payload 열문자 CD · 아레나 시트 쓰기 apostrophe · DB 열문자 복원(04 CD · 06 BL)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const valuesGet = vi.fn();
const valuesBatchUpdate = vi.fn();
const valuesUpdate = vi.fn();
const ensureGridColumns = vi.fn(async () => {});
const mirrorSheetRow = vi.fn();

vi.mock("@/repo/sheets-client", () => ({
  sheetsClient: () => ({
    spreadsheets: {
      get: vi.fn(async () => ({ data: { sheets: [{ properties: { title: "06 업체정보" } }] } })),
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
vi.mock("@/repo/db/mirror", () => ({
  mirrorSheetRow: (...a: unknown[]) => mirrorSheetRow(...a),
  mirrorClearRow: vi.fn(),
}));
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

import { CompanyInfo, Meeting } from "@/types";
import {
  COMPANY_EXT3_START,
  COMPANY_EXT4_START,
  COMPANY_FIELDS_EXT2,
  COMPANY_FIELDS_EXT4,
  MEETING_READ_WIDTHS,
  MEETING_ROW_WIDTH,
  meetingToRow,
  rowToMeeting,
  stripUserEnteredEscapes,
} from "@/repo/meetings-rows";
import { appendMeeting, readMeetingRows } from "@/repo/meetings";
import { ARCHIVE_ROW_WIDTH, companyInfoToArchiveRow, readCompanyInfoArchiveRow } from "@/repo/company-info-archive";
import { appendCarriedMeeting, carriedMeetingPayload } from "@/repo/carryover";
import { companyInfoFromDbPayload, meetingFromDbPayload } from "@/repo/db/read-daily";
import { colName } from "@/util/sheet-column";

const BASE = Meeting.parse({
  id: "m-by-001",
  예약일: "2026-09-28",
  예약시각: "10:00",
  미팅날짜: "2026-09-29",
  미팅시간: "14:00",
  channel: "매입DB",
  업체명: "예시상사",
  장소: "본사",
  업체정보: { 대표자이름: "홍길동", 매출Y1상: "250.1", 과년도매출: "1,234", 매출기준연도: "2026" },
});
const userEntered = (row: (string | number | boolean)[]) =>
  row.map((v) => (typeof v === "string" && v.startsWith("'") ? v.slice(1) : v));
const gridError = () => Object.assign(new Error("Range exceeds grid limits. Max columns: 81"), { code: 400 });

beforeEach(() => {
  for (const m of [valuesGet, valuesBatchUpdate, valuesUpdate, mirrorSheetRow]) m.mockReset();
  ensureGridColumns.mockClear();
});

describe("① 스키마 · 04 코덱 CD", () => {
  it("default '' · 확장3(CC) 바로 뒤 CD(81) · 전체 82열", () => {
    expect(CompanyInfo.parse({}).매출기준연도).toBe("");
    expect([...COMPANY_FIELDS_EXT4]).toEqual(["매출기준연도"]);
    expect(COMPANY_EXT4_START).toBe(81);
    expect(colName(COMPANY_EXT4_START)).toBe("CD");
    expect(colName(COMPANY_EXT3_START + 14)).toBe("CC");
    expect(MEETING_ROW_WIDTH).toBe(82);
    expect(MEETING_READ_WIDTHS.map((w) => colName(w - 1))).toEqual(["CD", "CC", "BN", "AS"]);
  });

  it("apostrophe 텍스트 — 연도·백만원 숫자가 숫자로 바뀌지 않게, 라운드트립", () => {
    const row = meetingToRow(BASE);
    expect(row[81]).toBe("'2026");
    expect(row[COMPANY_EXT3_START + 6]).toBe("'250.1"); // 매출Y1상(BU)
    expect(stripUserEnteredEscapes(row)[81]).toBe("2026");
    const back = rowToMeeting(userEntered(row))!;
    expect(back.업체정보!.매출기준연도).toBe("2026");
    expect(back.업체정보!.과년도매출).toBe("1,234");
  });

  it("옛 폭(A~CC 81셀) 행은 매출기준연도 ''", () => {
    const old = rowToMeeting(userEntered(meetingToRow(BASE)).slice(0, 81))!;
    expect(old.업체정보!.매출기준연도).toBe("");
    expect(old.업체정보!.매출Y1상).toBe("250.1");
  });
});

describe("② 04 쓰기·읽기", () => {
  it("appendMeeting: grid 82열, CD1 헤더는 빈 셀에만, 행은 AU:CD", async () => {
    const header = [...COMPANY_FIELDS_EXT2, ...Array(15).fill("h"), "내 제목"]; // CD1 사용자 문구
    valuesGet.mockImplementation(async ({ range }: { range: string }) => {
      if (range.endsWith("!A2:A")) return { data: { values: [["m-a"]] } };
      if (range.endsWith("!AU1:CD1")) return { data: { values: [header] } };
      throw new Error(`unexpected ${range}`);
    });
    await appendMeeting("sheet-by-1", BASE, { mirror: false });
    expect(ensureGridColumns).toHaveBeenCalledWith("sheet-by-1", "04 업체관리(앱자동작성용)", 82);
    const calls = valuesBatchUpdate.mock.calls.map(
      (c) => (c[0] as { requestBody: { data: { range: string; values: unknown[][] }[] } }).requestBody.data,
    );
    // 헤더가 다 차 있으면(사용자 문구 포함) 헤더 쓰기 없음 — 행 쓰기 한 번뿐.
    expect(calls).toHaveLength(1);
    const ext = calls[0]!.find((d) => d.range.endsWith("!AU3:CD3"))!;
    expect(ext.values[0]).toHaveLength(36);
    expect(ext.values[0]![35]).toBe("'2026");
  });

  it("읽기: CD 범위 초과면 A:CC 로 — 확장3 값은 살아 있다(단계를 건너뛰지 않음)", async () => {
    valuesGet.mockRejectedValueOnce(gridError()).mockResolvedValueOnce({ data: { values: [["x"]] } });
    const rows = await readMeetingRows("sid", (last) => `R!A2:${last}`);
    expect(rows).toEqual([["x"]]);
    expect(valuesGet.mock.calls.map((c) => (c[0] as { range: string }).range)).toEqual(["R!A2:CD", "R!A2:CC"]);
    expect(ensureGridColumns).not.toHaveBeenCalled();
  });
});

describe("③ 06 BL", () => {
  it("행 빌더: BL(63) = 매출기준연도, 64열", () => {
    const row = companyInfoToArchiveRow("예시상사", "2026-09-28", BASE.업체정보, "T");
    expect(ARCHIVE_ROW_WIDTH).toBe(64);
    expect(row).toHaveLength(64);
    expect(colName(63)).toBe("BL");
    expect(row[63]).toBe("'2026");
  });

  it("읽기: E~BL 에서 복원, 옛 63열(A~BK) 행은 ''", async () => {
    const full = userEntered(companyInfoToArchiveRow("예시상사", "2026-09-28", BASE.업체정보, "T"));
    const mock = (cells: unknown[]) =>
      valuesGet.mockImplementation(async ({ range }: { range: string }) => {
        if (range.endsWith("!A1:BL1")) return { data: { values: [Array(64).fill("h")] } };
        if (range.endsWith("!C2:C")) return { data: { values: [["2026-09-28|예시상사"]] } };
        if (range.endsWith("!E2:BL2")) return { data: { values: [cells] } };
        throw new Error(`unexpected ${range}`);
      });
    mock(full.slice(4));
    expect((await readCompanyInfoArchiveRow("s-1", "2026-09-28", "예시상사"))!.매출기준연도).toBe("2026");
    mock(full.slice(4, 63));
    const old = (await readCompanyInfoArchiveRow("s-2", "2026-09-28", "예시상사"))!;
    expect(old.매출기준연도).toBe("");
    expect(old.과년도매출).toBe("1,234");
  });
});

describe("④ 이월 · DB 복원", () => {
  const sheetRaw = userEntered(meetingToRow(BASE));

  it("이월 payload 열문자 CD → Meeting 복원", () => {
    const p = carriedMeetingPayload({ 원본id: "m-by-001", raw: sheetRaw }, "new-by");
    expect(p.CD).toBe("2026");
    expect(meetingFromDbPayload(p)!.업체정보!.매출기준연도).toBe("2026");
  });

  it("아레나 시트 이월 쓰기 — 백만원 값·기준 연도 모두 apostrophe 텍스트, grid 82열", async () => {
    valuesGet.mockResolvedValue({ data: { values: [["m-a"]] } });
    await appendCarriedMeeting("arena", { 원본id: "m-by-001", raw: sheetRaw }, "new-by");
    const data = (valuesBatchUpdate.mock.calls[0]![0] as { requestBody: { data: { range: string; values: unknown[][] }[] } })
      .requestBody.data;
    const ext = data.find((d) => d.range.endsWith("!AU3:CD3"))!;
    expect(ext.values[0]![35]).toBe("'2026"); // CD
    expect(ext.values[0]![COMPANY_FIELDS_EXT2.length + 6]).toBe("'250.1"); // 매출Y1상(BU)
    expect(ext.values[0]![COMPANY_FIELDS_EXT2.length + 7]).toBe(""); // 빈 칸은 접두 없음
    // T~AN 의 과년도매출 "1,234" 도 텍스트로(USER_ENTERED 가 숫자 1234 로 바꾸지 않게).
    const t = data.find((d) => d.range.endsWith("!T3:AN3"))!;
    expect(t.values[0]).toContain("'1,234");
    expect(t.values[0]).toContain("'홍길동");
    expect(ensureGridColumns).toHaveBeenCalledWith("arena", "04 업체관리(앱자동작성용)", 82);
  });

  it("06 DB backfill 열문자 BL → CompanyInfo", () => {
    expect(companyInfoFromDbPayload({ BL: "2025" })!.매출기준연도).toBe("2025");
    expect(companyInfoFromDbPayload({ 매출기준연도: "2024" })!.매출기준연도).toBe("2024");
  });
});
