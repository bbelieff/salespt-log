/**
 * R3-3 fix-forward 회귀 — patchMeeting(04 화면의 06 업체정보 편집)의 파일럿 silent 반쪽쓰기 방지.
 *
 * 버그(DevD 플래그): patchMeeting 이 06 upsert 를 syncDb 없이(async 미러) 호출 → 파일럿에서 미러가
 * 드롭하면 DB 에 stale non-empty 06 이 남고, loadCompanyInfoByContract 가 그 stale 을 반환(시트 폴백은
 * 빈 DB 에서만) → 결제카드가 옛 값 표시·무에러·200 = 조용한 반쪽쓰기.
 * 수리: 파일럿은 06 을 DB 동기 정본({syncDb:true})으로 + 실패는 삼키지 않고 throw(loud). 비파일럿 불변.
 *
 * 게이트는 실제 사용(daily-source). repo 경계는 스텁.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Meeting } from "@/types";

const findUserByEmail = vi.fn();
const dbEnabled = vi.fn(() => true);
const getMeetingRecord = vi.fn();
const patchMeetingRecord = vi.fn();
const upsertCompanyInfoArchive = vi.fn();
const renameCompanyInfoKey = vi.fn();
const hasCompanyInfoArchiveRow = vi.fn(async () => true);

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
  clearMeetingRecord: vi.fn(),
  createMeetingRecord: vi.fn(),
  findChildMeetingRecord: vi.fn(),
  findMeetingsByDateRecord: vi.fn(async () => []),
  getMeetingRecord: (...a: unknown[]) => getMeetingRecord(...(a as [])),
  patchMeetingRecord: (...a: unknown[]) => patchMeetingRecord(...(a as [])),
}));
vi.mock("@/service/sales-write", () => ({ persistSalesRows: vi.fn() }));
vi.mock("@/service/db", () => ({ syncDirectProductionForDate: vi.fn() }));
vi.mock("@/repo/contract-payment", () => ({
  clearRowByLink: vi.fn(),
  updateLinkFields: vi.fn(),
}));
vi.mock("@/repo/company-info-archive", () => ({
  hasCompanyInfoArchiveRow: (...a: unknown[]) => hasCompanyInfoArchiveRow(...(a as [])),
  renameCompanyInfoKey: (...a: unknown[]) => renameCompanyInfoKey(...(a as [])),
  upsertCompanyInfoArchive: (...a: unknown[]) => upsertCompanyInfoArchive(...(a as [])),
}));

import { patchMeeting } from "@/service/contact";

const EMAIL = "u@x.y";
const SHEET = "sheet-1";
// 계약 상태 미팅 — 06 sync 조건(m.상태==="계약") 충족.
const MERGED = {
  id: "m1",
  미팅날짜: "2026-07-10",
  업체명: "가나상사",
  상태: "계약",
  업체정보: { 개업일: "2021-01-01" },
};

function setCohort(cohort: string) {
  findUserByEmail.mockResolvedValue({ spreadsheetId: SHEET, cohort, email: EMAIL });
}

beforeEach(() => {
  for (const m of [findUserByEmail, dbEnabled, getMeetingRecord, patchMeetingRecord, upsertCompanyInfoArchive, renameCompanyInfoKey, hasCompanyInfoArchiveRow])
    m.mockReset();
  dbEnabled.mockReturnValue(true);
  setCohort("8"); // 파일럿 기본
  patchMeetingRecord.mockResolvedValue(MERGED);
  getMeetingRecord.mockResolvedValue(MERGED);
  upsertCompanyInfoArchive.mockResolvedValue({ row: 2, created: false });
  renameCompanyInfoKey.mockResolvedValue({ moved: true });
  hasCompanyInfoArchiveRow.mockResolvedValue(true);
});

const EDIT = { 업체정보: { 개업일: "2021-01-01" } } as Partial<Omit<Meeting, "id">>;

describe("patchMeeting 06 업체정보 sync — 파일럿 dual-sync 게이트", () => {
  it("파일럿 → upsertCompanyInfoArchive(…, {syncDb:true})", async () => {
    await patchMeeting(EMAIL, "m1", EDIT);
    expect(upsertCompanyInfoArchive).toHaveBeenCalledWith(
      SHEET,
      expect.objectContaining({ 업체명: "가나상사", 계약일: "2026-07-10" }),
      { syncDb: true },
    );
  });

  it("비파일럿(7기) → {syncDb:false}(R2 async 미러 불변)", async () => {
    setCohort("1");
    await patchMeeting(EMAIL, "m1", EDIT);
    expect(upsertCompanyInfoArchive).toHaveBeenCalledWith(SHEET, expect.anything(), { syncDb: false });
  });

  it("DATABASE_URL 미설정 → 파일럿도 {syncDb:false}(즉시 R2 복귀)", async () => {
    dbEnabled.mockReturnValue(false);
    await patchMeeting(EMAIL, "m1", EDIT);
    expect(upsertCompanyInfoArchive).toHaveBeenCalledWith(SHEET, expect.anything(), { syncDb: false });
  });
});

describe("🐛 반쪽쓰기 재현 고정 — 파일럿 06 DB 동기 실패는 삼키지 않는다", () => {
  it("파일럿 + 06 upsert 실패 → patchMeeting THROW(loud, 조용한 반쪽쓰기 아님)", async () => {
    upsertCompanyInfoArchive.mockRejectedValue(
      new Error("저장이 화면 데이터에 아직 반영되지 않았어요. 잠시 후 다시 시도해 주세요."),
    );
    // 수리 전: warn 삼킴 → resolve(=silent 반쪽쓰기). 수리 후: 파일럿은 throw.
    await expect(patchMeeting(EMAIL, "m1", EDIT)).rejects.toThrow("반영되지 않았어요");
  });

  it("비파일럿 + 06 미러 실패 → warn 삼킴, patchMeeting 정상 종료(04 저장 성공 불변)", async () => {
    setCohort("1");
    upsertCompanyInfoArchive.mockRejectedValue(new Error("mirror drop"));
    await expect(patchMeeting(EMAIL, "m1", EDIT)).resolves.toBeUndefined();
  });
});
