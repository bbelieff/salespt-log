/**
 * [대표자] 이메일(확장5) 저장 좌표·경로 (company-info-email 2026-10) — 04 CE · 06 BM.
 *  ① 04 코덱 CE(82) · 전체 83열 · 읽기 폴백 CE → CD → CC → BN → AS · apostrophe("=..." 도 텍스트)
 *  ② 04 쓰기: 행 AU:CE 한 범위 · CD 까지만 넓힌 시트는 A:CD 로 읽어 확장4 값 보존
 *  ③ 06 BM 미러 · 읽기 · 옛 64열(A~BL) 행은 ""
 *  ④ 계약 업체명 개명: 시트는 A:D 만 바꾸고 BM 은 그대로 → 개명 뒤 시트 대체 읽기에서도 이메일이 남는다
 *  ⑤ 이월: 이전 시트 AQ:CE 읽기 · 열문자 payload CE → Meeting 복원 · 아레나 시트 쓰기 apostrophe
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
  COMPANY_EXT2_START,
  COMPANY_EXT5_START,
  COMPANY_FIELDS_EXT5,
  MEETING_READ_WIDTHS,
  MEETING_ROW_WIDTH,
  meetingToRow,
  rowToMeeting,
  stripUserEnteredEscapes,
} from "@/repo/meetings-rows";
import { appendMeeting, readMeetingRows } from "@/repo/meetings";
import {
  ARCHIVE_ROW_WIDTH,
  companyInfoToArchiveRow,
  readCompanyInfoArchiveRow,
  renameCompanyInfoKey,
} from "@/repo/company-info-archive";
import { appendCarriedMeeting, carriedMeetingPayload, listCarrySourceMeetings } from "@/repo/carryover";
import { meetingFromDbPayload } from "@/repo/db/read-daily";
import { colName } from "@/util/sheet-column";

const EMAIL = "ceo@example.com";
const BASE = Meeting.parse({
  id: "m-em-001",
  예약일: "2026-10-05",
  예약시각: "10:00",
  미팅날짜: "2026-10-06",
  미팅시간: "14:00",
  channel: "매입DB",
  업체명: "샘플상사",
  장소: "본사",
  업체정보: { 대표자이름: "홍길동", 연락처통신사: "010-0000-0000(SKT)", 매출기준연도: "2026", 이메일: EMAIL },
});
type Batch = { requestBody: { data: { range: string; values: unknown[][] }[] } };
const userEntered = (row: (string | number | boolean)[]) =>
  row.map((v) => (typeof v === "string" && v.startsWith("'") ? v.slice(1) : v));
const gridError = () => Object.assign(new Error("Range exceeds grid limits. Max columns: 82"), { code: 400 });

beforeEach(() => {
  for (const m of [valuesGet, valuesBatchUpdate, valuesUpdate, mirrorSheetRow]) m.mockReset();
  ensureGridColumns.mockClear();
});

describe("① 04 코덱 CE", () => {
  it("스키마 default '' · CD(확장4) 바로 뒤 CE(82) · 전체 83열 · 읽기 폴백 5단계", () => {
    expect(CompanyInfo.parse({}).이메일).toBe("");
    expect([...COMPANY_FIELDS_EXT5]).toEqual(["이메일"]);
    expect(COMPANY_EXT5_START).toBe(82);
    expect(colName(COMPANY_EXT5_START)).toBe("CE");
    expect(MEETING_ROW_WIDTH).toBe(83);
    expect(MEETING_READ_WIDTHS.map((w) => colName(w - 1))).toEqual(["CE", "CD", "CC", "BN", "AS"]);
  });

  it("apostrophe 텍스트 + 라운드트립 · '='·'+' 로 시작해도 수식이 아닌 글", () => {
    const row = meetingToRow(BASE);
    expect(row[82]).toBe(`'${EMAIL}`);
    expect(stripUserEnteredEscapes(row)[82]).toBe(EMAIL);
    expect(rowToMeeting(userEntered(row))!.업체정보!.이메일).toBe(EMAIL);
    const odd = Meeting.parse({ ...BASE, 업체정보: { ...BASE.업체정보, 이메일: "=HYPERLINK(1)" } });
    expect(meetingToRow(odd)[82]).toBe("'=HYPERLINK(1)");
    expect(meetingToRow(Meeting.parse({ ...BASE, 업체정보: { 대표자이름: "홍길동" } }))[82]).toBe("");
  });

  it("옛 폭(A~CD 82셀) 행은 이메일 '' · 다른 값은 그대로", () => {
    const old = rowToMeeting(userEntered(meetingToRow(BASE)).slice(0, 82))!;
    expect(old.업체정보!.이메일).toBe("");
    expect(old.업체정보!.매출기준연도).toBe("2026");
  });
});

describe("② 04 쓰기·읽기", () => {
  it("appendMeeting: grid 83열, CE1 헤더는 빈 셀에만, 행은 AU:CE 한 범위", async () => {
    const header = Array(36).fill("h"); // AU1~CD1 채움, CE1 빈 칸
    valuesGet.mockImplementation(async ({ range }: { range: string }) => {
      if (range.endsWith("!A2:A")) return { data: { values: [["m-a"]] } };
      if (range.endsWith("!AU1:CE1")) return { data: { values: [header] } };
      throw new Error(`unexpected ${range}`);
    });
    await appendMeeting("sheet-em-1", BASE, { mirror: false });
    expect(ensureGridColumns).toHaveBeenCalledWith("sheet-em-1", "04 업체관리(앱자동작성용)", 83);
    const [hdr, rowCall] = valuesBatchUpdate.mock.calls.map((c) => (c[0] as Batch).requestBody.data);
    expect(hdr).toEqual([{ range: "'04 업체관리(앱자동작성용)'!CE1", values: [["이메일"]] }]);
    const ext = rowCall!.find((d) => d.range.endsWith("!AU3:CE3"))!;
    expect(ext.values[0]).toHaveLength(MEETING_ROW_WIDTH - COMPANY_EXT2_START);
    expect(ext.values[0]![36]).toBe(`'${EMAIL}`);
  });

  it("CD 까지만 넓힌 시트: A:CE 범위 초과 → A:CD 로 읽어 기준 연도는 살고 이메일은 ''", async () => {
    const row = userEntered(meetingToRow(BASE)).slice(0, 82);
    valuesGet.mockRejectedValueOnce(gridError()).mockResolvedValueOnce({ data: { values: [row] } });
    const rows = await readMeetingRows("sid", (last) => `R!A2:${last}`);
    expect(valuesGet.mock.calls.map((c) => (c[0] as { range: string }).range)).toEqual(["R!A2:CE", "R!A2:CD"]);
    expect(ensureGridColumns).not.toHaveBeenCalled();
    const m = rowToMeeting(rows[0]!)!;
    expect(m.업체정보!.매출기준연도).toBe("2026");
    expect(m.업체정보!.이메일).toBe("");
  });
});

describe("③ 06 BM", () => {
  it("행 빌더: BM(64) = 이메일, 65열", () => {
    const row = companyInfoToArchiveRow("샘플상사", "2026-10-06", BASE.업체정보, "T");
    expect(ARCHIVE_ROW_WIDTH).toBe(65);
    expect(row).toHaveLength(65);
    expect(colName(64)).toBe("BM");
    expect(row[64]).toBe(`'${EMAIL}`);
  });

  it("읽기: E~BM 에서 복원, 옛 64열(A~BL) 행은 ''", async () => {
    const full = userEntered(companyInfoToArchiveRow("샘플상사", "2026-10-06", BASE.업체정보, "T"));
    const mock = (cells: unknown[]) =>
      valuesGet.mockImplementation(async ({ range }: { range: string }) => {
        if (range.endsWith("!A1:BM1")) return { data: { values: [Array(65).fill("h")] } };
        if (range.endsWith("!C2:C")) return { data: { values: [["2026-10-06|샘플상사"]] } };
        if (range.endsWith("!E2:BM2")) return { data: { values: [cells] } };
        throw new Error(`unexpected ${range}`);
      });
    mock(full.slice(4));
    expect((await readCompanyInfoArchiveRow("s-1", "2026-10-06", "샘플상사"))!.이메일).toBe(EMAIL);
    mock(full.slice(4, 64));
    const old = (await readCompanyInfoArchiveRow("s-2", "2026-10-06", "샘플상사"))!;
    expect(old.이메일).toBe("");
    expect(old.매출기준연도).toBe("2026");
  });
});

describe("④ 계약 업체명 개명 — 이메일 유지(수용 기준 #9)", () => {
  it("06 시트는 A:D 만 바꾸고 BM 은 건드리지 않는다 → 새 키로 읽어도 이메일이 그대로", async () => {
    // 메모리 시트 1행(row 2) — 수렴 잡이 이미 BM 까지 써 둔 상태.
    const sheetRow: unknown[] = userEntered(companyInfoToArchiveRow("샘플상사", "2026-10-06", BASE.업체정보, "T"));
    valuesGet.mockImplementation(async ({ range }: { range: string }) => {
      if (range.endsWith("!A1:BM1")) return { data: { values: [Array(65).fill("h")] } };
      if (range.endsWith("!C2:C")) return { data: { values: [[sheetRow[2]]] } };
      if (range.endsWith("!E2:BM2")) return { data: { values: [sheetRow.slice(4)] } };
      throw new Error(`unexpected ${range}`);
    });
    valuesUpdate.mockImplementation(async ({ range, requestBody }: { range: string; requestBody: { values: unknown[][] } }) => {
      expect(range).toBe("'06 업체정보'!A2:D2"); // 키 4칸만 — E~BM 스냅샷 비접촉
      requestBody.values[0]!.forEach((v, i) => (sheetRow[i] = v));
    });
    const res = await renameCompanyInfoKey(
      "s-ren",
      { 계약일: "2026-10-06", 업체명: "샘플상사" },
      { 계약일: "2026-10-06", 업체명: "가상식품" },
    );
    expect(res.moved).toBe(true);
    const after = (await readCompanyInfoArchiveRow("s-ren", "2026-10-06", "가상식품"))!;
    expect(after.이메일).toBe(EMAIL);
    expect(after.대표자이름).toBe("홍길동");
  });
});

describe("⑤ 이월 — 이전 시트 읽기 · DB payload · 아레나 시트 쓰기", () => {
  const sheetRaw = userEntered(meetingToRow(BASE));

  it("이전 시트 AQ2:CE 를 읽어 CE 이메일까지 raw 에 싣는다", async () => {
    valuesGet.mockImplementation(async ({ range }: { range: string }) => {
      if (range.endsWith("!A2:AN")) return { data: { values: [sheetRaw.slice(0, 40).map((v, i) => (i === 9 ? "예약" : v))] } };
      if (range.endsWith("!AQ2:CE")) return { data: { values: [sheetRaw.slice(42)] } };
      throw new Error(`unexpected ${range}`);
    });
    const [src] = await listCarrySourceMeetings("old");
    expect(src!.raw[82]).toBe(EMAIL);
  });

  it("열문자 payload CE → Meeting 복원(DB 정본 이월 · arena-carryover 의 meetingToRow 경로 동일)", () => {
    const p = carriedMeetingPayload({ 원본id: "m-em-001", raw: stripUserEnteredEscapes(meetingToRow(BASE)) }, "new-em");
    expect(p.CE).toBe(EMAIL);
    expect(meetingFromDbPayload(p)!.업체정보!.이메일).toBe(EMAIL);
  });

  it("아레나 시트 이월 쓰기 — AU:CE 한 범위, 이메일은 apostrophe 텍스트, grid 83열", async () => {
    valuesGet.mockResolvedValue({ data: { values: [["m-a"]] } });
    await appendCarriedMeeting("arena", { 원본id: "m-em-001", raw: sheetRaw }, "new-em");
    const data = (valuesBatchUpdate.mock.calls[0]![0] as Batch).requestBody.data;
    const ext = data.find((d) => d.range.endsWith("!AU3:CE3"))!;
    expect(ext.values[0]![36]).toBe(`'${EMAIL}`);
    expect(ensureGridColumns).toHaveBeenCalledWith("arena", "04 업체관리(앱자동작성용)", 83);
    const mirrored = mirrorSheetRow.mock.calls[0]![0] as { payload: Record<string, unknown> };
    expect(mirrored.payload.CE).toBe(EMAIL);
  });
});
