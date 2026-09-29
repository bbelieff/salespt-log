/**
 * 「영업기록 없이 추가」 업체 ↔ 미팅 연결 서비스(contract-meeting-link, 2026-09-29). 합성 데이터만.
 * 핵심: 새 계약 행을 만들지 않고(매출 이중계상 0) 같은 02 행을 미팅에 붙이며, 계약일=미팅 날짜,
 * 할일·업체정보를 새 키로 옮긴다. 이미 연결된 행·미팅은 거절.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContractPayment, Meeting, Todo } from "@/types";

const relinkContractRow = vi.fn();
const renameCompanyInfoKey = vi.fn(async () => ({ moved: true }));
const upsertCompanyInfoArchive = vi.fn();
const persistCompanyArchiveRename = vi.fn();
const patchMeetingRecord = vi.fn();
const getMeetingRecord = vi.fn();
const listAllMeetingsRecord = vi.fn();
const loadContractPayments = vi.fn();
const listTodos = vi.fn();
const patchTodo = vi.fn();

vi.mock("@/repo/contract-payment", () => ({ relinkContractRow: (...a: unknown[]) => relinkContractRow(...a) }));
vi.mock("@/repo/company-info-archive", () => ({
  companyContractRef: (d: string, n: string) => `${d}|${n.trim()}`,
  readCompanyInfoArchiveRow: vi.fn(async () => null),
  renameCompanyInfoKey: (...a: unknown[]) => renameCompanyInfoKey(...(a as [])),
  upsertCompanyInfoArchive: (...a: unknown[]) => upsertCompanyInfoArchive(...a),
}));
vi.mock("@/repo/db/company-archive-sync", () => ({
  persistCompanyArchiveRename: (...a: unknown[]) => persistCompanyArchiveRename(...a),
}));
const readContractsFromDb = vi.fn();
vi.mock("@/repo/db/read-daily", () => ({
  readContractsFromDb: (...a: unknown[]) => readContractsFromDb(...a),
  readCompanyInfoFromDb: vi.fn(async () => null),
}));
vi.mock("@/repo/db/row-updated-at", () => ({
  readRowsUpdatedAt: vi.fn(async () => ({
    "meetings:m1": "2026-09-20T00:00:00.000Z",
    "contracts:r7": "2026-09-10T00:00:00.000Z",
  })),
}));
vi.mock("@/service/meetings-write", () => ({
  getMeetingRecord: (...a: unknown[]) => getMeetingRecord(...a),
  listAllMeetingsRecord: (...a: unknown[]) => listAllMeetingsRecord(...a),
  patchMeetingRecord: (...a: unknown[]) => patchMeetingRecord(...a),
}));
vi.mock("@/service/contract-payment", () => ({
  loadContractPayments: (...a: unknown[]) => loadContractPayments(...a),
  resolveSheetWithSyncDb: vi.fn(async () => ({
    spreadsheetId: "S",
    syncDb: true,
    ctx: { spreadsheetId: "S", cohort: "연습", email: "e" },
  })),
}));
vi.mock("@/service/todos", () => ({
  listTodos: (...a: unknown[]) => listTodos(...a),
  patchTodo: (...a: unknown[]) => patchTodo(...a),
}));

import {
  linkMeetingToContract,
  listLinkableMeetings,
  previewMeetingLink,
} from "@/service/contract-meeting-link";

const BASE_CP = { row: 7, 계약일: "2026-09-01", 업체명: "예시상사", 수임비: 1_000_000, linkedMeetingId: "manual:abc" };
const cp = (over: Partial<ContractPayment> = {}) => ({ ...BASE_CP, ...over }) as ContractPayment;
const BASE_M = { id: "m1", 미팅날짜: "2026-09-05", 업체명: "(주)예시상사", 상태: "완료", 수임비: 1_500_000, channel: "매입DB" };
const meeting = (over: Partial<Meeting> = {}) => ({ ...BASE_M, ...over }) as unknown as Meeting;

beforeEach(() => {
  vi.clearAllMocks();
  loadContractPayments.mockResolvedValue([cp()]);
  // DB 기수 = DB 만 읽는다(시트 읽기 0) — 기본은 DB 가 비어 시트 합본 경로도 함께 검증.
  readContractsFromDb.mockImplementation(async () => loadContractPayments());
  getMeetingRecord.mockResolvedValue(meeting());
  listTodos.mockImplementation(async (_e: string, ref: string) =>
    ref === "2026-09-01|예시상사" ? ([{ id: "t1", contractRef: ref }] as Todo[]) : [],
  );
});

describe("linkMeetingToContract", () => {
  it("같은 02 행을 미팅에 붙이고 계약일=미팅 날짜, 할일·업체정보를 새 키로 옮긴다", async () => {
    const r = await linkMeetingToContract("e", {
      row: 7, meetingId: "m1", 업체명: "(주)예시상사", 수임비: 1_500_000, 업체정보: { 업태: "제조" },
    });
    expect(r.failures).toEqual([]);
    expect(relinkContractRow).toHaveBeenCalledWith(
      "S", 7,
      expect.objectContaining({ 계약일: "2026-09-05", 업체명: "(주)예시상사", 수임비: 1_500_000, meetingId: "m1" }),
      { syncDb: true },
    );
    expect(patchMeetingRecord).toHaveBeenCalledWith(
      expect.anything(), "m1",
      expect.objectContaining({ 상태: "계약", 계약여부: true, 수임비: 1_500_000 }),
    );
    expect(renameCompanyInfoKey).toHaveBeenCalledWith(
      "S", { 계약일: "2026-09-01", 업체명: "예시상사" }, { 계약일: "2026-09-05", 업체명: "(주)예시상사" }, { syncDb: true },
    );
    expect(upsertCompanyInfoArchive).toHaveBeenCalledWith(
      "S", expect.objectContaining({ 계약일: "2026-09-05", 업체정보: expect.objectContaining({ 업태: "제조" }) }), { syncDb: true },
    );
    expect(patchTodo).toHaveBeenCalledWith("e", "t1", { contractRef: "2026-09-05|(주)예시상사", 업체명: "(주)예시상사" });
  });

  it("이미 연결된 행(수동 아님)은 거절 — 아무것도 쓰지 않는다", async () => {
    loadContractPayments.mockResolvedValue([cp({ linkedMeetingId: "m9" })]);
    await expect(
      linkMeetingToContract("e", { row: 7, meetingId: "m1", 업체명: "x", 수임비: 0, 업체정보: {} }),
    ).rejects.toThrow("이미 영업기록");
    expect(relinkContractRow).not.toHaveBeenCalled();
  });

  it("다른 업체에 이미 붙은 미팅은 거절", async () => {
    loadContractPayments.mockResolvedValue([cp(), cp({ row: 9, linkedMeetingId: "m1" })]);
    await expect(
      linkMeetingToContract("e", { row: 7, meetingId: "m1", 업체명: "x", 수임비: 0, 업체정보: {} }),
    ).rejects.toThrow("이미 다른 업체");
    expect(relinkContractRow).not.toHaveBeenCalled();
  });

  it("업체정보·할일 옮기기가 실패해도 연결은 되고 실패를 알린다", async () => {
    upsertCompanyInfoArchive.mockRejectedValueOnce(new Error("db"));
    listTodos.mockRejectedValueOnce(new Error("db"));
    const r = await linkMeetingToContract("e", { row: 7, meetingId: "m1", 업체명: "예시상사", 수임비: 1, 업체정보: {} });
    expect(relinkContractRow).toHaveBeenCalled();
    expect(r.failures).toEqual(["업체정보", "할일·History"]);
  });
});

describe("시트 읽기 최소화", () => {
  it("DB 에 행이 있으면 시트 합본(loadContractPayments)을 부르지 않는다", async () => {
    readContractsFromDb.mockResolvedValue([cp()]);
    await previewMeetingLink("e", 7, "m1");
    await linkMeetingToContract("e", { row: 7, meetingId: "m1", 업체명: "예시상사", 수임비: 1, 업체정보: {} });
    expect(loadContractPayments).not.toHaveBeenCalled();
  });
});

describe("previewMeetingLink · listLinkableMeetings", () => {
  it("비교 자료에 두 쪽 값과 마지막 저장 시각을 싣는다", async () => {
    const p = await previewMeetingLink("e", 7, "m1");
    expect(p.contract.업체명).toBe("예시상사");
    expect(p.meeting.미팅날짜).toBe("2026-09-05");
    expect(p.updatedAt).toEqual({
      contract: "2026-09-10T00:00:00.000Z", contractInfo: null, meeting: "2026-09-20T00:00:00.000Z",
    });
  });

  it("취소·이미 연결된 미팅은 빼고 최근 순", async () => {
    loadContractPayments.mockResolvedValue([cp(), cp({ row: 9, linkedMeetingId: "m2" })]);
    listAllMeetingsRecord.mockResolvedValue([
      meeting({ id: "m1", 미팅날짜: "2026-08-01" }),
      meeting({ id: "m2" }),
      meeting({ id: "m3", 상태: "취소" }),
      meeting({ id: "m4", 미팅날짜: "2026-09-09" }),
    ]);
    expect((await listLinkableMeetings("e")).map((m) => m.id)).toEqual(["m4", "m1"]);
  });
});
