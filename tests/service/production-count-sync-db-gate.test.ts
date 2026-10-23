/**
 * BBE-61(R3-4b) — syncDirectCount/syncDirectProductionForDate/addProduction/patchProduction 가
 * writeProductionCountCell 에 syncDb 를 정확히 관통하는지(파일럿→true, 비파일럿·DB꺼짐→false).
 * 실제 DB throw-safety(non-throw 보장)는 repo 레이어(db-mirror-awaitable·db-production-count-cell
 * 테스트)가 고정 — 여기는 게이트 배선만 검증.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DBProduction } from "@/types";

const findUserByEmail = vi.fn();
const dbEnabled = vi.fn(() => true);
const appendProduction = vi.fn(async () => ({ row: 5 }));
const updateProduction = vi.fn(async () => {});
const readProductions = vi.fn(async () => ({ rows: [] as Array<DBProduction & { row: number }> }));
const writeProductionCountCell = vi.fn(async () => {});
const sumChannelInflowOverPeriod = vi.fn(async () => 7);
const readDbTabFromDb = vi.fn(async () => ({ purchases: [] as unknown[], productions: [] as Array<DBProduction & { row: number }>, banners: [] as unknown[], leads: [] as unknown[] }));

vi.mock("@/repo/users", () => ({
  findUserByEmail: (...a: unknown[]) => findUserByEmail(...(a as [])),
}));
vi.mock("@/repo/db/client", () => ({
  dbEnabled: (...a: unknown[]) => dbEnabled(...(a as [])),
}));
vi.mock("@/repo/db/read-db-tab", () => ({
  readDbTabFromDb: (...a: unknown[]) => readDbTabFromDb(...(a as [])),
}));
vi.mock("@/repo/sales", () => ({
  sumChannelInflowOverPeriod: (...a: unknown[]) => sumChannelInflowOverPeriod(...(a as [])),
}));
vi.mock("@/service/sales-write", () => ({
  persistProductionCell: vi.fn(async () => {}),
}));
vi.mock("@/repo/db", () => ({
  appendProduction: (...a: unknown[]) => appendProduction(...(a as [])),
  updateProduction: (...a: unknown[]) => updateProduction(...(a as [])),
  readProductions: (...a: unknown[]) => readProductions(...(a as [])),
  writeProductionCountCell: (...a: unknown[]) => writeProductionCountCell(...(a as [])),
  // 아래는 이 파일이 안 쓰지만 @/repo/db 전체가 mock 되므로 import 시 undefined 호출 방지용 no-op.
  appendPurchase: vi.fn(async () => ({ row: 1 })),
  appendBanner: vi.fn(async () => ({ row: 1 })),
  appendLead: vi.fn(async () => ({ row: 1 })),
  updatePurchase: vi.fn(async () => {}),
  updateBanner: vi.fn(async () => {}),
  updateLead: vi.fn(async () => {}),
  clearPurchase: vi.fn(async () => {}),
  clearProduction: vi.fn(async () => {}),
  clearBanner: vi.fn(async () => {}),
  clearLead: vi.fn(async () => {}),
  readPurchases: vi.fn(async () => ({ rows: [] })),
  readBanners: vi.fn(async () => ({ rows: [] })),
  readLeads: vi.fn(async () => ({ rows: [] })),
}));

import { addProduction, patchProduction, syncDirectProductionForDate } from "@/service/db";

const EMAIL = "u@x.y";
const SHEET = "sheet-1";
const mkProd = (o: Partial<DBProduction> = {}): DBProduction =>
  ({ 시작일: "2026-07-01", 종료일: "2026-07-31", 소재: "블로그", 기간예산: 100000, 생산개수: 0, 개당단가: 0, 부가세여부: false, 기타: "", ...o }) as DBProduction;

function setCohort(cohort: string) {
  findUserByEmail.mockResolvedValue({ spreadsheetId: SHEET, cohort, email: EMAIL });
}

beforeEach(() => {
  for (const m of [findUserByEmail, dbEnabled, appendProduction, updateProduction, readProductions, writeProductionCountCell, sumChannelInflowOverPeriod, readDbTabFromDb]) m.mockReset();
  dbEnabled.mockReturnValue(true);
  appendProduction.mockResolvedValue({ row: 5 });
  updateProduction.mockResolvedValue(undefined);
  readProductions.mockResolvedValue({ rows: [] });
  writeProductionCountCell.mockResolvedValue(undefined);
  sumChannelInflowOverPeriod.mockResolvedValue(7);
  readDbTabFromDb.mockResolvedValue({ purchases: [], productions: [], banners: [], leads: [] });
});

describe("syncDirectProductionForDate — 컨택경로, syncDb 게이트(BBE-61)", () => {
  it("파일럿 기수(8) — writeProductionCountCell 4번째 인자 {syncDb:true}", async () => {
    readProductions.mockResolvedValue({ rows: [{ ...mkProd(), row: 5 }] });
    const r = await syncDirectProductionForDate(SHEET, "2026-07-10", "8");
    expect(r).toEqual({ recordFound: true, count: 7 });
    expect(writeProductionCountCell).toHaveBeenCalledWith(SHEET, 5, 7, { syncDb: true });
    expect(sumChannelInflowOverPeriod).toHaveBeenCalledWith(SHEET, "직접생산", "2026-07-01", "2026-07-31", { fromDb: true });
  });

  it("비파일럿 기수(7) — {syncDb:false}", async () => {
    readProductions.mockResolvedValue({ rows: [{ ...mkProd(), row: 5 }] });
    await syncDirectProductionForDate(SHEET, "2026-07-10", "1");
    expect(writeProductionCountCell).toHaveBeenCalledWith(SHEET, 5, 7, { syncDb: false });
  });

  it("DB 전면 꺼짐(dbEnabled=false) — 파일럿 기수라도 {syncDb:false}(롤백 스위치)", async () => {
    dbEnabled.mockReturnValue(false);
    readProductions.mockResolvedValue({ rows: [{ ...mkProd(), row: 5 }] });
    await syncDirectProductionForDate(SHEET, "2026-07-10", "8");
    expect(writeProductionCountCell).toHaveBeenCalledWith(SHEET, 5, 7, { syncDb: false });
  });

  it("활성 레코드 없음 — recordFound:false, writeProductionCountCell 미호출", async () => {
    readProductions.mockResolvedValue({ rows: [] });
    const r = await syncDirectProductionForDate(SHEET, "2026-07-10", "8");
    expect(r).toEqual({ recordFound: false, count: 0 });
    expect(writeProductionCountCell).not.toHaveBeenCalled();
  });
});

describe("syncDirectProductionForDate — 파일럿은 DB 에서 레코드 조회(컨택 저장 지연 수정)", () => {
  it("DB 에 활성 레코드 있음 — 시트 read 0회, M 셀은 큐 경유(sheetViaQueue)", async () => {
    readDbTabFromDb.mockResolvedValue({ purchases: [], productions: [{ ...mkProd(), row: 5 }], banners: [], leads: [] });
    const r = await syncDirectProductionForDate(SHEET, "2026-07-10", "8", { inflow: 3 });
    expect(r).toEqual({ recordFound: true, count: 7 });
    expect(readProductions).not.toHaveBeenCalled();
    expect(writeProductionCountCell).toHaveBeenCalledWith(SHEET, 5, 7, { syncDb: true, sheetViaQueue: true });
  });

  it("DB 에 없음 + 유입 0 — 시트 read 생략, 보류 아님", async () => {
    const r = await syncDirectProductionForDate(SHEET, "2026-07-10", "8", { inflow: 0 });
    expect(r).toEqual({ recordFound: false, count: 0 });
    expect(readProductions).not.toHaveBeenCalled();
    expect(writeProductionCountCell).not.toHaveBeenCalled();
  });

  it("DB 에 없음 + 유입>0 — 시트 안전망 read(append 미러 누락 대비), 시트 셀 동기 쓰기 유지", async () => {
    readProductions.mockResolvedValue({ rows: [{ ...mkProd(), row: 6 }] });
    const r = await syncDirectProductionForDate(SHEET, "2026-07-10", "8", { inflow: 2 });
    expect(r).toEqual({ recordFound: true, count: 7 });
    expect(readProductions).toHaveBeenCalledTimes(1);
    expect(writeProductionCountCell).toHaveBeenCalledWith(SHEET, 6, 7, { syncDb: true });
  });

  it("DB read 실패 — 유입 0 이어도 시트 경로로 폴백", async () => {
    readDbTabFromDb.mockRejectedValue(new Error("db down"));
    readProductions.mockResolvedValue({ rows: [{ ...mkProd(), row: 5 }] });
    const r = await syncDirectProductionForDate(SHEET, "2026-07-10", "8", { inflow: 0 });
    expect(r).toEqual({ recordFound: true, count: 7 });
    expect(writeProductionCountCell).toHaveBeenCalledWith(SHEET, 5, 7, { syncDb: true });
  });

  it("비파일럿 — DB 조회 없이 기존 시트 경로", async () => {
    readProductions.mockResolvedValue({ rows: [{ ...mkProd(), row: 5 }] });
    await syncDirectProductionForDate(SHEET, "2026-07-10", "1", { inflow: 0 });
    expect(readDbTabFromDb).not.toHaveBeenCalled();
    expect(writeProductionCountCell).toHaveBeenCalledWith(SHEET, 5, 7, { syncDb: false });
  });
});

describe("addProduction/patchProduction — syncDb 관통", () => {
  it("addProduction(파일럿) — {syncDb:true}", async () => {
    setCohort("8");
    await addProduction(EMAIL, mkProd());
    expect(writeProductionCountCell).toHaveBeenCalledWith(SHEET, 5, 7, { syncDb: true });
  });

  it("patchProduction(비파일럿) — {syncDb:false}", async () => {
    setCohort("1");
    await patchProduction(EMAIL, 9, mkProd());
    expect(writeProductionCountCell).toHaveBeenCalledWith(SHEET, 9, 7, { syncDb: false });
  });
});
