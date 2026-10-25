/** 실무/수납 맞춤공고 서비스(2026-10-26 4a) — 합성 계약·업체·공고. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompanyInfo, ContractPayment } from "@/types";

const m = vi.hoisted(() => ({
  findUserByEmail: vi.fn(), readContractsFromDb: vi.fn(), readCompanyInfosFromDb: vi.fn(), readPolicyNewsDays: vi.fn(), usesDbStorage: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/repo/users", () => ({ findUserByEmail: m.findUserByEmail }));
vi.mock("@/repo/db/read-daily", () => ({ readContractsFromDb: m.readContractsFromDb }));
vi.mock("@/repo/db/company-info-all", () => ({ readCompanyInfosFromDb: m.readCompanyInfosFromDb }));
vi.mock("@/repo/policy-news", () => ({ readPolicyNewsDays: m.readPolicyNewsDays }));
vi.mock("@/service/daily-source", () => ({ usesDbStorage: m.usesDbStorage }));

import { loadGrantMatches } from "@/lib/service/grant-matches";

const cp = (업체명: string, extra: Partial<ContractPayment> = {}) => ContractPayment.parse({ 계약일: "2026-10-01", 업체명, ...extra });
const ci = (o: Partial<CompanyInfo>) => CompanyInfo.parse(o);
const day = { schema: 1 as const, date: "2026-10-23", rows: [
  { 사업명: "울산 공고", 주관기관: "가상재단", 지역: "울산", 마감일: "2026-12-31", 공고원문링크: "https://example.test/x?pblancId=P1" },
  { 사업명: "부산 공고", 주관기관: "가상재단", 지역: "부산", 마감일: "2026-12-31" },
  { 사업명: "지난 공고", 주관기관: "가상재단", 지역: "전국", 마감일: "2026-10-01" },
] };

describe("loadGrantMatches", () => {
  beforeEach(() => {
    Object.values(m).forEach((f) => f.mockReset());
    m.findUserByEmail.mockResolvedValue({ spreadsheetId: "sheet" });
    m.usesDbStorage.mockReturnValue(true);
    m.readPolicyNewsDays.mockResolvedValue([day]);
    m.readContractsFromDb.mockResolvedValue([cp("가상정밀"), cp("빈상사"), cp("무정보"), cp("해지상사", { 해지일: "2026-10-10" })]);
    m.readCompanyInfosFromDb.mockResolvedValue(new Map([
      ["2026-10-01|가상정밀", ci({ 소재지: "울산광역시 남구 1", 업태: "제조" })],
      ["2026-10-01|빈상사", ci({ 업태: "도소매" })],
      ["2026-10-01|해지상사", ci({ 소재지: "울산 남구 1" })],
    ]));
  });
  it("계약ref 별 판정 · 쓰인 공고만 요약 · 해지·마감 지난 것 제외", async () => {
    const r = await loadGrantMatches("x@test", "2026-10-26");
    expect(r.unavailable).toBe(false);
    expect(r.companies["2026-10-01|가상정밀"]).toMatchObject({ hasInfo: true, noRegion: false, matches: [{ id: "P1", verdict: "match" }] });
    expect(r.companies["2026-10-01|빈상사"]).toMatchObject({ hasInfo: true, noRegion: true });
    expect(r.companies["2026-10-01|무정보"]).toEqual({ hasInfo: false, noRegion: false, matches: [] });
    expect(r.companies["2026-10-01|해지상사"]).toBeUndefined();
    expect(Object.keys(r.announcements)).toContain("P1");
    expect(Object.values(r.announcements).map((a) => a.title)).not.toContain("지난 공고");
  });
  it("피드가 비거나 DB 정본이 아니면 unavailable", async () => {
    m.readPolicyNewsDays.mockResolvedValue([]);
    expect((await loadGrantMatches("x@test", "2026-10-26")).unavailable).toBe(true);
    m.usesDbStorage.mockReturnValue(false);
    expect((await loadGrantMatches("x@test", "2026-10-26")).unavailable).toBe(true);
  });
});
