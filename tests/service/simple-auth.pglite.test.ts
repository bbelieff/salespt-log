/**
 * 간편인증 서류 조회 흐름(0018 + service) — CODEF·사용자·DB관리시트는 흉내, 저장소는 실제 SQL(PGlite).
 * 가상 이메일·가상 시트·가상 업체만. CODEF 응답 모양은 데모 실측(2026-11-08): 첫 요청 CF-03002 + continue2Way,
 * 같은 id 의 나머지 요청은 승인 뒤 도착.
 */
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.AUTH_SECRET ??= "test-secret-for-simple-auth-0123456789";

type Call = { path: string; params: Record<string, unknown> };
const h = vi.hoisted(() => ({
  db: null as unknown,
  calls: [] as Call[],
  approved: false,
  release: null as null | (() => void),
  leads: [] as { id: string; company: string; owner: string; phone: string; biz: string; revision: number; meetingId: string | null; contact: { ci: Record<string, string> } }[],
  saved: [] as { action: string; lead: { id: string; company: string; recording?: { inflow: boolean }; contact?: { ci: Record<string, string> } }; revision: number | null }[],
}));
const PDF = "JVBERi0xLjQK".padEnd(300, "A");
const BIZ = [
  { resCompanyIdentityNo: "2148877123", resCompanyNm: "가상정밀", resUserNm: "김가상", resOpenDate: "20190311", resBusinessTypes: "제조업", resBusinessItems: "금속가공", resBusinessmanType: "개인사업자", resIssueDate: "20261109", resOriGinalData1: PDF },
  { resCompanyIdentityNo: "2141290311", resCompanyNm: "가상물산", resUserNm: "김가상", resOpenDate: "20210101", resBusinessmanType: "개인사업자", resIssueDate: "20261109" },
];
const VAT = [{ resCompanyIdentityNo: "2148877123", commStartDate: "20250101", resIncomeTotalAmt: "500000000", resIssueDate: "20261109" }];

vi.mock("@/repo/db/client", () => ({ dbEnabled: () => true, getDbPool: () => h.db }));
vi.mock("@/repo/users", () => ({ findUserByEmail: async () => ({ spreadsheetId: "sheet-a" }) }));
vi.mock("@/repo/codef-client", () => ({
  CodefNotConfigured: class extends Error {},
  codefConfigured: () => true,
  codefEncrypt: (v: string) => `enc(${v.length})`,
  codefCall: async (path: string, params: Record<string, unknown>) => {
    h.calls.push({ path, params });
    const ok = (data: unknown) => ({ code: "CF-00000", message: "성공", extraMessage: "", data });
    if (path.endsWith("corporate-registration")) {
      if (!params.is2Way) return { code: "CF-03002", message: "추가인증", extraMessage: "", data: { continue2Way: true, jobIndex: 0, threadIndex: 0, jti: "j", twoWayTimestamp: 1 } };
      if (!h.approved) return { code: "CF-03002", message: "추가인증", extraMessage: "", data: { continue2Way: true } };
      h.release?.();
      return ok(BIZ);
    }
    if (path.endsWith("additional-tax-standard")) {
      // 같은 id 묶음: 승인될 때까지 응답을 잡고 있다.
      await new Promise<void>((r) => { h.release = r; });
      return ok(VAT);
    }
    return { code: "CF-12100", message: "실패", extraMessage: "가상 오류", data: null };
  },
}));
vi.mock("@/service/db-sheet", () => ({
  resolveDbSheetContext: async (email: string) => ({ email, spreadsheetId: "sheet-a", cohort: "12기" }),
  loadDbSheet: async () => h.leads,
  executeDbSheet: async (_ctx: unknown, cmd: (typeof h.saved)[number]) => {
    h.saved.push(cmd);
    if (cmd.revision === null) h.leads.push({ ...(cmd.lead as object), revision: 1, meetingId: null } as never);
    return { leads: [] };
  },
}));

import { actSimpleAuth, currentCompanyInfo, listSimpleAuth, originalOf, resetSimpleAuthJobs, startSimpleAuth } from "@/service/simple-auth";

const who = { email: "a@example.test", spreadsheetId: "sheet-a" };
const other = { email: "b@example.test", spreadsheetId: "sheet-b" };
const input = { mode: "simple", owner: "김가상", birth: "19780312", phone: "010-0000-1234", telecom: "", method: "카카오톡", docs: ["biz", "vat"] };
const wait = async (until: () => Promise<boolean>) => { for (let i = 0; i < 100; i++) { if (await until()) return; await new Promise((r) => setTimeout(r, 30)); } throw new Error("timeout"); };

