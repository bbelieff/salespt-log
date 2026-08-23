/**
 * R3-4 서비스 게이트 배선 — 03 DB관리 편집 유스케이스가 repo 로 syncDb 를 정확히 관통하는지.
 *  · 파일럿(8·9·연습·아레나)+DB켜짐 → update·clear({syncDb:true}) = DB 동기 정본
 *  · 비파일럿(7 등) 또는 DATABASE_URL 미설정 → {syncDb:false} = R2 미러(완전 불변·롤백 스위치)
 *  · append(add*) 는 syncDb 미전달 = 항상 R2 async(행번호=시트 할당, 중복행 회피, C2)
 *  · 편집 후 생산(E) cascade(syncProduction→persistProductionCell)는 계속 발화(finding-3 회귀)
 *    R3⑤: seam 이 writeProductionCell → persistProductionCell(게이트 내장, DB 정본) 로 이동
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
const persistProductionCell = vi.fn();
const sumChannelInflowOverPeriod = vi.fn(async () => 0);

vi.mock("@/repo/users", () => ({
  findUserByEmail: (...a: unknown[]) => findUserByEmail(...(a as [])),
}));
vi.mock("@/repo/db/client", () => ({
  dbEnabled: (...a: unknown[]) => dbEnabled(...(a as [])),
}));
const readDbTabFromDb = vi.fn();
vi.mock("@/repo/db/read-db-tab", () => ({
  readDbTabFromDb: (...a: unknown[]) => readDbTabFromDb(...(a as [])),
}));
vi.mock("@/repo/sales", () => ({
  sumChannelInflowOverPeriod: (...a: unknown[]) => sumChannelInflowOverPeriod(...(a as [])),
}));
// R3⑤: 생산(E) 기입 seam = service/sales-write persistProductionCell(게이트 내장 — 파일럿=DB 정본).
vi.mock("@/service/sales-write", () => ({
  persistProductionCell: (...a: unknown[]) => persistProductionCell(...(a as [])),
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
  addLead,
  addPurchase,
  patchBanner,
  patchLead,
  patchProduction,
  patchPurchase,
  removeLead,
  removePurchase,
} from "@/service/db";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const mkLead = (o: Partial<DBLead> = {}): DBLead =>
  ({ 구분: "콜", 접수일: "2026-07-10", 대표자명: "김", 업체명: "a", 소개처: "", 연락처: "010", 조건: "", ...o }) as DBLead;

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
    persistProductionCell, sumChannelInflowOverPeriod, readDbTabFromDb,
  ]) m.mockReset();
  dbEnabled.mockReturnValue(true);
  setCohort("8"); // 파일럿 기본
  // 발굴id 를 실어오는 유일한 read = readDbTabFromDb(DB payload overlay). 시트 readLeads 엔 발굴id 없음.
  readDbTabFromDb.mockResolvedValue({ purchases: [], productions: [], banners: [], leads: [] });
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
    setCohort("1");
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
    setCohort("1");
    await removeLead(EMAIL, 9);
    expect(clearLead).toHaveBeenCalledWith(SHEET, 9, { syncDb: false });
  });
});

describe("발굴 안정 id (lead-chain §4-3) — 부여·보존·지연부여", () => {
  it("addLead → appendLead payload 에 새 발굴id(uuid) 명시(R10)", async () => {
    await addLead(EMAIL, mkLead());
    const arg = (appendLead.mock.calls[0] as unknown as [string, DBLead])[1];
    expect(arg.발굴id).toMatch(UUID_RE);
  });

  it("addLead 는 클라이언트발 발굴id 를 무시하고 새로 생성(라우트 strip 이중 방어)", async () => {
    await addLead(EMAIL, mkLead({ 발굴id: "attacker-supplied" }));
    const arg = (appendLead.mock.calls[0] as unknown as [string, DBLead])[1];
    expect(arg.발굴id).not.toBe("attacker-supplied");
    expect(arg.발굴id).toMatch(UUID_RE);
  });

  it("patchLead 파일럿 → 기존 발굴id 를 **DB payload(readDbTabFromDb)** 에서 읽어 보존(R13)", async () => {
    // ⚠️ 발굴id 는 DB payload 전용 — 시트 readLeads 로는 절대 안 온다. DB 리더로만 온다.
    readDbTabFromDb.mockResolvedValue({ purchases: [], productions: [], banners: [], leads: [{ ...mkLead(), 발굴id: "existing-uuid", row: 9 }] });
    readLeads.mockResolvedValue({ rows: [{ ...mkLead(), 접수일: "2026-07-10", row: 9 }] }); // 시트엔 발굴id 없음(옛 접수일만)
    await patchLead(EMAIL, 9, mkLead({ 접수일: "2026-07-11" }));
    expect(updateLead).toHaveBeenCalledWith(SHEET, 9, expect.objectContaining({ 발굴id: "existing-uuid" }), { syncDb: true });
  });

  it("🐛회귀: 시트 readLeads 가 발굴id 를 못 실어와도(정상) remint 하지 않는다 — DB 리더가 정본", async () => {
    // 이 테스트가 붉으면 oldLeadId 가 시트 리더를 타는 옛 버그(매 편집 remint)로 회귀한 것.
    readDbTabFromDb.mockResolvedValue({ purchases: [], productions: [], banners: [], leads: [{ ...mkLead(), 발굴id: "stable-uuid", row: 9 }] });
    readLeads.mockResolvedValue({ rows: [{ ...mkLead(), row: 9 }] }); // 시트: 발굴id 필드 자체가 없음(실제 파서 형태)
    await patchLead(EMAIL, 9, mkLead());
    const arg = (updateLead.mock.calls[0] as unknown as [string, number, DBLead])[2];
    expect(arg.발굴id).toBe("stable-uuid"); // remint 아님
  });

  it("patchLead 비파일럿 → DB 안 읽고 지연 부여(mint)", async () => {
    setCohort("1"); // 비파일럿 = syncDb false
    await patchLead(EMAIL, 9, mkLead());
    expect(readDbTabFromDb).not.toHaveBeenCalled(); // 비파일럿은 DB read 안 함
    const arg = (updateLead.mock.calls[0] as unknown as [string, number, DBLead])[2];
    expect(arg.발굴id).toMatch(UUID_RE);
  });

  it("🐛회귀: 파일럿 DB read 실패(순단) → remint 하지 않고 발굴id 를 payload 에서 omit(기존 값 보존)", async () => {
    // read 무재시도·write 재시도 비대칭 → "읽기 실패·쓰기 성공" 창에서 덮으면 안정 id 파괴.
    // "없음(mint)"과 "실패(keep)"를 구분: 실패면 발굴id 키를 안 실어 jsonb 병합이 기존 값 보존.
    readDbTabFromDb.mockRejectedValue(new Error("db down"));
    await patchLead(EMAIL, 9, mkLead()); // 라우트가 omit 하므로 l 에 발굴id 없음
    const arg = (updateLead.mock.calls[0] as unknown as [string, number, DBLead])[2];
    expect("발굴id" in arg).toBe(false); // 덮지 않음 → 병합이 기존 uuid 보존
  });

  it("patchLead 파일럿·DB에 id 없음(백필/legacy) → 지연 부여(mint)", async () => {
    readDbTabFromDb.mockResolvedValue({ purchases: [], productions: [], banners: [], leads: [{ ...mkLead(), row: 9 }] }); // 발굴id 없음
    await patchLead(EMAIL, 9, mkLead());
    const arg = (updateLead.mock.calls[0] as unknown as [string, number, DBLead])[2];
    expect(arg.발굴id).toMatch(UUID_RE);
  });

  it("patchLead 는 클라이언트발 발굴id 로 기존 링크를 덮지 않는다(탈취 방지)", async () => {
    readDbTabFromDb.mockResolvedValue({ purchases: [], productions: [], banners: [], leads: [{ ...mkLead(), 발굴id: "existing-uuid", row: 9 }] });
    await patchLead(EMAIL, 9, mkLead({ 발굴id: "attacker-supplied" }));
    expect(updateLead).toHaveBeenCalledWith(SHEET, 9, expect.objectContaining({ 발굴id: "existing-uuid" }), expect.anything());
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
  it("patchPurchase(파일럿) 후에도 생산(E) 재집계가 호출된다", async () => {
    readPurchases.mockResolvedValue({
      rows: [{ 구매일: "2026-07-10", 업체명: "가나", 개당단가: 1000, 주문개수: 3, 부가세여부: false, 기타: "", 주문금액: 3000, row: 9 }],
    });
    await patchPurchase(EMAIL, 9, mkPur({ 구매일: "2026-07-10" }));
    // dual-sync update 는 시트 동기 유지 → readPurchases(시트) 가 최신 → E 재집계 발화
    expect(persistProductionCell).toHaveBeenCalledWith(
      expect.objectContaining({ spreadsheetId: SHEET }), "2026-07-10", "매입DB", 3,
    );
  });

  it("DB dual-sync throw 여도 옛 날짜 E 재집계 실행 — cascade 유실 회귀(리뷰 CONFIRMED)", async () => {
    // 옛 구매일 = 2026-07-01 (oldDateOf 가 시트에서 읽음)
    readPurchases.mockResolvedValue({
      rows: [{ 구매일: "2026-07-01", 업체명: "가나", 개당단가: 1000, 주문개수: 3, 부가세여부: false, 기타: "", 주문금액: 3000, row: 9 }],
    });
    updatePurchase.mockRejectedValue(new Error("DB down (dual-sync)")); // 시트는 변경됐다고 가정, DB throw
    await expect(patchPurchase(EMAIL, 9, mkPur({ 구매일: "2026-07-10" }))).rejects.toThrow();
    // finally 가 옛 날짜 E 를 재집계 — skip 되면(원버그) 재시도가 옛 날짜를 잃어 영구 오집계.
    expect(persistProductionCell).toHaveBeenCalledWith(
      expect.objectContaining({ spreadsheetId: SHEET }), "2026-07-01", "매입DB", expect.any(Number),
    );
  });

  it("removeLead DB throw 여도 옛 날짜 E 재집계 실행(finally 보장)", async () => {
    readLeads.mockResolvedValue({
      rows: [{ 구분: "콜", 접수일: "2026-07-02", 대표자명: "김", 업체명: "a", 소개처: "", 연락처: "010", 조건: "", row: 9 }],
    });
    clearLead.mockRejectedValue(new Error("DB down"));
    await expect(removeLead(EMAIL, 9)).rejects.toThrow();
    expect(persistProductionCell).toHaveBeenCalledWith(
      expect.objectContaining({ spreadsheetId: SHEET }), "2026-07-02", "콜·지·기·소", expect.any(Number),
    );
  });
});
