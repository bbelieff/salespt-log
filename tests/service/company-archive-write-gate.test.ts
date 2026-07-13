/**
 * R3-3 PR-2 서비스 게이트 배선 — 06 업체정보 쓰기 유스케이스가 repo 로 syncDb 를 정확히 관통하는지.
 *  · 파일럿(8·9·연습·아레나)+DB켜짐 → syncDb=true(06 DB 동기 정본)
 *  · 비파일럿(7 등) 또는 DATABASE_URL 미설정 → syncDb=false(R2 미러) — 완전 불변(롤백 스위치)
 * daily-source 게이트는 실제 사용(dbEnabled·cohort 만 제어). repo 경계는 스텁.
 *
 * 대상: saveCompanyInfoByContract(직접 저장 upsert) · editContractLinkedFields(개명 rename).
 * 스코프 주의: addFromContract·patchMeeting cascade 는 2차효과(warn-wrapped·read fallback)라
 * dual-sync 제외 → 여기서 검증 안 함(그 경로는 R2 async 미러 유지가 정본).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompanyInfo } from "@/types";

const findUserByEmail = vi.fn();
const dbEnabled = vi.fn(() => true);
const upsertCompanyInfoArchive = vi.fn();
const renameCompanyInfoKey = vi.fn();
const updateLinkFields = vi.fn();
const syncFeeFromContract = vi.fn();

vi.mock("@/repo/users", () => ({
  findUserByEmail: (...a: unknown[]) => findUserByEmail(...(a as [])),
}));
vi.mock("@/repo/db/client", () => ({
  dbEnabled: (...a: unknown[]) => dbEnabled(...(a as [])),
}));
vi.mock("@/repo/db/read-daily", () => ({
  readContractsFromDb: vi.fn(),
  readCompanyInfoFromDb: vi.fn(),
  readMeetingsFromDb: vi.fn(async () => []), // R3-2(#541): findMeetingsByDateRecord 파일럿 경로 — 매칭 0 → patchMeetingRecord 우회
}));
vi.mock("@/repo/contract-payment", () => ({
  appendFromContract: vi.fn(),
  clearRow: vi.fn(),
  readAll: vi.fn(),
  readContractCascadeKey: vi.fn(),
  syncFeeFromContract: (...a: unknown[]) => syncFeeFromContract(...(a as [])),
  updateLinkFields: (...a: unknown[]) => updateLinkFields(...(a as [])),
  updateUserFields: vi.fn(),
}));
vi.mock("@/repo/contract-payment-termination", () => ({
  writeTermination: vi.fn(),
}));
vi.mock("@/repo/meetings", () => ({
  findByDate: vi.fn(async () => []), // 매칭 미팅 없음 → updateMeeting 우회
  updateMeeting: vi.fn(),
  findById: vi.fn(), // #541: patchMeetingRecord→gcal reconcile(fire-and-forget) 경로 무해화
}));
vi.mock("@/repo/company-info-archive", () => ({
  readCompanyInfoArchiveRow: vi.fn(),
  renameCompanyInfoKey: (...a: unknown[]) => renameCompanyInfoKey(...(a as [])),
  upsertCompanyInfoArchive: (...a: unknown[]) => upsertCompanyInfoArchive(...(a as [])),
}));

import {
  editContractLinkedFields,
  saveCompanyInfoByContract,
} from "@/service/contract-payment";

const EMAIL = "u@x.y";
const SHEET = "sheet-1";
const CI = { 개업일: "2020-01-01" } as CompanyInfo;

function setCohort(cohort: string) {
  findUserByEmail.mockResolvedValue({ spreadsheetId: SHEET, cohort, email: EMAIL });
}

beforeEach(() => {
  for (const m of [findUserByEmail, dbEnabled, upsertCompanyInfoArchive, renameCompanyInfoKey, updateLinkFields, syncFeeFromContract])
    m.mockReset();
  dbEnabled.mockReturnValue(true);
  setCohort("8"); // 파일럿 기본
  upsertCompanyInfoArchive.mockResolvedValue({ row: 2, created: false });
  renameCompanyInfoKey.mockResolvedValue({ moved: true });
  updateLinkFields.mockResolvedValue(9);
  syncFeeFromContract.mockResolvedValue({ row: 9 });
});

describe("saveCompanyInfoByContract — 직접 저장 upsert 게이트", () => {
  it("파일럿 → upsertCompanyInfoArchive(…, {syncDb:true})", async () => {
    await saveCompanyInfoByContract(EMAIL, { 계약일: "2026-07-10", 업체명: "가나상사", 업체정보: CI });
    expect(upsertCompanyInfoArchive).toHaveBeenCalledWith(
      SHEET,
      expect.objectContaining({ 업체명: "가나상사" }),
      { syncDb: true },
    );
  });
  it("비파일럿(7기) → {syncDb:false}(R2 미러 불변)", async () => {
    setCohort("7");
    await saveCompanyInfoByContract(EMAIL, { 계약일: "2026-07-10", 업체명: "가나상사", 업체정보: CI });
    expect(upsertCompanyInfoArchive).toHaveBeenCalledWith(SHEET, expect.anything(), { syncDb: false });
  });
  it("DATABASE_URL 미설정 → 파일럿도 {syncDb:false}(즉시 R2 복귀)", async () => {
    dbEnabled.mockReturnValue(false);
    await saveCompanyInfoByContract(EMAIL, { 계약일: "2026-07-10", 업체명: "가나상사", 업체정보: CI });
    expect(upsertCompanyInfoArchive).toHaveBeenCalledWith(SHEET, expect.anything(), { syncDb: false });
  });
});

describe("editContractLinkedFields — 개명 시 06 rename 게이트", () => {
  it("파일럿 + 업체명 변경 → renameCompanyInfoKey(…, {syncDb:true})", async () => {
    await editContractLinkedFields(EMAIL, {
      meetingId: "m1",
      old: { 계약일: "2026-07-10", 업체명: "가나상사" },
      next: { 업체명: "새이름상사" },
    });
    expect(renameCompanyInfoKey).toHaveBeenCalledWith(
      SHEET,
      { 계약일: "2026-07-10", 업체명: "가나상사" },
      { 계약일: "2026-07-10", 업체명: "새이름상사" },
      { syncDb: true },
    );
  });
  it("비파일럿 → {syncDb:false}(R2 미러 불변)", async () => {
    setCohort("7");
    await editContractLinkedFields(EMAIL, {
      meetingId: "m1",
      old: { 계약일: "2026-07-10", 업체명: "가나상사" },
      next: { 업체명: "새이름상사" },
    });
    expect(renameCompanyInfoKey).toHaveBeenCalledWith(
      SHEET,
      expect.anything(),
      expect.anything(),
      { syncDb: false },
    );
  });
});
