/**
 * 계약 행 찾기 — 파일럿은 DB 먼저(시트 미러가 밀려도 맞는 줄), 없거나 실패하면 예전 시트 경로(화석 B1).
 * 합성 데이터만(예시상사·가나상사).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContractPayment } from "@/types";

const readContractsFromDb = vi.fn();
const findRowByLink = vi.fn();
vi.mock("@/repo/db/read-daily", () => ({ readContractsFromDb: (...a: unknown[]) => readContractsFromDb(...a) }));
vi.mock("@/repo/contract-payment", () => ({ findRowByLink: (...a: unknown[]) => findRowByLink(...a) }));

const { findContractRow, matchContractRow } = await import("@/repo/contract-row-lookup");

const cp = (row: number, 계약일: string, 업체명: string, linkedMeetingId = "") =>
  ({ row, 계약일, 업체명, linkedMeetingId }) as unknown as ContractPayment;

describe("matchContractRow — 시트 경로와 같은 규칙", () => {
  const rows = [cp(9, "2026-10-01", "예시상사", "m2"), cp(7, "2026-10-01", "예시상사", "m1"), cp(8, "2026-10-02", "가나상사", "manual:k1")];

  it("미팅 id 가 있으면 id 로 — 같은 날·같은 업체 계약이 둘이어도 내 계약", () => {
    expect(matchContractRow(rows, { meetingId: "m2", 계약일: "2026-10-01", 업체명: "예시상사" })).toBe(9);
  });
  it("id 로 못 찾으면 계약일+업체명, 가장 앞 줄", () => {
    expect(matchContractRow(rows, { meetingId: "없음", 계약일: "2026-10-01", 업체명: " 예시상사 " })).toBe(7);
  });
  it("영업기록 없이 추가(manual) 행은 날짜·이름으로 잡지 않는다", () => {
    expect(matchContractRow(rows, { 계약일: "2026-10-02", 업체명: "가나상사" })).toBeNull();
  });
  it("manual 행도 자기 id 로는 찾는다", () => {
    expect(matchContractRow(rows, { meetingId: "manual:k1" })).toBe(8);
  });
});

describe("findContractRow", () => {
  beforeEach(() => {
    readContractsFromDb.mockReset();
    findRowByLink.mockReset();
    findRowByLink.mockResolvedValue(42);
  });

  it("파일럿: DB 에서 찾으면 시트를 읽지 않는다", async () => {
    readContractsFromDb.mockResolvedValue([cp(7, "2026-10-01", "예시상사", "m1")]);
    expect(await findContractRow("s", { meetingId: "m1" }, { syncDb: true })).toBe(7);
    expect(findRowByLink).not.toHaveBeenCalled();
  });
  it("파일럿: DB 에 없으면 예전 시트 경로", async () => {
    readContractsFromDb.mockResolvedValue([]);
    expect(await findContractRow("s", { meetingId: "m1" }, { syncDb: true })).toBe(42);
    expect(findRowByLink).toHaveBeenCalledWith("s", { meetingId: "m1" });
  });
  it("파일럿: DB 읽기가 실패해도 예전 시트 경로", async () => {
    readContractsFromDb.mockRejectedValue(new Error("connection terminated"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await findContractRow("s", { meetingId: "m1" }, { syncDb: true })).toBe(42);
    warn.mockRestore();
  });
  it("비파일럿: DB 를 보지 않고 시트", async () => {
    expect(await findContractRow("s", { meetingId: "m1" })).toBe(42);
    expect(readContractsFromDb).not.toHaveBeenCalled();
  });
});
