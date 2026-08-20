/**
 * BBE-259 — loadDBOverview 저비용 존재확인(4섹션, BBE-248/#824 이식) 회귀.
 *
 * 이전(R3 §7-3 L4): DB read + 4섹션 시트 전체 read 를 항상 병렬 발사해 union 백필.
 * 이후(BBE-259): DB read + 4섹션 각각의 **저비용 존재확인**을 병렬 발사 — 4섹션 전부 빈틈
 * 없으면 전체 시트 fetch(readAllSheetSections 상당)를 생략. 하나라도 빈틈 있거나 존재확인
 * 자체가 실패하면 기존과 동일하게 4섹션 전체 union 폴백(정합성 100% 유지).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const findUserByEmail = vi.fn();
const dbEnabled = vi.fn(() => true);
const readDbTabFromDb = vi.fn();
const readPurchases = vi.fn();
const readProductions = vi.fn();
const readBanners = vi.fn();
const readLeads = vi.fn();
const readPurchaseFilledRows = vi.fn();
const readProductionFilledRows = vi.fn();
const readBannerFilledRows = vi.fn();
const readLeadFilledRows = vi.fn();
const captureException = vi.fn();

vi.mock("@/repo/users", () => ({
  findUserByEmail: (...a: unknown[]) => findUserByEmail(...(a as [])),
}));
vi.mock("@/repo/db/client", () => ({
  dbEnabled: (...a: unknown[]) => dbEnabled(...(a as [])),
}));
vi.mock("@/repo/db/read-db-tab", () => ({
  readDbTabFromDb: (...a: unknown[]) => readDbTabFromDb(...(a as [])),
}));
vi.mock("@/repo/db/read-daily", () => ({ readMeetingsFromDb: vi.fn() }));
vi.mock("@/repo/meetings", () => ({ readAllMeetings: vi.fn() }));
vi.mock("@/repo/sales", () => ({ sumChannelInflowOverPeriod: vi.fn(async () => 0) }));
vi.mock("@/service/sales-write", () => ({ persistProductionCell: vi.fn() }));
vi.mock("@/service/lead-list", () => ({ selectLeadsForPicker: vi.fn(() => []) }));
vi.mock("@/service/db-old-values", () => ({
  oldDateOf: vi.fn(), oldLeadIdOf: vi.fn(), readChannelRows: vi.fn(async () => []),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: (...a: unknown[]) => captureException(...(a as [])) }));
vi.mock("@/repo/db", () => ({
  appendPurchase: vi.fn(), appendProduction: vi.fn(), appendBanner: vi.fn(), appendLead: vi.fn(),
  clearPurchase: vi.fn(), clearProduction: vi.fn(), clearBanner: vi.fn(), clearLead: vi.fn(),
  updatePurchase: vi.fn(), updateProduction: vi.fn(), updateBanner: vi.fn(), updateLead: vi.fn(),
  writeProductionCountCell: vi.fn(),
  readPurchases: (...a: unknown[]) => readPurchases(...(a as [])),
  readProductions: (...a: unknown[]) => readProductions(...(a as [])),
  readBanners: (...a: unknown[]) => readBanners(...(a as [])),
  readLeads: (...a: unknown[]) => readLeads(...(a as [])),
  readPurchaseFilledRows: (...a: unknown[]) => readPurchaseFilledRows(...(a as [])),
  readProductionFilledRows: (...a: unknown[]) => readProductionFilledRows(...(a as [])),
  readBannerFilledRows: (...a: unknown[]) => readBannerFilledRows(...(a as [])),
  readLeadFilledRows: (...a: unknown[]) => readLeadFilledRows(...(a as [])),
}));

import { loadDBOverview } from "@/service/db";

const SHEET = "sheet-1";
const row = (row: number, extra: Record<string, unknown> = {}) => ({ row, ...extra });

beforeEach(() => {
  findUserByEmail.mockReset().mockResolvedValue({ spreadsheetId: SHEET, cohort: "8" });
  dbEnabled.mockReset().mockReturnValue(true);
  readDbTabFromDb.mockReset();
  readPurchases.mockReset().mockResolvedValue({ rows: [] });
  readProductions.mockReset().mockResolvedValue({ rows: [] });
  readBanners.mockReset().mockResolvedValue({ rows: [] });
  readLeads.mockReset().mockResolvedValue({ rows: [] });
  readPurchaseFilledRows.mockReset();
  readProductionFilledRows.mockReset();
  readBannerFilledRows.mockReset();
  readLeadFilledRows.mockReset();
  captureException.mockReset();
});

describe("loadDBOverview — 파일럿, 4섹션 전부 빈틈 없음(흔한 경로)", () => {
  it("존재확인이 DB row 집합과 완전히 일치 — 전체 시트 read(readXsections) 생략, DB 결과만 반환", async () => {
    readDbTabFromDb.mockResolvedValue({
      purchases: [row(6)], productions: [row(7)], banners: [row(8)], leads: [row(9)],
    });
    readPurchaseFilledRows.mockResolvedValue(new Set([6]));
    readProductionFilledRows.mockResolvedValue(new Set([7]));
    readBannerFilledRows.mockResolvedValue(new Set([8]));
    readLeadFilledRows.mockResolvedValue(new Set([9]));
    const out = await loadDBOverview("u@x.y");
    expect(out).toEqual({
      purchases: [row(6)], productions: [row(7)], banners: [row(8)], leads: [row(9)],
    });
    expect(readPurchases).not.toHaveBeenCalled();
    expect(readProductions).not.toHaveBeenCalled();
    expect(readBanners).not.toHaveBeenCalled();
    expect(readLeads).not.toHaveBeenCalled();
  });
});

describe("loadDBOverview — 한 섹션이라도 빈틈 있으면 4섹션 전체 union 폴백", () => {
  it("productions 에만 빈틈(append 미러 실패로 신규행 누락) — 4섹션 전부 재조회", async () => {
    readDbTabFromDb.mockResolvedValue({
      purchases: [row(6)], productions: [row(7)], banners: [row(8)], leads: [row(9)],
    });
    readPurchaseFilledRows.mockResolvedValue(new Set([6]));
    readProductionFilledRows.mockResolvedValue(new Set([7, 10])); // row 10 = 미러 실패 신규행
    readBannerFilledRows.mockResolvedValue(new Set([8]));
    readLeadFilledRows.mockResolvedValue(new Set([9]));
    readProductions.mockResolvedValue({ rows: [row(7), row(10, { v: "sheet-new" })] });
    const out = await loadDBOverview("u@x.y");
    expect(readPurchases).toHaveBeenCalledTimes(1); // 빈틈 없던 섹션도 단순화를 위해 함께 재조회
    expect(out.productions.map((r) => r.row)).toEqual([7, 10]);
    expect(out.purchases).toEqual([row(6)]); // 값 자체는 DB 정본과 동일(시트에 추가분 없었으므로)
  });

  it("union 폴백 중 시트 read 마저 실패 — DB 정본만 반환(기존보다 나쁘지 않음)", async () => {
    readDbTabFromDb.mockResolvedValue({
      purchases: [row(6)], productions: [row(7)], banners: [], leads: [],
    });
    readPurchaseFilledRows.mockResolvedValue(new Set([6]));
    readProductionFilledRows.mockResolvedValue(new Set([7, 10]));
    readBannerFilledRows.mockResolvedValue(new Set());
    readLeadFilledRows.mockResolvedValue(new Set());
    readPurchases.mockRejectedValue(new Error("sheets down"));
    const out = await loadDBOverview("u@x.y");
    expect(out.purchases).toEqual([row(6)]);
    expect(out.productions).toEqual([row(7)]); // 시트 실패 → DB 정본 그대로(폴백 못 해도 안전)
  });
});

describe("loadDBOverview — 존재확인 자체 실패(섹션 하나라도)", () => {
  it("readBannerFilledRows 실패 → 안전 기본값(전체 union) 그대로 폴백", async () => {
    readDbTabFromDb.mockResolvedValue({
      purchases: [row(6)], productions: [], banners: [row(8)], leads: [],
    });
    readPurchaseFilledRows.mockResolvedValue(new Set([6]));
    readProductionFilledRows.mockResolvedValue(new Set());
    readBannerFilledRows.mockRejectedValue(new Error("sheets down"));
    readLeadFilledRows.mockResolvedValue(new Set());
    readBanners.mockResolvedValue({ rows: [row(8), row(11, { v: "sheet-new" })] });
    const out = await loadDBOverview("u@x.y");
    expect(readPurchases).toHaveBeenCalledTimes(1);
    expect(out.banners.map((r) => r.row)).toEqual([8, 11]);
  });
});

describe("loadDBOverview — DB read 실패", () => {
  it("기존처럼 4섹션 시트 전체 fallback — Sentry 기록 포함, 존재확인 결과는 버림", async () => {
    readDbTabFromDb.mockRejectedValue(new Error("db down"));
    readPurchases.mockResolvedValue({ rows: [row(6)] });
    const out = await loadDBOverview("u@x.y");
    expect(out.purchases).toEqual([row(6)]);
    expect(captureException).toHaveBeenCalled();
  });
});

describe("loadDBOverview — 비파일럿", () => {
  it("존재확인·DB read 둘 다 호출 안 함 — 기존 시트 경로 그대로", async () => {
    findUserByEmail.mockResolvedValue({ spreadsheetId: SHEET, cohort: "1" });
    readPurchases.mockResolvedValue({ rows: [row(6)] });
    const out = await loadDBOverview("u@x.y");
    expect(out.purchases).toEqual([row(6)]);
    expect(readDbTabFromDb).not.toHaveBeenCalled();
    expect(readPurchaseFilledRows).not.toHaveBeenCalled();
  });
});
