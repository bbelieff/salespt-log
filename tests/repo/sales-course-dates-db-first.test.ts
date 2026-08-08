/**
 * lib/repo/sales.ts readCourseStart/readGraduation — DB-우선·시트-폴백 배선 회귀 (BBE-57).
 * 고정하는 계약:
 *   ① courseDateDbReadEnabled()=false(기본) → 기존 시트 경로 그대로, DB read 함수 호출 자체 안 함.
 *   ② enabled=true 이고 DB 에 값 있음 → 시트 API(get) 호출 안 함(quota 절약).
 *   ③ enabled=true 이지만 DB 에 값 없음(backfill 전·2/53 파싱실패 시트) → 시트 폴백, 기존 throw 메시지 불변.
 *   ④ 시트 폴백 시 UNFORMATTED_VALUE/SERIAL_NUMBER 직렬값 파싱 로직 그대로 재사용.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const valuesGet = vi.fn();
const courseDateDbReadEnabled = vi.fn(() => false);
const readCourseDatesFromDb = vi.fn();

vi.mock("@/repo/sheets-client", () => ({
  sheetsClient: () => ({ spreadsheets: { values: { get: valuesGet } } }),
}));
vi.mock("@/repo/db/course-dates", () => ({
  courseDateDbReadEnabled: (...a: unknown[]) => courseDateDbReadEnabled(...(a as [])),
  readCourseDatesFromDb: (...a: unknown[]) => readCourseDatesFromDb(...(a as [])),
}));

import { readCourseStart, readGraduation } from "@/repo/sales";

// Google Sheets serial: 2026-06-01 = 46174 (days since 1899-12-30)
const SERIAL_2026_06_01 = 46174;
const SERIAL_2026_07_21 = 46224;

beforeEach(() => {
  valuesGet.mockReset();
  courseDateDbReadEnabled.mockReset().mockReturnValue(false);
  readCourseDatesFromDb.mockReset().mockResolvedValue(null);
});

describe("게이트 OFF(기본) — 기존 시트 경로 완전 불변", () => {
  it("readCourseStart: readCourseDatesFromDb 호출 자체 안 함, 시트 직렬값 파싱", async () => {
    valuesGet.mockResolvedValue({ data: { values: [[SERIAL_2026_06_01]] } });
    const d = await readCourseStart("sheet-1");
    expect(readCourseDatesFromDb).not.toHaveBeenCalled();
    expect(valuesGet).toHaveBeenCalledTimes(1);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // 0-based → 6월
    expect(d.getDate()).toBe(1);
  });

  it("readGraduation: 동일하게 DB 미조회, 시트 폴백", async () => {
    valuesGet.mockResolvedValue({ data: { values: [[SERIAL_2026_07_21]] } });
    const d = await readGraduation("sheet-1");
    expect(readCourseDatesFromDb).not.toHaveBeenCalled();
    expect(d.getMonth()).toBe(6); // 7월
  });

  it("O1 빈값 → 기존 throw 메시지 그대로(회귀 방지)", async () => {
    valuesGet.mockResolvedValue({ data: { values: [[]] } });
    await expect(readCourseStart("sheet-1")).rejects.toThrow(/수강시작일이 비어있습니다/);
  });

  it("O1 파싱 실패(2/53 사고 케이스 — 원본 시트 서식 문제) → 기존 throw 메시지 그대로", async () => {
    valuesGet.mockResolvedValue({ data: { values: [["이상한값"]] } });
    await expect(readCourseStart("sheet-1")).rejects.toThrow(/O1\(수강시작일\) 파싱 실패/);
  });
});

describe("게이트 ON — DB 값 있으면 시트 API 호출 안 함", () => {
  beforeEach(() => courseDateDbReadEnabled.mockReturnValue(true));

  it("readCourseStart: DB 값 있으면 시트 get() 호출 0회, DB ISO 파싱해 반환", async () => {
    readCourseDatesFromDb.mockResolvedValue({
      courseStartISO: "2026-06-01",
      graduationISO: "2026-07-21",
    });
    const d = await readCourseStart("sheet-1");
    expect(valuesGet).not.toHaveBeenCalled();
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(1);
  });

  it("readGraduation: DB 값 있으면 시트 미호출, graduationISO 반영", async () => {
    readCourseDatesFromDb.mockResolvedValue({
      courseStartISO: "2026-06-01",
      graduationISO: "2026-07-21",
    });
    const d = await readGraduation("sheet-1");
    expect(valuesGet).not.toHaveBeenCalled();
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(21);
  });
});

describe("게이트 ON 이지만 DB 값 없음 — 시트 폴백(2/53 파싱실패 시트 포함, 동작 불변)", () => {
  beforeEach(() => courseDateDbReadEnabled.mockReturnValue(true));

  it("readCourseDatesFromDb=null → 시트 get() 호출, 정상 파싱", async () => {
    readCourseDatesFromDb.mockResolvedValue(null);
    valuesGet.mockResolvedValue({ data: { values: [[SERIAL_2026_06_01]] } });
    const d = await readCourseStart("sheet-1");
    expect(valuesGet).toHaveBeenCalledTimes(1);
    expect(d.getDate()).toBe(1);
  });

  it("readCourseDatesFromDb.courseStartISO 빈 문자열(부분 backfill) → 시트 폴백", async () => {
    readCourseDatesFromDb.mockResolvedValue({ courseStartISO: "", graduationISO: "" });
    valuesGet.mockResolvedValue({ data: { values: [[SERIAL_2026_06_01]] } });
    await readCourseStart("sheet-1");
    expect(valuesGet).toHaveBeenCalledTimes(1);
  });

  it("DB 미조회 상태에서 시트도 파싱 실패(2/53 사고 케이스) → 여전히 throw, 마스킹 안 됨", async () => {
    readCourseDatesFromDb.mockResolvedValue(null);
    valuesGet.mockResolvedValue({ data: { values: [["망가진값"]] } });
    await expect(readCourseStart("sheet-1")).rejects.toThrow(/O1\(수강시작일\) 파싱 실패/);
  });
});
