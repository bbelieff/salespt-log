/** 일정 변경 미팅에서 계약 — 장부·업체정보는 「(변경)」 없는 실제 업체명, 미팅 이름도 정리(2026-11-22 belie). */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  meetings: [] as { id: string; 업체명: string; 구분?: string }[],
  append: vi.fn(async () => ({ row: 7 })),
  archive: vi.fn(async () => ({ row: 2, created: true })),
  patch: vi.fn(async () => {}),
}));

vi.mock("@/service/contract-payment", () => ({
  resolveCtx: vi.fn(),
  resolveSheetWithSyncDb: async () => ({ spreadsheetId: "s1", syncDb: true, ctx: { spreadsheetId: "s1" } }),
}));
vi.mock("@/service/meetings-write", () => ({
  findMeetingsByDateRecord: async () => h.meetings,
  patchMeetingRecord: (...a: unknown[]) => h.patch(...(a as [])),
}));
vi.mock("@/repo/contract-payment", () => ({ appendFromContract: (...a: unknown[]) => h.append(...(a as [])), readAll: vi.fn(), updateUserFields: vi.fn() }));
vi.mock("@/repo/company-info-archive", () => ({ upsertCompanyInfoArchive: (...a: unknown[]) => h.archive(...(a as [])) }));

import { addFromContract } from "@/service/contract-payment-add";

beforeEach(() => {
  h.meetings = [];
  h.append.mockClear();
  h.archive.mockClear();
  h.patch.mockClear();
});

describe("addFromContract — (변경) 표시", () => {
  it("장부·업체정보는 실제 업체명, 연결 미팅 id 는 유지, 미팅 이름도 정리", async () => {
    h.meetings = [{ id: "m2", 업체명: "(변경) 가온식품" }];
    await addFromContract("a@test.invalid", { 계약일: "2026-11-24", 업체명: "(변경) 가온식품", 수임비: 1000 });
    expect(h.append).toHaveBeenCalledWith("s1", expect.objectContaining({ 업체명: "가온식품", meetingId: "m2" }), undefined, undefined, true);
    expect(h.archive).toHaveBeenCalledWith("s1", expect.objectContaining({ 업체명: "가온식품" }), { syncDb: true });
    expect(h.patch).toHaveBeenCalledWith({ spreadsheetId: "s1" }, "m2", { 업체명: "가온식품" });
  });
  it("화면이 이미 뗀 이름을 보내도 (변경) 미팅을 찾아 연결한다", async () => {
    h.meetings = [{ id: "m2", 업체명: "(변경) 가온식품" }];
    await addFromContract("a@test.invalid", { 계약일: "2026-11-24", 업체명: "가온식품", 수임비: 1000 });
    expect(h.append).toHaveBeenCalledWith("s1", expect.objectContaining({ 업체명: "가온식품", meetingId: "m2" }), undefined, undefined, true);
  });
  it("표시 없는 보통 계약은 미팅 이름을 건드리지 않는다", async () => {
    h.meetings = [{ id: "m1", 업체명: "다온물류" }];
    await addFromContract("a@test.invalid", { 계약일: "2026-11-24", 업체명: "다온물류", 수임비: 1000 });
    expect(h.patch).not.toHaveBeenCalled();
    expect(h.append).toHaveBeenCalledWith("s1", expect.objectContaining({ 업체명: "다온물류", meetingId: "m1" }), undefined, undefined, true);
  });
  it("미팅 이름 정리가 실패해도 계약은 들어간다", async () => {
    h.meetings = [{ id: "m2", 업체명: "(변경) 가온식품" }];
    h.patch.mockRejectedValueOnce(new Error("down"));
    await expect(addFromContract("a@test.invalid", { 계약일: "2026-11-24", 업체명: "(변경) 가온식품", 수임비: 1 })).resolves.toEqual({ row: 7 });
  });
});
