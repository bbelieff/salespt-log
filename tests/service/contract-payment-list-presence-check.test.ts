/**
 * BBE-248 ② — loadContractPayments 저비용 존재확인(readFilledRowNumbers) 회귀.
 *
 * 이전(R3 §7-3 L4): DB read + 시트 전체(A:AO) read 를 항상 병렬 발사해 union 백필.
 * 이후(BBE-248): DB read + 시트 **C열 1개**(존재확인) 를 병렬 발사 — 빈틈 없으면 전체 시트
 * fetch(readAll) 를 생략하고 DB 결과만 반환. 빈틈 있거나 존재확인 자체가 실패하면 기존과
 * 동일하게 전체 union 폴백(정합성 보장은 100% 유지 — probabilistic 아님).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const findUserByEmail = vi.fn();
const dbEnabled = vi.fn(() => true);
const readContractsFromDb = vi.fn();
const readAll = vi.fn();
const readFilledRowNumbers = vi.fn();
const captureException = vi.fn();

vi.mock("@/repo/users", () => ({
  findUserByEmail: (...a: unknown[]) => findUserByEmail(...(a as [])),
}));
vi.mock("@/repo/db/client", () => ({
  dbEnabled: (...a: unknown[]) => dbEnabled(...(a as [])),
}));
vi.mock("@/repo/db/read-daily", () => ({
  readContractsFromDb: (...a: unknown[]) => readContractsFromDb(...(a as [])),
  readCompanyInfoFromDb: vi.fn(),
}));
vi.mock("@/repo/contract-payment", () => ({
  readAll: (...a: unknown[]) => readAll(...(a as [])),
  readFilledRowNumbers: (...a: unknown[]) => readFilledRowNumbers(...(a as [])),
  clearRow: vi.fn(),
  readContractCascadeKey: vi.fn(),
  syncFeeFromContract: vi.fn(),
  updateLinkFields: vi.fn(),
  updateUserFields: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: (...a: unknown[]) => captureException(...(a as [])) }));
vi.mock("@/service/meetings-write", () => ({
  findMeetingsByDateRecord: vi.fn(),
  patchMeetingRecord: vi.fn(),
}));
vi.mock("@/repo/company-info-archive", () => ({
  readCompanyInfoArchiveRow: vi.fn(),
  renameCompanyInfoKey: vi.fn(),
  upsertCompanyInfoArchive: vi.fn(),
}));
vi.mock("@/repo/contract-payment-termination", () => ({ writeTermination: vi.fn() }));
vi.mock("@/service/contract-payment-add", () => ({ addFromContract: vi.fn(), addPriorContract: vi.fn() }));

import { loadContractPayments } from "@/service/contract-payment";

const SHEET = "sheet-1";
const dbRow = (row: number, extra: Record<string, unknown> = {}) => ({ row, linkedMeetingId: "", ...extra });

beforeEach(() => {
  findUserByEmail.mockReset().mockResolvedValue({ spreadsheetId: SHEET, cohort: "8" });
  dbEnabled.mockReset().mockReturnValue(true);
  readContractsFromDb.mockReset();
  readAll.mockReset();
  readFilledRowNumbers.mockReset();
  captureException.mockReset();
});

describe("loadContractPayments — 파일럿, 빈틈 없음(흔한 경로)", () => {
  it("존재확인이 DB row 집합과 완전히 일치 — 전체 시트 read(readAll) 생략, DB 결과만 반환", async () => {
    readContractsFromDb.mockResolvedValue([dbRow(6), dbRow(7)]);
    readFilledRowNumbers.mockResolvedValue(new Set([6, 7]));
    const out = await loadContractPayments("u@x.y");
    expect(out).toEqual([dbRow(6), dbRow(7)]);
    expect(readAll).not.toHaveBeenCalled();
  });
});

describe("loadContractPayments — 빈틈 있음(append 미러 실패로 신규행 누락)", () => {
  it("존재확인에는 있지만 DB엔 없는 row 발견 → 전체 union 폴백(readAll 호출)", async () => {
    readContractsFromDb.mockResolvedValue([dbRow(6)]);
    readFilledRowNumbers.mockResolvedValue(new Set([6, 8])); // row 8 = 미러 실패 신규행
    readAll.mockResolvedValue([dbRow(6), dbRow(8, { v: "sheet-new" })]);
    const out = await loadContractPayments("u@x.y");
    expect(readAll).toHaveBeenCalledTimes(1);
    expect(out.map((r) => r.row)).toEqual([6, 8]);
  });

  it("전체 union 폴백 중 시트 read 마저 실패 — DB 정본만 반환(기존보다 나쁘지 않음)", async () => {
    readContractsFromDb.mockResolvedValue([dbRow(6)]);
    readFilledRowNumbers.mockResolvedValue(new Set([6, 8]));
    readAll.mockRejectedValue(new Error("sheets down"));
    const out = await loadContractPayments("u@x.y");
    expect(out).toEqual([dbRow(6)]);
  });
});

describe("loadContractPayments — 존재확인 자체 실패", () => {
  it("readFilledRowNumbers 실패 → 안전 기본값(기존 전체 union) 그대로 폴백", async () => {
    readContractsFromDb.mockResolvedValue([dbRow(6)]);
    readFilledRowNumbers.mockRejectedValue(new Error("sheets down"));
    readAll.mockResolvedValue([dbRow(6), dbRow(9, { v: "sheet-new" })]);
    const out = await loadContractPayments("u@x.y");
    expect(readAll).toHaveBeenCalledTimes(1);
    expect(out.map((r) => r.row)).toEqual([6, 9]);
  });
});

describe("loadContractPayments — DB read 실패", () => {
  it("기존처럼 시트 전체 fallback(readAll) — Sentry 기록 포함", async () => {
    readContractsFromDb.mockRejectedValue(new Error("db down"));
    readFilledRowNumbers.mockResolvedValue(new Set([6]));
    readAll.mockResolvedValue([dbRow(6)]);
    const out = await loadContractPayments("u@x.y");
    expect(out).toEqual([dbRow(6)]);
    expect(captureException).toHaveBeenCalled();
  });
});

describe("loadContractPayments — 비파일럿", () => {
  it("존재확인·DB read 둘 다 호출 안 함 — 기존 시트 경로 그대로", async () => {
    findUserByEmail.mockResolvedValue({ spreadsheetId: SHEET, cohort: "1" });
    readAll.mockResolvedValue([dbRow(6)]);
    const out = await loadContractPayments("u@x.y");
    expect(out).toEqual([dbRow(6)]);
    expect(readContractsFromDb).not.toHaveBeenCalled();
    expect(readFilledRowNumbers).not.toHaveBeenCalled();
  });
});
