/**
 * 「영업기록 없이 업체추가」(payment-standalone-company) 서비스 계약.
 *  · addStandaloneContract → appendFromContract(meetingId=manual:<key>, carryover 없음 = 이월 강제 X)
 *  · manual: 링크는 "연결 미팅 없음" — 편집 시 04 미팅 patch 금지, 삭제 cascade 가 미팅을 안 건드림
 *  · 해지 차감(terminatedByChannel/Week)은 manual 행을 세지 않는다(raw 미팅 계약수에 없음)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContractPayment } from "@/types";

const findUserByEmail = vi.fn();
const appendFromContract = vi.fn();
const updateLinkFields = vi.fn();
const syncFeeFromContract = vi.fn();
const clearRow = vi.fn();
const readContractCascadeKey = vi.fn();
const patchMeetingRecord = vi.fn();
const findMeetingsByDateRecord = vi.fn();

vi.mock("@/repo/users", () => ({ findUserByEmail: (...a: unknown[]) => findUserByEmail(...(a as [])) }));
vi.mock("@/repo/db/client", () => ({ dbEnabled: () => false }));
vi.mock("@/repo/db/read-daily", () => ({ readContractsFromDb: vi.fn(), readCompanyInfoFromDb: vi.fn() }));
vi.mock("@/repo/contract-payment", () => ({
  appendFromContract: (...a: unknown[]) => appendFromContract(...(a as [])),
  clearRow: (...a: unknown[]) => clearRow(...(a as [])),
  readAll: vi.fn(async () => []),
  readContractCascadeKey: (...a: unknown[]) => readContractCascadeKey(...(a as [])),
  readFilledRowNumbers: vi.fn(),
  syncFeeFromContract: (...a: unknown[]) => syncFeeFromContract(...(a as [])),
  updateLinkFields: (...a: unknown[]) => updateLinkFields(...(a as [])),
  updateUserFields: vi.fn(),
}));
vi.mock("@/repo/contract-payment-termination", () => ({ writeTermination: vi.fn() }));
vi.mock("@/repo/company-info-archive", () => ({
  readCompanyInfoArchiveRow: vi.fn(),
  renameCompanyInfoKey: vi.fn(),
  upsertCompanyInfoArchive: vi.fn(),
}));
vi.mock("@/service/meetings-write", () => ({
  findMeetingsByDateRecord: (...a: unknown[]) => findMeetingsByDateRecord(...(a as [])),
  patchMeetingRecord: (...a: unknown[]) => patchMeetingRecord(...(a as [])),
}));

import {
  addStandaloneContract,
  editContractLinkedFields,
  removeContractPaymentWithCascade,
} from "@/service/contract-payment";
import { terminatedByChannel, terminatedByWeek } from "@/service/termination-count";

const EMAIL = "hong@example.com";
const SHEET = "sheet-1";
const KEY = "11111111-1111-4111-8111-111111111111";
const LINK = "manual:" + KEY;

beforeEach(() => {
  vi.clearAllMocks();
  findUserByEmail.mockResolvedValue({ spreadsheetId: SHEET, cohort: "7", email: EMAIL });
  appendFromContract.mockResolvedValue({ row: 12 });
  updateLinkFields.mockResolvedValue(12);
  syncFeeFromContract.mockResolvedValue({ row: 12 });
  findMeetingsByDateRecord.mockResolvedValue([]);
  patchMeetingRecord.mockResolvedValue(undefined);
  clearRow.mockResolvedValue(undefined);
});

describe("addStandaloneContract", () => {
  it("meetingId=manual:<requestKey> 로 append 하고 carryover(이월 강제)는 넘기지 않는다", async () => {
    const res = await addStandaloneContract(EMAIL, { 계약일: "2026-09-10", 업체명: " 예시상사 ", 수임비: 3_000_000, requestKey: KEY });
    expect(res).toEqual({ row: 12 });
    expect(appendFromContract).toHaveBeenCalledTimes(1);
    const args = appendFromContract.mock.calls[0]!;
    expect(args[0]).toBe(SHEET);
    expect(args[1]).toEqual({ 계약일: "2026-09-10", 업체명: "예시상사", 수임비: 3_000_000, meetingId: LINK });
    expect(args[2]).toBeUndefined(); // carryover 없음 → 매출 귀속은 계약일(isCarryoverContract)
    expect(args[3]).toBeUndefined(); // opts 없음 → R2 미러(no-throw) 기본 경로
    expect(args[4]).toBeUndefined(); // dateCompanyFallback 안 씀 — 무관한 정식 계약행 오매칭 방지
  });

  it("같은 requestKey 재시도는 같은 meetingId 를 보낸다(repo upsert 가 같은 행을 찾음)", async () => {
    await addStandaloneContract(EMAIL, { 계약일: "2026-09-10", 업체명: "예시상사", 수임비: 0, requestKey: KEY });
    await addStandaloneContract(EMAIL, { 계약일: "2026-09-10", 업체명: "예시상사", 수임비: 0, requestKey: KEY });
    expect(appendFromContract.mock.calls[0]![1].meetingId).toBe(appendFromContract.mock.calls[1]![1].meetingId);
  });

  it("시트 쓰기 뒤 추가 작업이 없어 성공 후 throw 하지 않는다(미팅 조회·06 스냅샷 호출 0)", async () => {
    await expect(
      addStandaloneContract(EMAIL, { 계약일: "2026-09-10", 업체명: "예시상사", 수임비: 1, requestKey: KEY }),
    ).resolves.toEqual({ row: 12 });
    expect(findMeetingsByDateRecord).not.toHaveBeenCalled();
    expect(patchMeetingRecord).not.toHaveBeenCalled();
  });
});

describe("manual: 링크 = 연결 미팅 없음", () => {
  it("편집 — 02 는 manual 키로 찾되 04 미팅 patch 는 하지 않는다(가짜 조회·실패 표시 없음)", async () => {
    const res = await editContractLinkedFields(EMAIL, {
      meetingId: LINK,
      old: { 계약일: "2026-09-10", 업체명: "예시상사" },
      next: { 업체명: "예시상사2", 수임비: 5 },
    });
    expect(res.failures).toEqual([]);
    expect(updateLinkFields.mock.calls[0]![1]).toMatchObject({ meetingId: LINK });
    expect(patchMeetingRecord).not.toHaveBeenCalled();
  });

  it("편집 — 진짜 미팅 id 면 기존처럼 04 미팅도 patch", async () => {
    await editContractLinkedFields(EMAIL, {
      meetingId: "m-1",
      old: { 계약일: "2026-09-10", 업체명: "예시상사" },
      next: { 수임비: 5 },
    });
    expect(patchMeetingRecord).toHaveBeenCalledWith(expect.anything(), "m-1", { 수임비: 5 });
  });

  it("삭제 cascade — manual 행이면 같은 날짜·이름의 계약 미팅이 있어도 되돌리지 않는다", async () => {
    readContractCascadeKey.mockResolvedValue({ 계약일: "2026-09-10", 업체명: "예시상사", linkId: LINK });
    findMeetingsByDateRecord.mockResolvedValue([{ id: "m-9", 업체명: "예시상사", 상태: "계약" }]);
    const res = await removeContractPaymentWithCascade(EMAIL, 12);
    expect(clearRow).toHaveBeenCalled();
    expect(res.meetingId).toBeNull();
    expect(patchMeetingRecord).not.toHaveBeenCalled();
  });

  it("삭제 cascade — 일반 행은 기존처럼 매칭 미팅을 예약으로 되돌린다", async () => {
    readContractCascadeKey.mockResolvedValue({ 계약일: "2026-09-10", 업체명: "예시상사", linkId: "m-9" });
    findMeetingsByDateRecord.mockResolvedValue([{ id: "m-9", 업체명: "예시상사", 상태: "계약" }]);
    const res = await removeContractPaymentWithCascade(EMAIL, 12);
    expect(res.meetingId).toBe("m-9");
    expect(patchMeetingRecord).toHaveBeenCalledTimes(1);
  });

  it("해지 차감 — manual 행은 채널·주차 차감 모두에서 빠진다(폴백으로 엉뚱한 미팅에 붙지 않음)", () => {
    const manual = ContractPayment.parse({
      계약일: "2026-09-10", 업체명: "예시상사", 수임비: 1000, 해지일: "2026-09-12", linkedMeetingId: LINK,
    });
    const meeting = { id: "m-9", 미팅날짜: "2026-09-10", 업체명: "예시상사", channel: "현수막", 계약여부: true } as never;
    const byChannel = terminatedByChannel([manual], [meeting]);
    expect(byChannel.unknown).toBe(0);
    expect(Object.values(byChannel.byChannel).every((n) => n === 0)).toBe(true);
    expect(terminatedByWeek([manual], new Date("2026-09-05T00:00:00")).every((n) => n === 0)).toBe(true);
  });
});
