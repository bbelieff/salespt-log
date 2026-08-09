/**
 * R3-3 서비스 게이트 배선 — 계약 편집 유스케이스가 repo 로 syncDb 를 정확히 관통하는지.
 *  · 파일럿(8·9·연습·아레나)+DB켜짐 → syncDb=true(DB 동기 정본)
 *  · 비파일럿(7 등) 또는 DATABASE_URL 미설정 → syncDb=false(R2 미러) — 완전 불변
 * daily-source 게이트는 실제 사용(dbEnabled·cohort 만 제어). repo 경계는 스텁.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContractPayment } from "@/types";

const findUserByEmail = vi.fn();
const dbEnabled = vi.fn(() => true);
const updateUserFields = vi.fn();
const updateLinkFields = vi.fn();
const syncFeeFromContract = vi.fn();
const writeTermination = vi.fn();
const appendFromContract = vi.fn();
// BBE-53: addPriorContract 가 재시도 중복행 판정을 위해 항상 조회한다 — 실제 readAll 처럼
// 빈 배열이 기본(undefined 아님). 특정 케이스에서 기존 행을 흉내내려면 개별 테스트가 override.
const readAll = vi.fn(async () => [] as ContractPayment[]);

vi.mock("@/repo/users", () => ({
  findUserByEmail: (...a: unknown[]) => findUserByEmail(...(a as [])),
}));
vi.mock("@/repo/db/client", () => ({
  dbEnabled: (...a: unknown[]) => dbEnabled(...(a as [])),
}));
vi.mock("@/repo/db/read-daily", () => ({
  readContractsFromDb: vi.fn(),
  readCompanyInfoFromDb: vi.fn(),
}));
vi.mock("@/repo/contract-payment", () => ({
  appendFromContract: (...a: unknown[]) => appendFromContract(...(a as [])),
  clearRow: vi.fn(),
  readAll: (...a: unknown[]) => readAll(...(a as [])),
  readContractCascadeKey: vi.fn(),
  syncFeeFromContract: (...a: unknown[]) => syncFeeFromContract(...(a as [])),
  updateLinkFields: (...a: unknown[]) => updateLinkFields(...(a as [])),
  updateUserFields: (...a: unknown[]) => updateUserFields(...(a as [])),
}));
vi.mock("@/repo/contract-payment-termination", () => ({
  writeTermination: (...a: unknown[]) => writeTermination(...(a as [])),
}));
vi.mock("@/repo/meetings", () => ({
  findByDate: vi.fn(async () => []),
  updateMeeting: vi.fn(),
}));
vi.mock("@/repo/company-info-archive", () => ({
  readCompanyInfoArchiveRow: vi.fn(),
  renameCompanyInfoKey: vi.fn(),
  upsertCompanyInfoArchive: vi.fn(),
}));

import {
  addPriorContract,
  editContractLinkedFields,
  patchContractPayment,
  syncContractFee,
  terminateContract,
} from "@/service/contract-payment";

const EMAIL = "u@x.y";
const SHEET = "sheet-1";
const mkCp = (o: Partial<ContractPayment> = {}): ContractPayment =>
  ({ row: 9, 계약일: "2026-07-10", 업체명: "가나상사", 수임비: 1_000_000, ...o }) as ContractPayment;

function setCohort(cohort: string) {
  findUserByEmail.mockResolvedValue({ spreadsheetId: SHEET, cohort, email: EMAIL });
}

beforeEach(() => {
  for (const m of [findUserByEmail, dbEnabled, updateUserFields, updateLinkFields, syncFeeFromContract, writeTermination, appendFromContract, readAll])
    m.mockReset();
  dbEnabled.mockReturnValue(true);
  setCohort("8"); // 파일럿 기본
  updateUserFields.mockResolvedValue(undefined);
  updateLinkFields.mockResolvedValue(9);
  syncFeeFromContract.mockResolvedValue({ row: 9 });
  writeTermination.mockResolvedValue(undefined);
  appendFromContract.mockResolvedValue({ row: 9 });
  readAll.mockResolvedValue([]); // 기본 = 기존 행 없음(정상 append 경로)
});

describe("patchContractPayment — 수납 슬롯 편집 게이트", () => {
  it("파일럿 → updateUserFields({syncDb:true})", async () => {
    await patchContractPayment(EMAIL, mkCp());
    expect(updateUserFields).toHaveBeenCalledWith(SHEET, expect.anything(), { syncDb: true });
  });
  it("비파일럿(7기) → {syncDb:false}(R2 미러 불변)", async () => {
    setCohort("7");
    await patchContractPayment(EMAIL, mkCp());
    expect(updateUserFields).toHaveBeenCalledWith(SHEET, expect.anything(), { syncDb: false });
  });
  it("DATABASE_URL 미설정 → 파일럿도 {syncDb:false}(즉시 R2 복귀)", async () => {
    dbEnabled.mockReturnValue(false);
    await patchContractPayment(EMAIL, mkCp());
    expect(updateUserFields).toHaveBeenCalledWith(SHEET, expect.anything(), { syncDb: false });
  });
});

describe("terminateContract — 해지 게이트", () => {
  it("파일럿 → writeTermination(…, {syncDb:true})", async () => {
    await terminateContract(EMAIL, { row: 9, 사유: "폐업", 반환액: 0, 숨김: false });
    expect(writeTermination).toHaveBeenCalledWith(
      SHEET,
      9,
      expect.objectContaining({ 해지사유: "폐업", 반환액: 0, 해지숨김: false }),
      { syncDb: true },
    );
  });
  it("비파일럿 → {syncDb:false}", async () => {
    setCohort("7");
    await terminateContract(EMAIL, { row: 9, 사유: "폐업", 반환액: 0, 숨김: false });
    expect(writeTermination).toHaveBeenCalledWith(SHEET, 9, expect.anything(), { syncDb: false });
  });
});

describe("syncContractFee — 수임비 sync 게이트", () => {
  it("파일럿 → syncFeeFromContract(…, {syncDb:true})", async () => {
    await syncContractFee(EMAIL, { 계약일: "2026-07-10", 업체명: "가나상사", 수임비: 500 });
    expect(syncFeeFromContract).toHaveBeenCalledWith(SHEET, expect.anything(), { syncDb: true });
  });
  it("비파일럿 → {syncDb:false}", async () => {
    setCohort("7");
    await syncContractFee(EMAIL, { 계약일: "2026-07-10", 업체명: "가나상사", 수임비: 500 });
    expect(syncFeeFromContract).toHaveBeenCalledWith(SHEET, expect.anything(), { syncDb: false });
  });
});

describe("editContractLinkedFields — 링크/수임비 동시 편집 게이트", () => {
  it("파일럿 → updateLinkFields·syncFeeFromContract 둘 다 {syncDb:true}", async () => {
    await editContractLinkedFields(EMAIL, {
      meetingId: "m1",
      old: { 계약일: "2026-07-10", 업체명: "가나상사" },
      next: { 계약일: "2026-07-11", 업체명: "가나상사", 수임비: 700 },
    });
    expect(updateLinkFields).toHaveBeenCalledWith(
      SHEET,
      expect.anything(),
      expect.anything(),
      { syncDb: true },
    );
    expect(syncFeeFromContract).toHaveBeenCalledWith(SHEET, expect.anything(), { syncDb: true });
  });
  it("비파일럿 → 둘 다 {syncDb:false}(R2 미러 불변)", async () => {
    setCohort("7");
    await editContractLinkedFields(EMAIL, {
      meetingId: "m1",
      old: { 계약일: "2026-07-10", 업체명: "가나상사" },
      next: { 계약일: "2026-07-11", 업체명: "가나상사", 수임비: 700 },
    });
    expect(updateLinkFields).toHaveBeenCalledWith(SHEET, expect.anything(), expect.anything(), { syncDb: false });
    expect(syncFeeFromContract).toHaveBeenCalledWith(SHEET, expect.anything(), { syncDb: false });
  });
});

describe("addPriorContract — append 계열은 dual-sync 제외(중복행 방지, 리뷰 회귀 수정)", () => {
  it("파일럿이라도 updateUserFields 를 syncDb 인자 없이(=R2 미러) 호출 — throw-재시도 중복행 회피", async () => {
    await addPriorContract(EMAIL, mkCp({ row: undefined }));
    expect(appendFromContract).toHaveBeenCalledTimes(1);
    expect(updateUserFields).toHaveBeenCalledTimes(1);
    // 핵심: append 직후 필드채움은 dual-sync throw 경로를 타면 안 됨(재시도 시 append 재실행→중복).
    const opts = updateUserFields.mock.calls[0]?.[2];
    expect(opts?.syncDb).not.toBe(true);
  });

  // BBE-53 — 재시도 멱등: 같은 (계약일,업체명,수임비) 의 "이월+prior:" 행이 이미 있으면
  // 새 행을 append 하지 않고 그 행을 그대로 갱신한다(중복 계약행 = 매출 이중계상 방지).
  it("같은 (계약일·업체명·수임비) 의 이월 prior 행이 이미 있으면 append 없이 그 행을 갱신한다", async () => {
    readAll.mockResolvedValue([
      {
        row: 7,
        계약일: "2026-07-10",
        업체명: "가나상사",
        수임비: 1_000_000,
        구분: "이월",
        이월원본행id: "prior:existing-uuid",
      },
    ] as ContractPayment[]);

    const result = await addPriorContract(EMAIL, mkCp({ row: undefined }));

    expect(result.row).toBe(7);
    expect(appendFromContract).not.toHaveBeenCalled();
    expect(updateUserFields).toHaveBeenCalledTimes(1);
    expect(updateUserFields.mock.calls[0]?.[1]).toMatchObject({ row: 7 });
  });

  it("같은 날짜·업체라도 이월(prior:)이 아닌 정식 계약 행은 재시도 판정에서 제외된다(오매칭 방지)", async () => {
    readAll.mockResolvedValue([
      {
        row: 3,
        계약일: "2026-07-10",
        업체명: "가나상사",
        수임비: 1_000_000,
        구분: "", // 정식 계약(비이월) — prior 재시도 후보가 아님
        이월원본행id: "",
      },
    ] as ContractPayment[]);

    await addPriorContract(EMAIL, mkCp({ row: undefined }));

    // row 3(무관한 정식 계약)을 건드리지 않고 정상적으로 새 행을 append 해야 함.
    expect(appendFromContract).toHaveBeenCalledTimes(1);
  });
});
