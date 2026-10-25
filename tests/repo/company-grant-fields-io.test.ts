/**
 * 맞춤공고 수동값(확장5) 저장 좌표·경로 (company-grant-fields, 2026-10-25) — 04 CE~CI · 06 BM~BQ.
 *  ① 스키마 default "" · 04 코덱 CE~CI(82..86) · apostrophe 라운드트립 · 옛 폭(A~CD) 행은 ""
 *  ② 04 쓰기 grid 87열 · 행 AU:CI · 읽기 폴백 CI → CD(확장4 값 보존)
 *  ③ 06 BM~BQ(64..68) 미러 · 읽기 · 옛 64열(A~BL) 행은 ""
 *  ④ DB payload — 06 키 이름·열문자(BM..BQ), 04 이월 열문자(CE..CI)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const valuesGet = vi.fn();
const valuesBatchUpdate = vi.fn();
const valuesUpdate = vi.fn();
const ensureGridColumns = vi.fn(async () => {});

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
vi.mock("@/repo/db/mirror", () => ({ mirrorSheetRow: vi.fn(), mirrorClearRow: vi.fn() }));
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
  COMPANY_EXT4_START,
  COMPANY_EXT5_START,
  COMPANY_FIELDS_EXT5,
  MEETING_READ_WIDTHS,
  MEETING_ROW_WIDTH,
  meetingToRow,
  rowToMeeting,
  stripUserEnteredEscapes,
} from "@/repo/meetings-rows";
import { appendMeeting, readMeetingRows } from "@/repo/meetings";
import { ARCHIVE_ROW_WIDTH, companyInfoToArchiveRow, readCompanyInfoArchiveRow } from "@/repo/company-info-archive";
import { carriedMeetingPayload } from "@/repo/carryover";
import { companyInfoFromDbPayload, meetingFromDbPayload } from "@/repo/db/read-daily";
import { colName } from "@/util/sheet-column";

const GRANT = {
  지역시도: "울산",
  지역시군구: "남구",
  대분류: "제조업",
  제외업종: "아니오",
  공고특성: "여성기업,수출(직접)",
} as const;

const BASE = Meeting.parse({
  id: "m-gr-001",
  예약일: "2026-10-25",
  예약시각: "10:00",
  미팅날짜: "2026-10-26",
  미팅시간: "14:00",
  channel: "매입DB",
  업체명: "예시상사",
  장소: "본사",
  업체정보: { 대표자이름: "홍길동", 매출기준연도: "2026", ...GRANT },
});
const userEntered = (row: (string | number | boolean)[]) =>
  row.map((v) => (typeof v === "string" && v.startsWith("'") ? v.slice(1) : v));
const gridError = () => Object.assign(new Error("Range exceeds grid limits. Max columns: 82"), { code: 400 });

beforeEach(() => {
  for (const m of [valuesGet, valuesBatchUpdate, valuesUpdate]) m.mockReset();
  ensureGridColumns.mockClear();
});

describe("① 스키마 · 04 코덱 CE~CI", () => {
  it("default '' · 확장4(CD) 바로 뒤 CE(82)~CI(86) · 전체 87열 · 읽기 폴백 순서", () => {
    const empty = CompanyInfo.parse({});
    for (const k of COMPANY_FIELDS_EXT5) expect(empty[k]).toBe("");
    expect([...COMPANY_FIELDS_EXT5]).toEqual(["지역시도", "지역시군구", "대분류", "제외업종", "공고특성"]);
    expect(colName(COMPANY_EXT4_START)).toBe("CD");
    expect(COMPANY_EXT5_START).toBe(82);
    expect(colName(COMPANY_EXT5_START)).toBe("CE");
    expect(colName(COMPANY_EXT5_START + 4)).toBe("CI");
    expect(MEETING_ROW_WIDTH).toBe(87);
    expect(MEETING_READ_WIDTHS.map((w) => colName(w - 1))).toEqual(["CI", "CD", "CC", "BN", "AS"]);
  });

  it("apostrophe 텍스트 · 라운드트립", () => {
    const row = meetingToRow(BASE);
    expect(row).toHaveLength(87);
    expect(row.slice(82, 87)).toEqual(["'울산", "'남구", "'제조업", "'아니오", "'여성기업,수출(직접)"]);
    expect(stripUserEnteredEscapes(row).slice(82, 87)).toEqual(Object.values(GRANT));
    const back = rowToMeeting(userEntered(row))!;
    for (const [k, v] of Object.entries(GRANT)) expect(back.업체정보![k as keyof typeof GRANT]).toBe(v);
    expect(back.업체정보!.매출기준연도).toBe("2026");
  });

  it("빈 값은 접두 없는 빈 셀", () => {
    const row = meetingToRow({ ...BASE, 업체정보: CompanyInfo.parse({ 대표자이름: "홍길동" }) });
    expect(row.slice(82, 87)).toEqual(["", "", "", "", ""]);
  });

  it("옛 폭(A~CD 82셀) 행은 다섯 칸 모두 ''", () => {
    const old = rowToMeeting(userEntered(meetingToRow(BASE)).slice(0, 82))!;
    for (const k of COMPANY_FIELDS_EXT5) expect(old.업체정보![k]).toBe("");
    expect(old.업체정보!.매출기준연도).toBe("2026");
  });
});

describe("② 04 쓰기·읽기", () => {
  it("appendMeeting: grid 87열, 행은 AU:CI(41칸) — 끝 5칸이 확장5", async () => {
    valuesGet.mockImplementation(async ({ range }: { range: string }) => {
      if (range.endsWith("!A2:A")) return { data: { values: [["m-a"]] } };
      if (range.endsWith("!AU1:CI1")) return { data: { values: [Array(41).fill("h")] } };
      throw new Error(`unexpected ${range}`);
    });
    await appendMeeting("sheet-gr-1", BASE, { mirror: false });
    expect(ensureGridColumns).toHaveBeenCalledWith("sheet-gr-1", "04 업체관리(앱자동작성용)", 87);
    const calls = valuesBatchUpdate.mock.calls.map(
      (c) => (c[0] as { requestBody: { data: { range: string; values: unknown[][] }[] } }).requestBody.data,
    );
    expect(calls).toHaveLength(1); // 헤더 다 차 있으면 헤더 쓰기 없음
    const ext = calls[0]!.find((d) => d.range.endsWith("!AU3:CI3"))!;
    expect(ext.values[0]).toHaveLength(41);
    expect(ext.values[0]!.slice(36)).toEqual(["'울산", "'남구", "'제조업", "'아니오", "'여성기업,수출(직접)"]);
  });

  it("빈 헤더 CE1~CI1 에만 라벨 보강", async () => {
    const header = [...Array(36).fill("h"), "", "내 제목", "", "", ""];
    valuesGet.mockImplementation(async ({ range }: { range: string }) => {
      if (range.endsWith("!A2:A")) return { data: { values: [["m-a"]] } };
      if (range.endsWith("!AU1:CI1")) return { data: { values: [header] } };
      throw new Error(`unexpected ${range}`);
    });
    await appendMeeting("sheet-gr-2", BASE, { mirror: false });
    const all = valuesBatchUpdate.mock.calls.flatMap(
      (c) => (c[0] as { requestBody: { data: { range: string; values: unknown[][] }[] } }).requestBody.data,
    );
    const labels = all.filter((d) => /!(C[E-I])1$/.test(d.range)).map((d) => [d.range.split("!")[1], d.values[0]![0]]);
    expect(labels).toEqual([
      ["CE1", "지역시도"],
      ["CG1", "대분류"],
      ["CH1", "제외업종"],
      ["CI1", "공고특성"],
    ]);
  });

  it("읽기: CI 범위 초과면 A:CD 로(확장4 값 보존) — grid 는 넓히지 않음", async () => {
    valuesGet.mockRejectedValueOnce(gridError()).mockResolvedValueOnce({ data: { values: [["x"]] } });
    const rows = await readMeetingRows("sid", (last) => `R!A2:${last}`);
    expect(rows).toEqual([["x"]]);
    expect(valuesGet.mock.calls.map((c) => (c[0] as { range: string }).range)).toEqual(["R!A2:CI", "R!A2:CD"]);
    expect(ensureGridColumns).not.toHaveBeenCalled();
  });
});

describe("③ 06 BM~BQ", () => {
  it("행 빌더: BM(64)~BQ(68), 69열", () => {
    const row = companyInfoToArchiveRow("예시상사", "2026-10-25", BASE.업체정보, "T");
    expect(ARCHIVE_ROW_WIDTH).toBe(69);
    expect(row).toHaveLength(69);
    expect(colName(64)).toBe("BM");
    expect(colName(68)).toBe("BQ");
    expect(row[63]).toBe("'2026");
    expect(row.slice(64)).toEqual(["'울산", "'남구", "'제조업", "'아니오", "'여성기업,수출(직접)"]);
  });

  it("읽기: E~BQ 에서 복원, 옛 64열(A~BL) 행은 ''", async () => {
    const full = userEntered(companyInfoToArchiveRow("예시상사", "2026-10-25", BASE.업체정보, "T"));
    const mock = (cells: unknown[]) =>
      valuesGet.mockImplementation(async ({ range }: { range: string }) => {
        if (range.endsWith("!A1:BQ1")) return { data: { values: [Array(69).fill("h")] } };
        if (range.endsWith("!C2:C")) return { data: { values: [["2026-10-25|예시상사"]] } };
        if (range.endsWith("!E2:BQ2")) return { data: { values: [cells] } };
        throw new Error(`unexpected ${range}`);
      });
    mock(full.slice(4));
    const now = (await readCompanyInfoArchiveRow("s-1", "2026-10-25", "예시상사"))!;
    for (const [k, v] of Object.entries(GRANT)) expect(now[k as keyof typeof GRANT]).toBe(v);
    mock(full.slice(4, 64));
    const old = (await readCompanyInfoArchiveRow("s-2", "2026-10-25", "예시상사"))!;
    for (const k of COMPANY_FIELDS_EXT5) expect(old[k]).toBe("");
    expect(old.매출기준연도).toBe("2026");
  });
});

describe("④ DB payload", () => {
  it("06 payload — 키 이름 우선, 열문자 BM..BQ 폴백, 옛 payload 는 ''", () => {
    expect(companyInfoFromDbPayload({ ...GRANT })).toMatchObject(GRANT);
    expect(
      companyInfoFromDbPayload({ BL: "2025", BM: "울산", BN: "남구", BO: "제조업", BP: "예", BQ: "여성기업" }),
    ).toMatchObject({ 매출기준연도: "2025", 지역시도: "울산", 지역시군구: "남구", 대분류: "제조업", 제외업종: "예", 공고특성: "여성기업" });
    const old = companyInfoFromDbPayload({ BL: "2025" })!;
    for (const k of COMPANY_FIELDS_EXT5) expect(old[k]).toBe("");
  });

  it("04 이월 payload 열문자 CE..CI → Meeting 복원", () => {
    const p = carriedMeetingPayload({ 원본id: "m-gr-001", raw: userEntered(meetingToRow(BASE)) }, "new-gr");
    expect([p.CE, p.CF, p.CG, p.CH, p.CI]).toEqual(Object.values(GRANT));
    expect(meetingFromDbPayload(p)!.업체정보).toMatchObject(GRANT);
  });
});
