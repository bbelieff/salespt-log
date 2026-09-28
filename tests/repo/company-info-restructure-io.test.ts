/**
 * 업체정보 확장3 15필드 (company-info-restructure, belie 2026-09-28) — 저장 좌표·경로 회귀.
 *  ① 스키마: 15키 default "" · 옛 행(키 없음) 파싱
 *  ② 04 코덱: BO(66)~CC(80) · 기존 열(AU~BN·AT) 불변 · 옛 폭(A~BN) 행도 읽힘 · apostrophe 벗기기
 *  ③ 04 쓰기: grid 81열 보장 · AU1:CC1 헤더는 빈 셀에만 · 행은 AU:CC 한 범위 · 지우기도 AU:CC
 *  ④ 06: AW(48)~BK(62) 미러 · 읽기
 *  ⑤ 이월: 확장 병합·DB payload 열문자(BO~CC)·아레나 시트 쓰기 apostrophe
 *  ⑥ DB payload(열문자) → Meeting / CompanyInfo 복원
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
  COMPANY_EXT3_START,
  COMPANY_FIELDS_EXT2,
  COMPANY_FIELDS_EXT3,
  GCAL_MAP_COL,
  MEETING_ROW_WIDTH,
  meetingToRow,
  rowToMeeting,
  stripUserEnteredEscapes,
} from "@/repo/meetings-rows";
import { appendMeeting, clearMeeting } from "@/repo/meetings";
import { companyInfoToArchiveRow, readCompanyInfoArchiveRow } from "@/repo/company-info-archive";
import { appendCarriedMeeting, carriedMeetingPayload, withExtColumns } from "@/repo/carryover";
import { meetingFromDbPayload } from "@/repo/db/read-daily";
import { colName } from "@/util/sheet-column";

const EXT3: Record<string, string> = {
  주생산품목: "포장용 필름",
  대표임차보증금: "5,000,000",
  대표임차월세: "300,000",
  대표임차면적: "59.5",
  매출Y상: "1억",
  매출Y하: "",
  매출Y1상: "1.2억",
  매출Y1하: "1.3억",
  매출Y2상: "8,000만",
  매출Y2하: "9,000만",
  매출Y3상: "5,000만",
  매출Y3하: "6,000만",
  매출증가율Y3Y2: "+54.5%",
  매출증가율Y2Y1: "+47.1%",
  매출증가율Y1Y: "-3.0%",
};

const BASE = Meeting.parse({
  id: "m-rs-001",
  예약일: "2026-09-28",
  예약시각: "10:00",
  미팅날짜: "2026-09-29",
  미팅시간: "14:00",
  channel: "매입DB",
  업체명: "예시상사",
  장소: "본사",
  업체정보: { 대표자이름: "홍길동", 과세유형: "일반과세자", 매출증가율: "12%", ...EXT3 },
});

const userEntered = (row: (string | number | boolean)[]) =>
  row.map((v) => (typeof v === "string" && v.startsWith("'") ? v.slice(1) : v));

beforeEach(() => {
  for (const m of [valuesGet, valuesBatchUpdate, valuesUpdate, mirrorSheetRow]) m.mockReset();
  ensureGridColumns.mockClear();
});

describe("① 스키마", () => {
  it("15키 default '' · 옛 데이터 파싱", () => {
    const ci = CompanyInfo.parse({ 대표자이름: "홍길동" }) as Record<string, unknown>;
    expect(COMPANY_FIELDS_EXT3).toHaveLength(15);
    for (const f of COMPANY_FIELDS_EXT3) expect(ci[f]).toBe("");
    expect(ci.대표자이름).toBe("홍길동");
  });
});

describe("② 04 코덱 좌표 BO~CC", () => {
  it("확장3 = 확장2(AU~BN) 바로 뒤 BO(66) ~ CC(80), 순서 고정", () => {
    expect(COMPANY_EXT3_START).toBe(COMPANY_EXT2_START + COMPANY_FIELDS_EXT2.length);
    expect(colName(COMPANY_EXT3_START)).toBe("BO");
    expect(MEETING_ROW_WIDTH).toBe(81);
    expect(colName(MEETING_ROW_WIDTH - 1)).toBe("CC");
    expect([...COMPANY_FIELDS_EXT3]).toEqual(Object.keys(EXT3));
  });

  it("값은 apostrophe 텍스트로 BO~CC, AT·확장2 자리 불변", () => {
    const row = meetingToRow(BASE);
    expect(row).toHaveLength(81);
    expect(row[GCAL_MAP_COL]).toBe("");
    expect(row[COMPANY_EXT2_START]).toBe("'일반과세자");
    expect(row[COMPANY_EXT2_START + COMPANY_FIELDS_EXT2.indexOf("매출증가율")]).toBe("'12%");
    COMPANY_FIELDS_EXT3.forEach((f, i) => {
      expect(row[COMPANY_EXT3_START + i]).toBe(EXT3[f] ? `'${EXT3[f]}` : "");
    });
    expect(row[66]).toBe("'포장용 필름"); // BO
    expect(row[80]).toBe("'-3.0%"); // CC — "+/-%" 가 숫자로 바뀌지 않게
  });

  it("라운드트립 · 옛 폭(A~BN 66셀) 행은 확장3 '' 로 읽힌다", () => {
    const back = rowToMeeting(userEntered(meetingToRow(BASE)))!;
    for (const f of COMPANY_FIELDS_EXT3) expect(back.업체정보![f]).toBe(EXT3[f]);
    const old = rowToMeeting(userEntered(meetingToRow(BASE)).slice(0, 66))!;
    expect(old.업체정보!.과세유형).toBe("일반과세자");
    expect(old.업체정보!.주생산품목).toBe("");
  });

  it("stripUserEnteredEscapes 가 확장3 apostrophe 도 벗긴다", () => {
    const stripped = stripUserEnteredEscapes(meetingToRow(BASE));
    expect(stripped[COMPANY_EXT3_START]).toBe("포장용 필름");
    expect(stripped[80]).toBe("-3.0%");
  });
});

describe("③ 04 쓰기 — grid·헤더·행·지우기", () => {
  it("appendMeeting: grid 81열 보장, AU1:CC1 빈 헤더 셀에만 라벨, 행은 AU:CC 한 범위", async () => {
    const header = [...COMPANY_FIELDS_EXT2, "내가 적은 제목"]; // AU~BN 채움 + BO1 사용자 문구
    valuesGet.mockImplementation(async ({ range }: { range: string }) => {
      if (range.endsWith("!A2:A")) return { data: { values: [["m-a"]] } };
      if (range.endsWith("!AU1:CC1")) return { data: { values: [header] } };
      throw new Error(`unexpected ${range}`);
    });
    await appendMeeting("sheet-rs-1", BASE, { mirror: false });
    expect(ensureGridColumns).toHaveBeenCalledWith("sheet-rs-1", "04 업체관리(앱자동작성용)", 81);
    const [hdr, rowCall] = valuesBatchUpdate.mock.calls.map(
      (c) => (c[0] as { requestBody: { data: { range: string; values: unknown[][] }[] } }).requestBody.data,
    );
    const hdrRanges = hdr!.map((d) => d.range.split("!")[1]);
    expect(hdrRanges).not.toContain("BO1"); // 사용자 문구 보존
    expect(hdrRanges).not.toContain("AU1"); // 이미 있는 라벨 보존
    expect(hdrRanges).toHaveLength(14); // BP1~CC1
    expect(hdr!.find((d) => d.range.endsWith("!CC1"))!.values).toEqual([["매출증가율Y1Y"]]);
    const ext = rowCall!.find((d) => d.range.endsWith("!AU3:CC3"))!;
    expect(ext.values[0]).toHaveLength(35);
    expect(ext.values[0]![COMPANY_FIELDS_EXT2.length]).toBe("'포장용 필름");
    expect(rowCall!.some((d) => /!AT3/.test(d.range))).toBe(false); // gcal 맵 비접촉
  });

  it("clearMeeting: AU:CC 35칸을 비우고 AT 는 건드리지 않는다", async () => {
    valuesGet.mockResolvedValue({ data: { values: [["x"], ["m-rs-001"]] } });
    await clearMeeting("sheet-rs-2", "m-rs-001", { mirror: false });
    const data = (valuesBatchUpdate.mock.calls[0]![0] as { requestBody: { data: { range: string; values: unknown[][] }[] } })
      .requestBody.data;
    const ext = data.find((d) => d.range.endsWith("!AU3:CC3"))!;
    expect(ext.values[0]).toEqual(Array(35).fill(""));
    expect(data.some((d) => /!AT3/.test(d.range))).toBe(false);
  });
});

describe("④ 06 업체정보 AW~BK", () => {
  const AW = 4 + 20 + 1 + 3 + 20; // 48

  it("행 빌더: 확장3 = AV 다음 AW(48)부터 15칸", () => {
    const row = companyInfoToArchiveRow("예시상사", "2026-09-28", BASE.업체정보, "T");
    expect(colName(AW)).toBe("AW");
    expect(row).toHaveLength(63);
    expect(row[AW - 1]).toBe("'12%"); // AV = 옛 매출증가율 자리 그대로
    COMPANY_FIELDS_EXT3.forEach((f, i) => expect(row[AW + i]).toBe(EXT3[f] ? `'${EXT3[f]}` : ""));
    expect(colName(62)).toBe("BK");
  });

  it("읽기: E~BK 에서 확장3 복원, 옛 48열 행은 ''", async () => {
    const full = userEntered(companyInfoToArchiveRow("예시상사", "2026-09-28", BASE.업체정보, "T"));
    valuesGet.mockImplementation(async ({ range }: { range: string }) => {
      if (range.endsWith("!A1:BK1")) return { data: { values: [Array(63).fill("h")] } };
      if (range.endsWith("!C2:C")) return { data: { values: [["2026-09-28|예시상사"]] } };
      if (range.endsWith("!E2:BK2")) return { data: { values: [full.slice(4)] } };
      throw new Error(`unexpected ${range}`);
    });
    const ci = (await readCompanyInfoArchiveRow("sheet-rs-3", "2026-09-28", "예시상사"))!;
    for (const f of COMPANY_FIELDS_EXT3) expect(ci[f]).toBe(EXT3[f]);
    expect(ci.매출증가율).toBe("12%");

    valuesGet.mockImplementation(async ({ range }: { range: string }) => {
      if (range.endsWith("!A1:BK1")) return { data: { values: [Array(63).fill("h")] } };
      if (range.endsWith("!C2:C")) return { data: { values: [["2026-09-28|예시상사"]] } };
      if (range.endsWith("!E2:BK2")) return { data: { values: [full.slice(4, 48)] } }; // 옛 A~AV 행
      throw new Error(`unexpected ${range}`);
    });
    const old = (await readCompanyInfoArchiveRow("sheet-rs-4", "2026-09-28", "예시상사"))!;
    expect(old.과세유형).toBe("일반과세자");
    expect(old.주생산품목).toBe("");
  });
});

describe("⑤ 이월 · ⑥ DB payload", () => {
  const sheetRaw = userEntered(meetingToRow(BASE));

  it("이전 시트 확장 행 병합 + DB payload 열문자 BO~CC → Meeting 복원", () => {
    const merged = withExtColumns(sheetRaw.slice(0, 40), sheetRaw.slice(42, 81));
    expect(merged[COMPANY_EXT3_START]).toBe("포장용 필름");
    const p = carriedMeetingPayload({ 원본id: "m-rs-001", raw: merged }, "new-rs");
    expect(p.BO).toBe("포장용 필름");
    expect(p.CC).toBe("-3.0%");
    expect(p).not.toHaveProperty("AT");
    const m = meetingFromDbPayload(p)!;
    for (const f of COMPANY_FIELDS_EXT3) expect(m.업체정보![f]).toBe(EXT3[f]);
  });

  it("아레나 시트 이월 쓰기 — AU:CC 한 범위, 확장3 문자열 apostrophe", async () => {
    valuesGet.mockResolvedValue({ data: { values: [["m-a"]] } });
    await appendCarriedMeeting("arena", { 원본id: "m-rs-001", raw: sheetRaw }, "new-rs");
    const data = (valuesBatchUpdate.mock.calls[0]![0] as { requestBody: { data: { range: string; values: unknown[][] }[] } })
      .requestBody.data;
    const ext = data.find((d) => d.range.endsWith("!AU3:CC3"))!;
    expect(ext.values[0]![COMPANY_FIELDS_EXT2.length]).toBe("'포장용 필름");
    expect(ext.values[0]![34]).toBe("'-3.0%");
    expect(ensureGridColumns).toHaveBeenCalledWith("arena", "04 업체관리(앱자동작성용)", 81);
  });
});