let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  const sql = readFileSync("lib/repo/db/migrations/0018_simple_auth.sql", "utf8");
  await db.exec(sql); await db.exec(sql);
  h.db = db;
}, 60000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec("delete from public.simple_auth_requests");
  resetSimpleAuthJobs();
  h.calls = []; h.approved = false; h.release = null; h.saved = [];
  h.leads = [{
    id: "11111111-1111-4111-8111-111111111111", supplier: "가상공급처", date: "2026-11-01", channel: "매입DB", company: "가상정밀", owner: "김가상",
    phone: "010-0000-1234", biz: "214-88-77123", address: "", industry: "", credit: "", sales: "", arrears: "", funds: "", next: "", memo: "",
    revision: 3, meetingId: null, contact: { ci: { 업태: "" } },
  } as never];
});

async function startAndApprove() {
  const req = await startSimpleAuth(who, input);
  await wait(async () => h.calls.length >= 2);
  return req;
}

describe("간편인증 보내기 → 승인 확인 → 결과", () => {
  it("승인 전에는 「아직 승인 전」, 승인 뒤 사업자별 결과 · 사업자번호로 DB 연결 · 없는 사업자는 새 DB(유입 반영 안 함)", async () => {
    const req = await startAndApprove();
    expect(req.status).toBe("waiting");
    expect(h.calls[0]!.params).toMatchObject({ loginType: "5", loginTypeLevel: "1", loginIdentity: "19780312", phoneNo: "01000001234", originDataYN1: "1" });
    const early = await actSimpleAuth(who, req.id, { action: "confirm" });
    expect(early.message).toMatch(/아직 승인하지 않았어요/);

    h.approved = true;
    await actSimpleAuth(who, req.id, { action: "confirm" });
    await wait(async () => (await listSimpleAuth(who))[0]!.status === "done");
    const [done] = await listSimpleAuth(who);
    expect(done!.businesses.map((b) => [b.name, b.link.state])).toEqual([["가상정밀", "linked"], ["가상물산", "linked"]]);
    const a = done!.businesses[0]!;
    expect(a.link).toMatchObject({ why: "bizNo", dbId: h.leads[0]!.id });
    expect(a.results.find((r) => r.key === "vat")).toMatchObject({ ok: true, facts: ["2025년 500,000,000원"] });
    expect(a.results.find((r) => r.key === "biz")!.hasOriginal).toBe(true);
    const b = done!.businesses[1]!;
    expect(b.link).toMatchObject({ why: "created" });
    expect(b.results.find((r) => r.key === "vat")).toMatchObject({ ok: false });
    expect(h.saved).toHaveLength(1);
    expect(h.saved[0]!.lead).toMatchObject({ company: "가상물산", recording: { inflow: false } });

    const pdf = await originalOf(who, req.id, "214-88-77123", "biz");
    expect(pdf.fileName).toBe("가상정밀 사업자등록증명.pdf");
    expect(pdf.pdf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("업체정보 반영: 받은 서류에 있는 칸만 DB 업체정보에 합치고 반영 표시", async () => {
    const req = await startAndApprove();
    h.approved = true;
    await actSimpleAuth(who, req.id, { action: "confirm" });
    await wait(async () => (await listSimpleAuth(who))[0]!.status === "done");
    expect((await currentCompanyInfo(who, req.id, "214-88-77123")).readOnly).toBe(false);
    const { request } = await actSimpleAuth(who, req.id, { action: "apply", bizNo: "214-88-77123", patch: { 업태: "제조업", 신용점수: "999" } });
    const saved = h.saved.at(-1)!;
    expect(saved).toMatchObject({ action: "save", revision: 3 });
    expect(saved.lead.contact!.ci).toMatchObject({ 업태: "제조업" });
    expect(saved.lead.contact!.ci.신용점수).toBe("");
    expect(request!.businesses[0]!.applied).toBe(true);
  });

  it("다른 수강생은 요청을 보거나 바꿀 수 없다", async () => {
    const req = await startSimpleAuth(who, input);
    expect(await listSimpleAuth(other)).toEqual([]);
    await expect(actSimpleAuth(other, req.id, { action: "cancel" })).rejects.toThrow("요청을 찾지 못했어요");
  });

  it("서버가 다시 시작돼 진행 정보가 사라진 요청은 「다시 보내 주세요」로 정리", async () => {
    await startSimpleAuth(who, input);
    resetSimpleAuthJobs();
    const [r] = await listSimpleAuth(who);
    expect(r).toMatchObject({ status: "failed", error: expect.stringMatching(/다시 보내 주세요/) });
  });

  it("지방세를 고르면 주소·주민번호 뒷자리가 필요하다", async () => {
    await expect(startSimpleAuth(who, { ...input, docs: ["biz", "localTax"] })).rejects.toThrow("주소가 필요해요");
  });
});
