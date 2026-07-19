/**
 * lead-chain §4-1·§7-1 회귀 — listLeadCandidates(발굴 후보 + matched 파생·미매칭 이월).
 *
 *  · matched = 발굴id 있으면 미팅 발굴id 집합 정확 매칭, 없으면 콜·지·기·소 미팅 업체명 폴백(근사).
 *  · **만료 없음**(belie 2026-07-15) — 미매칭이면 접수일 지나도 계속 후보로 반환(피커가 !matched 필터).
 *  · 타 채널 동명 미팅은 폴백 매칭 제외(오탐=lead 과다숨김 차단).
 *  · 게이트: 파일럿(8)=DB(readDbTabFromDb·readMeetingsFromDb), 비파일럿(7)=시트(readLeads·readAllMeetings).
 *  · 미팅 read 실패 → 빈 집합(전 lead 후보 = 안전 방향). 파일럿 lead DB 실패 → 시트 폴백.
 * daily-source 게이트는 실제 사용(dbEnabled·cohort 만 제어). repo 경계는 스텁.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DBBanner, DBLead, DBProduction, DBPurchase, Meeting } from "@/types";

const findUserByEmail = vi.fn();
const dbEnabled = vi.fn(() => true);

const readLeads = vi.fn(async () => ({ rows: [] as Array<DBLead & { row: number }> }));
const readDbTabFromDb = vi.fn();
const readMeetingsFromDb = vi.fn(async () => [] as Meeting[]);
const readAllMeetings = vi.fn(async () => [] as Meeting[]);

vi.mock("@/repo/users", () => ({
  findUserByEmail: (...a: unknown[]) => findUserByEmail(...(a as [])),
}));
vi.mock("@/repo/db/client", () => ({ dbEnabled: (...a: unknown[]) => dbEnabled(...(a as [])) }));
vi.mock("@/repo/db/read-db-tab", () => ({
  readDbTabFromDb: (...a: unknown[]) => readDbTabFromDb(...(a as [])),
}));
vi.mock("@/repo/db/read-daily", () => ({
  readMeetingsFromDb: (...a: unknown[]) => readMeetingsFromDb(...(a as [])),
}));
vi.mock("@/repo/meetings", () => ({
  readAllMeetings: (...a: unknown[]) => readAllMeetings(...(a as [])),
}));
vi.mock("@/repo/sales", () => ({ sumChannelInflowOverPeriod: vi.fn(async () => 0) }));
vi.mock("@/service/sales-write", () => ({ persistProductionCell: vi.fn() }));
vi.mock("@/repo/db", () => ({
  updatePurchase: vi.fn(), clearPurchase: vi.fn(),
  updateProduction: vi.fn(), clearProduction: vi.fn(),
  updateBanner: vi.fn(), clearBanner: vi.fn(),
  updateLead: vi.fn(), clearLead: vi.fn(),
  appendPurchase: vi.fn(), appendProduction: vi.fn(),
  appendBanner: vi.fn(), appendLead: vi.fn(),
  readPurchases: vi.fn(async () => ({ rows: [] as Array<DBPurchase & { row: number }> })),
  readProductions: vi.fn(async () => ({ rows: [] as Array<DBProduction & { row: number }> })),
  readBanners: vi.fn(async () => ({ rows: [] as Array<DBBanner & { row: number }> })),
  readLeads: (...a: unknown[]) => readLeads(...(a as [])),
  writeProductionCountCell: vi.fn(),
}));

import { listLeadCandidates } from "@/service/db";

const EMAIL = "u@x.y";
const SHEET = "sheet-1";

function lead(over: Partial<DBLead> & { row?: number } = {}): DBLead & { row: number } {
  return {
    구분: "소개", 접수일: "2026-07-01", 대표자명: "김대표", 업체명: "가나상사",
    소개처: "", 연락처: "010-0000-0000", 조건: "", row: 10, ...over,
  } as DBLead & { row: number };
}
/** matched 파생에 필요한 필드만 담은 미팅 부분 객체(readMeetingsFromDb/readAllMeetings 는 스텁). */
function mtg(over: Partial<Meeting> = {}): Meeting {
  return { channel: "콜·지·기·소", 업체명: "가나상사", ...over } as Meeting;
}

function pilot() { findUserByEmail.mockResolvedValue({ spreadsheetId: SHEET, cohort: "8", email: EMAIL }); }
function nonPilot() { findUserByEmail.mockResolvedValue({ spreadsheetId: SHEET, cohort: "7", email: EMAIL }); }

beforeEach(() => {
  for (const m of [findUserByEmail, dbEnabled, readLeads, readDbTabFromDb, readMeetingsFromDb, readAllMeetings])
    m.mockReset();
  dbEnabled.mockReturnValue(true);
  readMeetingsFromDb.mockResolvedValue([]);
  readAllMeetings.mockResolvedValue([]);
  readLeads.mockResolvedValue({ rows: [] });
  readDbTabFromDb.mockResolvedValue({ purchases: [], productions: [], banners: [], leads: [] });
  pilot();
});

