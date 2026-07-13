/**
 * R3-4 서비스 게이트 배선 — 03 DB관리 편집 유스케이스가 repo 로 syncDb 를 정확히 관통하는지.
 *  · 파일럿(8·9·연습·아레나)+DB켜짐 → update·clear({syncDb:true}) = DB 동기 정본
 *  · 비파일럿(7 등) 또는 DATABASE_URL 미설정 → {syncDb:false} = R2 미러(완전 불변·롤백 스위치)
 *  · append(add*) 는 syncDb 미전달 = 항상 R2 async(행번호=시트 할당, 중복행 회피, C2)
 *  · 편집 후 생산(E) cascade(syncProduction→writeProductionCell)는 계속 발화(finding-3 회귀)
 * daily-source 게이트는 실제 사용(dbEnabled·cohort 만 제어). repo 경계는 스텁.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DBBanner, DBLead, DBProduction, DBPurchase } from "@/types";

const findUserByEmail = vi.fn();
const dbEnabled = vi.fn(() => true);

// repo 경계 스텁
const updatePurchase = vi.fn();
const clearPurchase = vi.fn();
const updateProduction = vi.fn();
const clearProduction = vi.fn();
const updateBanner = vi.fn();
const clearBanner = vi.fn();
const updateLead = vi.fn();
const clearLead = vi.fn();
const appendPurchase = vi.fn(async () => ({ row: 5 }));
const appendProduction = vi.fn(async () => ({ row: 5 }));
const appendBanner = vi.fn(async () => ({ row: 5 }));
const appendLead = vi.fn(async () => ({ row: 5 }));
const readPurchases = vi.fn(async () => ({ rows: [] as Array<DBPurchase & { row: number }> }));
const readProductions = vi.fn(async () => ({ rows: [] as Array<DBProduction & { row: number }> }));
const readBanners = vi.fn(async () => ({ rows: [] as Array<DBBanner & { row: number }> }));
const readLeads = vi.fn(async () => ({ rows: [] as Array<DBLead & { row: number }> }));
const writeProductionCountCell = vi.fn();
const writeProductionCell = vi.fn();
const sumChannelInflowOverPeriod = vi.fn(async () => 0);

vi.mock("@/repo/users", () => ({
  findUserByEmail: (...a: unknown[]) => findUserByEmail(...(a as [])),
}));
vi.mock("@/repo/db/client", () => ({
  dbEnabled: (...a: unknown[]) => dbEnabled(...(a as [])),
}));
vi.mock("@/repo/db/read-db-tab", () => ({ readDbTabFromDb: vi.fn() }));
vi.mock("@/repo/sales", () => ({
  writeProductionCell: (...a: unknown[]) => writeProductionCell(...(a as [])),
  sumChannelInflowOverPeriod: (...a: unknown[]) => sumChannelInflowOverPeriod(...(a as [])),
}));
vi.mock("@/repo/db", () => ({
  updatePurchase: (...a: unknown[]) => updatePurchase(...(a as [])),
  clearPurchase: (...a: unknown[]) => clearPurchase(...(a as [])),
  updateProduction: (...a: unknown[]) => updateProduction(...(a as [])),
  clearProduction: (...a: unknown[]) => clearProduction(...(a as [])),
  updateBanner: (...a: unknown[]) => updateBanner(...(a as [])),
  clearBanner: (...a: unknown[]) => clearBanner(...(a as [])),
  updateLead: (...a: unknown[]) => updateLead(...(a as [])),
  clearLead: (...a: unknown[]) => clearLead(...(a as [])),
  appendPurchase: (...a: unknown[]) => appendPurchase(...(a as [])),
  appendProduction: (...a: unknown[]) => appendProduction(...(a as [])),
  appendBanner: (...a: unknown[]) => appendBanner(...(a as [])),
  appendLead: (...a: unknown[]) => appendLead(...(a as [])),
  readPurchases: (...a: unknown[]) => readPurchases(...(a as [])),
  readProductions: (...a: unknown[]) => readProductions(...(a as [])),
  readBanners: (...a: unknown[]) => readBanners(...(a as [])),
  readLeads: (...a: unknown[]) => readLeads(...(a as [])),
  writeProductionCountCell: (...a: unknown[]) => writeProductionCountCell(...(a as [])),
}));

import {
  addPurchase,
  patchBanner,
  patchLead,
  patchProduction,
  patchPurchase,
  removeLead,
  removePurchase,
} from "@/service/db";

const EMAIL = "u@x.y";
const SHEET = "sheet-1";
const mkPur = (o: Partial<DBPurchase> = {}): DBPurchase =>
  ({ 구매일: "2026-07-10", 업체명: "가나", 개당단가: 1000, 주문개수: 3, 부가세여부: false, 기타: "", 주문금액: 3000, ...o }) as DBPurchase;

function setCohort(cohort: string) {
  findUserByEmail.mockResolvedValue({ spreadsheetId: SHEET, cohort, email: EMAIL });
}

beforeEach(() => {
  for (const m of [
    findUserByEmail, dbEnabled, updatePurchase, clearPurchase, updateProduction, clearProduction,
    updateBanner, clearBanner, updateLead, clearLead, appendPurchase, appendProduction, appendBanner,
    appendLead, readPurchases, readProductions, readBanners, readLeads, writeProductionCountCell,
    writeProductionCell, sumChannelInflowOverPeriod,
  ]) m.mockReset();
  dbEnabled.mockReturnValue(true);
  setCohort("8"); // 파일럿 기본
  appendPurchase.mockResolvedValue({ row: 5 });
  appendProduction.mockResolvedValue({ row: 5 });
  appendBanner.mockResolvedValue({ row: 5 });
  appendLead.mockResolvedValue({ row: 5 });
  readPurchases.mockResolvedValue({ rows: [] });
  readProductions.mockResolvedValue({ rows: [] });
  readBanners.mockResolvedValue({ rows: [] });
  readLeads.mockResolvedValue({ rows: [] });
  sumChannelInflowOverPeriod.mockResolvedValue(0);
});

describe("편집 게이트 — 파일럿→syncDb:true / 비파일럿·DB꺼짐→false(롤백)", () => {
  it("patchPurchase 파일럿 → updatePurchase(…, {syncDb:true})", async () => {
    await patchPurchase(EMAIL, 9, mkPur());
    expect(updatePurchase).toHaveBeenCalledWith(SHEET, expect.any(Number), expect.anything(), { syncDb: true });
  });
  it("patchPurchase 비파일럿(7기) → {syncDb:false}(R2 미러 불변)", async () => {
    setCohort("7");
    await patchPurchase(EMAIL, 9, mkPur());
    expect(updatePurchase).toHaveBeenCalledWith(SHEET, expect.any(Number), expect.anything(), { syncDb: false });
  });
  it("patchPurchase DATABASE_URL 미설정 → 파일럿도 {syncDb:false}(즉시 R2 복귀)", async () => {
    dbEnabled.mockReturnValue(false);
    await patchPurchase(EMAIL, 9, mkPur());
    expect(updatePurchase).toHaveBeenCalledWith(SHEET, expect.any(Number), expect.anything(), { syncDb: false });
  });
  it("removePurchase 파일럿 → clearPurchase(…, {syncDb:true})", async () => {
    await removePurchase(EMAIL, 9);
    expect(clearPurchase).toHaveBeenCalledWith(SHEET, 9, { syncDb: true });
  });
  it("patchProduction 파일럿 → updateProduction(…, {syncDb:true})", async () => {
    await patchProduction(EMAIL, 9, { 시작일: "2026-07-01", 종료일: "2026-07-05", 소재: "x", 기간예산: 0, 생산개수: 0, 부가세여부: false, 기타: "", 개당단가: 0 } as DBProduction);
    expect(updateProduction).toHaveBeenCalledWith(SHEET, 9, expect.anything(), { syncDb: true });
  });
  it("patchBanner 파일럿 → updateBanner(…, {syncDb:true})", async () => {
    await patchBanner(EMAIL, 9, { 날짜: "2026-07-10", 업체명: "a", 도착일: "", 개당단가: 0, 주문개수: 0, 부가세여부: false, 기타: "", 주문금액: 0 } as DBBanner);
    expect(updateBanner).toHaveBeenCalledWith(SHEET, 9, expect.anything(), { syncDb: true });
  });
  it("patchLead 파일럿 → updateLead(…, {syncDb:true})", async () => {
    await patchLead(EMAIL, 9, { 구분: "콜", 접수일: "2026-07-10", 대표자명: "김", 업체명: "a", 소개처: "", 연락처: "010", 조건: "" } as DBLead);
    expect(updateLead).toHaveBeenCalledWith(SHEET, 9, expect.anything(), { syncDb: true });
  });
  it("removeLead 비파일럿 → clearLead(…, {syncDb:false})", async () => {
    setCohort("7");
    await removeLead(EMAIL, 9);
    expect(clearLead).toHaveBeenCalledWith(SHEET, 9, { syncDb: false });
  });
});

describe("append 제외 — add* 는 syncDb 미전달(항상 R2 async, 중복행 회피)", () => {
  it("addPurchase 파일럿이라도 appendPurchase 는 (sid,p) 2인자 — syncDb opts 없음", async () => {
    await addPurchase(EMAIL, mkPur());
    expect(appendPurchase).toHaveBeenCalledTimes(1);
    const call = appendPurchase.mock.calls[0] as unknown[];
    expect(call.length).toBe(2); // (spreadsheetId, model) — opts 없음
    expect(updatePurchase).not.toHaveBeenCalled();
  });
});

describe("생산(E) cascade 회귀(finding-3) — 편집 후 syncProduction 계속 발화", () => {
  it("patchPurchase(파일럿) 후에도 writeProductionCell(E) 이 호출된다(시트 동기 유지 전제)", async () => {
    readPurchases.mockResolvedValue({
      rows: [{ 구매일: "2026-07-10", 업체명: "가나", 개당단가: 1000, 주문개수: 3, 부가세여부: false, 기타: "", 주문금액: 3000, row: 9 }],
    });
    await patchPurchase(EMAIL, 9, mkPur({ 구매일: "2026-07-10" }));
    // dual-sync update 는 시트 동기 유지 → readPurchases(시트) 가 최신 → E 재집계 발화
    expect(writeProductionCell).toHaveBeenCalledWith(SHEET, "2026-07-10", "매입DB", 3);
  });

  it("DB dual-sync throw 여도 옛 날짜 E 재집계 실행 — cascade 유실 회귀(리뷰 CONFIRMED)", async () => {
    // 옛 구매일 = 2026-07-01 (oldDateOf 가 시트에서 읽음)
    readPurchases.mockResolvedValue({
      rows: [{ 구매일: "2026-07-01", 업체명: "가나", 개당단가: 1000, 주문개수: 3, 부가세여부: false, 기타: "", 주문금액: 3000, row: 9 }],
    });
    updatePurchase.mockRejectedValue(new Error("DB down (dual-sync)")); // 시트는 변경됐다고 가정, DB throw
    await expect(patchPurchase(EMAIL, 9, mkPur({ 구매일: "2026-07-10" }))).rejects.toThrow();
    // finally 가 옛 날짜 E 를 재집계 — skip 되면(원버그) 재시도가 옛 날짜를 잃어 영구 오집계.
    expect(writeProductionCell).toHaveBeenCalledWith(SHEET, "2026-07-01", "매입DB", expect.any(Number));
  });

  it("removeLead DB throw 여도 옛 날짜 E 재집계 실행(finally 보장)", async () => {
    readLeads.mockResolvedValue({
      rows: [{ 구분: "콜", 접수일: "2026-07-02", 대표자명: "김", 업체명: "a", 소개처: "", 연락처: "010", 조건: "", row: 9 }],
    });
    clearLead.mockRejectedValue(new Error("DB down"));
    await expect(removeLead(EMAIL, 9)).rejects.toThrow();
    expect(writeProductionCell).toHaveBeenCalledWith(SHEET, "2026-07-02", "콜·지·기·소", expect.any(Number));
  });
});
