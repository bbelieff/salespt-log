/**
 * 고른 표준산업분류(확장6) 저장 좌표·경로 (company-ksic-save, 2026-11-05) — 04 CJ · 06 BR.
 *  ① 스키마 default "" · 04 코덱 CJ(87) · apostrophe 라운드트립("47711 …" 이 숫자로 안 바뀜) · 옛 폭(A~CI) 행은 ""
 *  ② 04 쓰기 grid 88열 · 행 AU:CJ(42칸) · 빈 헤더 CJ1 에만 라벨 · 읽기 폴백 CJ → CI(확장5 값 보존)
 *  ③ 06 BR(69) 미러 · 읽기 · 옛 69열(A~BQ) 행은 ""
 *  ④ DB payload — 06 키 이름·열문자(BR), 04 이월 열문자(CJ)
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
  COMPANY_EXT5_START,
  COMPANY_EXT6_START,
  COMPANY_FIELDS_EXT5,
  COMPANY_FIELDS_EXT6,
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

const KSIC = "47711 운송장비용 주유소 운영업";
const GRANT = { 지역시도: "울산", 공고특성: "여성기업" } as const;

const BASE = Meeting.parse({
  id: "m-ks-001",
  예약일: "2026-11-05",
  예약시각: "10:00",
  미팅날짜: "2026-11-06",
  미팅시간: "14:00",
  channel: "매입DB",
  업체명: "예시상사",
  장소: "본사",
  업체정보: { 대표자이름: "홍길동", ...GRANT, 표준산업분류: KSIC },
});
const userEntered = (row: (string | number | boolean)[]) =>
  row.map((v) => (typeof v === "string" && v.startsWith("'") ? v.slice(1) : v));
const gridError = () => Object.assign(new Error("Range exceeds grid limits. Max columns: 87"), { code: 400 });

beforeEach(() => {
  for (const m of [valuesGet, valuesBatchUpdate, valuesUpdate]) m.mockReset();
  ensureGridColumns.mockClear();
});

describe("① 스키마 · 04 코덱 CJ", () => {
  it("default '' · 확장5(CE~CI) 바로 뒤 CJ(87) · 전체 88열 · 읽기 폴백 순서", () => {
    expect(CompanyInfo.parse({}).표준산업분류).toBe("");
    expect([...COMPANY_FIELDS_EXT6]).toEqual(["표준산업분류"]);
    expect(COMPANY_EXT6_START).toBe(COMPANY_EXT5_START + COMPANY_FIELDS_EXT5.length);
    expect(COMPANY_EXT6_START).toBe(87);
    expect(colName(COMPANY_EXT6_START)).toBe("CJ");
    expect(MEETING_ROW_WIDTH).toBe(88);
    expect(MEETING_READ_WIDTHS.map((w) => colName(w - 1))).toEqual(["CJ", "CI", "CD", "CC", "BN", "AS"]);
  });

  it("apostrophe 텍스트 · 라운드트립", () => {
    const row = meetingToRow(BASE);
    expect(row).toHaveLength(88);
    expect(row[87]).toBe(`'${KSIC}`);
    expect(stripUserEnteredEscapes(row)[87]).toBe(KSIC);
    const back = rowToMeeting(userEntered(row))!;
    expect(back.업체정보!.표준산업분류).toBe(KSIC);
    expect(back.업체정보!.지역시도).toBe("울산");
  });

  it("빈 값은 접두 없는 빈 셀", () => {
    const row = meetingToRow({ ...BASE, 업체정보: CompanyInfo.parse({ 대표자이름: "홍길동" }) });
    expect(row[87]).toBe("");
  });

  it("옛 폭(A~CI 87셀) 행은 표준산업분류 '' · 확장5 값은 그대로", () => {
    const old = rowToMeeting(userEntered(meetingToRow(BASE)).slice(0, 87))!;
    expect(old.업체정보!.표준산업분류).toBe("");
    expect(old.업체정보!.지역시도).toBe("울산");
    expect(old.업체정보!.공고특성).toBe("여성기업");
  });
});

describe("② 04 쓰기·읽기", () => {
  it("appendMeeting: grid 88열, 행은 AU:CJ(42칸) — 끝 칸이 확장6", async () => {
    valuesGet.mockImplementation(async ({ range }: { range: string }) => {
      if (range.endsWith("!A2:A")) return { data: { values: [["m-a"]] } };
      if (range.endsWith("!AU1:CJ1")) return { data: { values: [Array(42).fill("h")] } };
      throw new Error(`unexpected ${range}`);
    });
    await appendMeeting("sheet-ks-1", BASE, { mirror: false });
    expect(ensureGridColumns).toHaveBeenCalledWith("sheet-ks-1", "04 업체관리(앱자동작성용)", 88);
    const calls = valuesBatchUpdate.mock.calls.map(
      (c) => (c[0] as { requestBody: { data: { range: string; values: unknown[][] }[] } }).requestBody.data,
    );
    expect(calls).toHaveLength(1); // 헤더 다 차 있으면 헤더 쓰기 없음
    const ext = calls[0]!.find((d) => d.range.endsWith("!AU3:CJ3"))!;
    expect(ext.values[0]).toHaveLength(42);
    expect(ext.values[0]![41]).toBe(`'${KSIC}`);
  });

  it("빈 헤더 CJ1 에만 라벨 보강 — 옛 41칸 헤더(AU~CI)도 CJ1 만 채운다", async () => {
    valuesGet.mockImplementation(async ({ range }: { range: string }) => {
      if (range.endsWith("!A2:A")) return { data: { values: [["m-a"]] } };
      if (range.endsWith("!AU1:CJ1")) return { data: { values: [Array(41).fill("h")] } };
      throw new Error(`unexpected ${range}`);
    });
    await appendMeeting("sheet-ks-2", BASE, { mirror: false });
    const all = valuesBatchUpdate.mock.calls.flatMap(
      (c) => (c[0] as { requestBody: { data: { range: string; values: unknown[][] }[] } }).requestBody.data,
    );
    const labels = all.filter((d) => /!(A[U-Z]|B[A-Z]|C[A-J])1$/.test(d.range)).map((d) => [d.range.split("!")[1], d.values[0]![0]]);
    expect(labels).toEqual([["CJ1", "표준산업분류"]]);
  });

  it("읽기: CJ 범위 초과면 A:CI 로(확장5 값 보존) — grid 는 넓히지 않음", async () => {
    const oldRow = userEntered(meetingToRow(BASE)).slice(0, 87);
    valuesGet.mockRejectedValueOnce(gridError()).mockResolvedValueOnce({ data: { values: [oldRow] } });
    const rows = await readMeetingRows("sid", (last) => `R!A2:${last}`);
    expect(valuesGet.mock.calls.map((c) => (c[0] as { range: string }).range)).toEqual(["R!A2:CJ", "R!A2:CI"]);
    expect(ensureGridColumns).not.toHaveBeenCalled();
    const m = rowToMeeting(rows[0]!)!;
    expect(m.업체정보!.지역시도).toBe("울산");
    expect(m.업체정보!.공고특성).toBe("여성기업");
    expect(m.업체정보!.표준산업분류).toBe("");
  });
});

describe("③ 06 BR", () => {
  it("행 빌더: BR(69) = 표준산업분류, 70열", () => {
    const row = companyInfoToArchiveRow("예시상사", "2026-11-05", BASE.업체정보, "T");
    expect(ARCHIVE_ROW_WIDTH).toBe(70);
    expect(row).toHaveLength(70);
    expect(colName(69)).toBe("BR");
    expect(row[69]).toBe(`'${KSIC}`);
    expect(row[64]).toBe("'울산"); // BM 확장5 자리 불변
  });

  it("읽기: E~BR 에서 복원, 옛 69열(A~BQ) 행은 ''", async () => {
    const full = userEntered(companyInfoToArchiveRow("예시상사", "2026-11-05", BASE.업체정보, "T"));
    const mock = (cells: unknown[]) =>
      valuesGet.mockImplementation(async ({ range }: { range: string }) => {
        if (range.endsWith("!A1:BR1")) return { data: { values: [Array(70).fill("h")] } };
        if (range.endsWith("!C2:C")) return { data: { values: [["2026-11-05|예시상사"]] } };
        if (range.endsWith("!E2:BR2")) return { data: { values: [cells] } };
        throw new Error(`unexpected ${range}`);
      });
    mock(full.slice(4));
    expect((await readCompanyInfoArchiveRow("s-1", "2026-11-05", "예시상사"))!.표준산업분류).toBe(KSIC);
    mock(full.slice(4, 69));
    const old = (await readCompanyInfoArchiveRow("s-2", "2026-11-05", "예시상사"))!;
    expect(old.표준산업분류).toBe("");
    expect(old.공고특성).toBe("여성기업");
  });
});

describe("④ DB payload", () => {
  it("06 payload — 키 이름 우선, 열문자 BR 폴백, 옛 payload 는 ''", () => {
    expect(companyInfoFromDbPayload({ 표준산업분류: KSIC })!.표준산업분류).toBe(KSIC);
    expect(companyInfoFromDbPayload({ BQ: "여성기업", BR: KSIC })).toMatchObject({ 공고특성: "여성기업", 표준산업분류: KSIC });
    expect(companyInfoFromDbPayload({ 표준산업분류: KSIC, BR: "00000 다른 값" })!.표준산업분류).toBe(KSIC);
    expect(companyInfoFromDbPayload({ BQ: "여성기업" })!.표준산업분류).toBe("");
  });

  it("04 이월 payload 열문자 CJ → Meeting 복원", () => {
    const p = carriedMeetingPayload({ 원본id: "m-ks-001", raw: userEntered(meetingToRow(BASE)) }, "new-ks");
    expect(p.CJ).toBe(KSIC);
    expect(meetingFromDbPayload(p)!.업체정보!.표준산업분류).toBe(KSIC);
  });
});