/** 파일럿 DB overlay leads 세팅. */
function dbLeads(...rows: Array<DBLead & { row: number }>) {
  readDbTabFromDb.mockResolvedValue({ purchases: [], productions: [], banners: [], leads: rows });
}

describe("listLeadCandidates — matched 파생", () => {
  it("발굴id 링크 정확 매칭 — 미팅에 실린 id 만 matched", async () => {
    dbLeads(lead({ 발굴id: "x", 업체명: "에이", row: 11 }), lead({ 발굴id: "y", 업체명: "비이", row: 12 }));
    readMeetingsFromDb.mockResolvedValue([mtg({ 발굴id: "x", 업체명: "에이" })]);
    const out = await listLeadCandidates(EMAIL);
    expect(out.find((l) => l.발굴id === "x")!.matched).toBe(true);
    expect(out.find((l) => l.발굴id === "y")!.matched).toBe(false);
    expect(out).toHaveLength(2); // 매칭돼도 목록엔 남는다(피커가 필터)
  });

  it("미매칭은 접수일이 지나도 후보로 반환(만료 없음)", async () => {
    dbLeads(lead({ 발굴id: "z", 업체명: "옛업체", 접수일: "2025-01-01", row: 13 }));
    readMeetingsFromDb.mockResolvedValue([]); // 아무 미팅도 이 발굴을 안 씀
    const out = await listLeadCandidates(EMAIL);
    expect(out).toHaveLength(1);
    expect(out[0]!.matched).toBe(false);
  });

  it("발굴id 없는 lead 는 콜·지·기·소 미팅 업체명 폴백('(변경)' 접두 무시)", async () => {
    dbLeads(lead({ 업체명: "다라", 발굴id: undefined, row: 14 }));
    readMeetingsFromDb.mockResolvedValue([mtg({ channel: "콜·지·기·소", 업체명: "(변경) 다라" })]);
    const out = await listLeadCandidates(EMAIL);
    expect(out[0]!.matched).toBe(true);
  });

  it("타 채널 동명 미팅은 폴백 매칭 안 함(오탐 차단)", async () => {
    dbLeads(lead({ 업체명: "마바", 발굴id: undefined, row: 15 }));
    readMeetingsFromDb.mockResolvedValue([mtg({ channel: "매입DB", 업체명: "마바" })]);
    const out = await listLeadCandidates(EMAIL);
    expect(out[0]!.matched).toBe(false);
  });

  it("업체명·발굴id 둘 다 없는 lead(대표자명만) = 영구 후보(matched=false)", async () => {
    dbLeads(lead({ 업체명: "", 발굴id: undefined, 대표자명: "박대표", row: 16 }));
    readMeetingsFromDb.mockResolvedValue([mtg({ channel: "콜·지·기·소", 업체명: "박대표" })]);
    const out = await listLeadCandidates(EMAIL);
    expect(out[0]!.matched).toBe(false);
  });

  it("접수일 내림차순 정렬", async () => {
    dbLeads(
      lead({ 업체명: "옛", 접수일: "2026-07-01", row: 20 }),
      lead({ 업체명: "새", 접수일: "2026-07-10", row: 21 }),
    );
    const out = await listLeadCandidates(EMAIL);
    expect(out.map((l) => l.접수일)).toEqual(["2026-07-10", "2026-07-01"]);
  });

  it("미팅 read 실패 → 전 lead matched=false(안전 방향, 목록은 정상)", async () => {
    dbLeads(lead({ 발굴id: "x", row: 22 }));
    readMeetingsFromDb.mockRejectedValue(new Error("db down"));
    const out = await listLeadCandidates(EMAIL);
    expect(out).toHaveLength(1);
    expect(out[0]!.matched).toBe(false);
  });
});

describe("listLeadCandidates — 게이트", () => {
  it("비파일럿(7) → 시트 리더(readLeads·readAllMeetings), DB 리더 미사용", async () => {
    nonPilot();
    readLeads.mockResolvedValue({ rows: [lead({ 업체명: "비파", row: 30 })] });
    readAllMeetings.mockResolvedValue([mtg({ channel: "콜·지·기·소", 업체명: "비파" })]);
    const out = await listLeadCandidates(EMAIL);
    expect(readDbTabFromDb).not.toHaveBeenCalled();
    expect(readMeetingsFromDb).not.toHaveBeenCalled();
    expect(readAllMeetings).toHaveBeenCalledWith(SHEET);
    expect(out[0]!.matched).toBe(true); // 시트 leads(발굴id 없음) + 업체명 폴백
  });

  it("파일럿 lead DB read 실패 → 시트 폴백(목록 항상 노출)", async () => {
    pilot();
    readDbTabFromDb.mockRejectedValue(new Error("db read fail"));
    readLeads.mockResolvedValue({ rows: [lead({ 업체명: "폴백업체", row: 31 })] });
    const out = await listLeadCandidates(EMAIL);
    expect(readLeads).toHaveBeenCalledWith(SHEET);
    expect(out).toHaveLength(1);
    expect(out[0]!.업체명).toBe("폴백업체");
  });
});
