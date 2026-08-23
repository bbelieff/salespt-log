/**
 * R3-3 잔여 — 미팅 화면(04)발 02 계약 쓰기 6경로의 dual-sync 게이트.
 *
 * 버그: contact.ts 의 clearRowByLink(5경로)·updateLinkFields(1경로) 호출이 `{syncDb}` 없이 나가서,
 * 파일럿(02 화면 = DB read)에서는 fire-and-forget 미러가 최종 실패하면 **시트에서 지운 계약이 DB 에
 * 살아남는다** → 유령 계약카드·매출 과대집계. 읽기는 이미 DB(R2-4)라 read-your-writes 위반.
 * 수리: 파일럿이면 `{syncDb:true}` 로 DB 동기 정본(repo 에서 DB-first 순서), 비파일럿은 기존 그대로.
 *
 * 게이트는 실제 사용(daily-source). repo 경계는 스텁.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Meeting } from "@/types";

const findUserByEmail = vi.fn();
const dbEnabled = vi.fn(() => true);
const getMeetingRecord = vi.fn();
const patchMeetingRecord = vi.fn();
const clearMeetingRecord = vi.fn();
const findChildMeetingRecord = vi.fn();
const clearRowByLink = vi.fn();
const updateLinkFields = vi.fn();
const persistMeetingReservationCount = vi.fn();

vi.mock("@/repo/users", () => ({
  findUserByEmail: (...a: unknown[]) => findUserByEmail(...(a as [])),
}));
vi.mock("@/repo/db/client", () => ({
  dbEnabled: (...a: unknown[]) => dbEnabled(...(a as [])),
  readSalesRowsFromDb: vi.fn(),
}));
vi.mock("@/repo/db", () => ({ readBanners: vi.fn() }));
vi.mock("@/repo/dashboard", () => ({ readChannelStacking: vi.fn() }));
vi.mock("@/repo/db/read-daily", () => ({
  readBannerOrderQtyFromDb: vi.fn(),
  readMeetingsFromDb: vi.fn(async () => []),
}));
vi.mock("@/repo/sales", () => ({
  decrementMeetingReservation: vi.fn(),
  readCourseStart: vi.fn(),
  readWeek: vi.fn(),
  readWeekFunnel: vi.fn(),
  weekIndexOf: vi.fn(),
}));
vi.mock("@/repo/meetings", () => ({ findByDate: vi.fn(async () => []) }));
vi.mock("@/service/meetings-write", () => ({
  clearMeetingRecord: (...a: unknown[]) => clearMeetingRecord(...(a as [])),
  createMeetingRecord: vi.fn(),
  findChildMeetingRecord: (...a: unknown[]) => findChildMeetingRecord(...(a as [])),
  findMeetingsByDateRecord: vi.fn(async () => []),
  getMeetingRecord: (...a: unknown[]) => getMeetingRecord(...(a as [])),
  patchMeetingRecord: (...a: unknown[]) => patchMeetingRecord(...(a as [])),
}));
vi.mock("@/service/sales-write", () => ({
  persistSalesRows: vi.fn(),
  persistMeetingReservationCount: (...a: unknown[]) => persistMeetingReservationCount(...(a as [])),
}));
vi.mock("@/service/db", () => ({ syncDirectProductionForDate: vi.fn() }));
vi.mock("@/repo/contract-payment", () => ({
  clearRowByLink: (...a: unknown[]) => clearRowByLink(...(a as [])),
  updateLinkFields: (...a: unknown[]) => updateLinkFields(...(a as [])),
}));
vi.mock("@/repo/company-info-archive", () => ({
  hasCompanyInfoArchiveRow: vi.fn(async () => false),
  renameCompanyInfoKey: vi.fn(),
  upsertCompanyInfoArchive: vi.fn(),
}));

import {
  patchMeeting,
  removeMeetingWithCascade,
  revertMeeting,
  reviveCaseClosure,
} from "@/service/contact";

const EMAIL = "u@x.y";
const SHEET = "sheet-1";
const CONTRACT = {
  id: "m1",
  미팅날짜: "2026-07-10",
  업체명: "가나상사",
  상태: "계약",
  예약일: "2026-07-01",
  channel: "매입DB",
};

function setCohort(cohort: string) {
  findUserByEmail.mockResolvedValue({ spreadsheetId: SHEET, cohort, email: EMAIL });
}

beforeEach(() => {
  for (const m of [findUserByEmail, dbEnabled, getMeetingRecord, patchMeetingRecord,
    clearMeetingRecord, findChildMeetingRecord, clearRowByLink, updateLinkFields,
    persistMeetingReservationCount]) m.mockReset();
  dbEnabled.mockReturnValue(true);
  setCohort("8"); // 파일럿 기본
  getMeetingRecord.mockResolvedValue(CONTRACT);
  patchMeetingRecord.mockResolvedValue(CONTRACT);
  findChildMeetingRecord.mockResolvedValue(null);
  clearRowByLink.mockResolvedValue(7);
  updateLinkFields.mockResolvedValue(7);
});

/** 마지막 clearRowByLink 호출의 opts 인자(4번째). */
function lastClearOpts(): unknown {
  const calls = clearRowByLink.mock.calls;
  return calls[calls.length - 1]?.[3];
}

describe("① 계약→비계약 수정 (patchMeeting)", () => {
  const DROP = { 상태: "예약" } as Partial<Omit<Meeting, "id">>;

  it("파일럿 → clearRowByLink(…, {syncDb:true})", async () => {
    await patchMeeting(EMAIL, "m1", DROP);
    expect(clearRowByLink).toHaveBeenCalledWith(SHEET, "2026-07-10", "가나상사", { syncDb: true });
  });

  it("비파일럿(7기) → {syncDb:false} (R2 async 미러 불변)", async () => {
    setCohort("1");
    await patchMeeting(EMAIL, "m1", DROP);
    expect(lastClearOpts()).toEqual({ syncDb: false });
  });

  it("DATABASE_URL 미설정 → 파일럿도 {syncDb:false} (롤백 스위치)", async () => {
    dbEnabled.mockReturnValue(false);
    await patchMeeting(EMAIL, "m1", DROP);
    expect(lastClearOpts()).toEqual({ syncDb: false });
  });
});

describe("② 계약 미팅의 날짜·업체명 수정 (patchMeeting 링크 편집)", () => {
  const RENAME = { 업체명: "새상사" } as Partial<Omit<Meeting, "id">>;

  it("파일럿 → updateLinkFields(…, {syncDb:true}) + meetingId 키 유지", async () => {
    await patchMeeting(EMAIL, "m1", RENAME);
    expect(updateLinkFields).toHaveBeenCalledWith(
      SHEET,
      expect.objectContaining({ meetingId: "m1", 업체명: "가나상사" }),
      expect.objectContaining({ 업체명: "새상사" }),
      { syncDb: true },
    );
  });

  it("비파일럿 → {syncDb:false}", async () => {
    setCohort("1");
    await patchMeeting(EMAIL, "m1", RENAME);
    const calls = updateLinkFields.mock.calls;
    expect(calls[calls.length - 1]?.[3]).toEqual({ syncDb: false });
  });
});

describe("③④ 미팅 삭제 cascade (본인 계약 + 자손 계약)", () => {
  it("파일럿 → 본인 계약 clear 가 {syncDb:true}", async () => {
    await removeMeetingWithCascade(EMAIL, "m1");
    expect(lastClearOpts()).toEqual({ syncDb: true });
  });

  it("파일럿 → 자손 계약 clear 도 {syncDb:true}", async () => {
    findChildMeetingRecord.mockResolvedValueOnce({ ...CONTRACT, id: "child" });
    await removeMeetingWithCascade(EMAIL, "m1");
    // 자손(1건) + 본인(1건) = 2회 모두 동기 정본
    expect(clearRowByLink).toHaveBeenCalledTimes(2);
    for (const c of clearRowByLink.mock.calls) expect(c[3]).toEqual({ syncDb: true });
  });

  it("비파일럿 → 전부 {syncDb:false}", async () => {
    setCohort("1");
    findChildMeetingRecord.mockResolvedValueOnce({ ...CONTRACT, id: "child" });
    await removeMeetingWithCascade(EMAIL, "m1");
    for (const c of clearRowByLink.mock.calls) expect(c[3]).toEqual({ syncDb: false });
  });

  it("파일럿 DB 동기 실패 → 삼키지 않고 throw (조용한 반쪽 삭제 금지)", async () => {
    clearRowByLink.mockRejectedValueOnce(new Error("db down"));
    await expect(removeMeetingWithCascade(EMAIL, "m1")).rejects.toThrow("db down");
  });
});

describe("⑤ 미팅 결과 되돌리기 (계약→예약)", () => {
  it("파일럿 → {syncDb:true}", async () => {
    await revertMeeting(EMAIL, "m1");
    expect(lastClearOpts()).toEqual({ syncDb: true });
  });

  it("비파일럿 → {syncDb:false}", async () => {
    setCohort("1");
    await revertMeeting(EMAIL, "m1");
    expect(lastClearOpts()).toEqual({ syncDb: false });
  });
});

describe("⑥ 케이스 되살리기 cascade (reviveCaseClosure)", () => {
  it("파일럿 → 자식 계약 clear 가 {syncDb:true}", async () => {
    findChildMeetingRecord.mockResolvedValueOnce({ ...CONTRACT, id: "child" });
    await reviveCaseClosure(EMAIL, "parent");
    expect(lastClearOpts()).toEqual({ syncDb: true });
  });
});
