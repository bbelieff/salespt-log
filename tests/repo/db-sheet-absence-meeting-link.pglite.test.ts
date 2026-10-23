/** 부재 기록 · 따로 잡은 미팅 연결(2026-10-23 belie) — 실제 저장소 + 합성 PostgreSQL. 실제 이름·전화 없음. */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, it, expect, vi, describe } from "vitest";
import { DbSheetLeadInput, dbSheetAbsenceHint, isSimilarDbSheetCompany } from "@/types/db-sheet";
import { Meeting } from "@/types/meeting";
import { buildRecontactLeads } from "@/lib/analytics/dashboard-follow-ups";
const fixture = vi.hoisted(() => ({ db: null as PGlite | null }));
vi.mock("@/repo/db/client", () => ({ dbEnabled: () => true, getDbPool: () => ({ query, connect: async () => ({ query, release() {} }) }) }));
vi.mock("@/util/week", async (original) => ({ ...(await original<typeof import("@/util/week")>()), todayKST: () => "2027-05-10" }));
async function query(sql: string, params: unknown[] = []) { const r = await fixture.db!.query(sql, params); return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length }; }
import {
  listDbSheet, saveDbSheetLead, saveDbSheetContact, addDbSheetAbsence, removeDbSheetAbsence,
  listDbSheetMeetingCandidates, linkDbSheetMeeting, unlinkDbSheetMeeting, DbSheetOperationBlocked,
} from "@/repo/db/db-sheet";
const ctx = { spreadsheetId: "absence-link-synthetic", cohort: "fixture", email: "link@example.test" };
let serial = 0;
const input = (company: string) => DbSheetLeadInput.parse({ id: randomUUID(), date: "2027-05-01", channel: "매입DB", supplier: "합성공급", company, phone: "010-0000-" + String(++serial).padStart(4, "0") });
const fresh = async (company = "합성 부재 " + serial) => (await saveDbSheetLead(ctx, input(company), null)).lead;
const get = async (id: string) => (await listDbSheet(ctx)).find(x => x.id === id)!;
async function step2Meeting(company: string, extra: Record<string, unknown> = {}) {
  const m = Meeting.parse({ id: randomUUID(), 예약일: "2027-05-03", 예약시각: "10:00", 미팅날짜: "2027-05-08", 미팅시간: "14:00", channel: "매입DB", 업체명: company, 장소: "사무실", ...extra });
  await query("insert into sheet_rows(cohort,email,spreadsheet_id,tab,row_key,payload) values($1,$2,$3,'meetings',$4,$5::jsonb)", [ctx.cohort, ctx.email, ctx.spreadsheetId, m.id, JSON.stringify(m)]);
  return m.id;
}
const salesSnapshot = async () => JSON.stringify((await query("select row_key,payload from sheet_rows where spreadsheet_id=$1 and tab='sales' order by row_key", [ctx.spreadsheetId])).rows);
beforeAll(async () => {
  fixture.db = new PGlite();
  await fixture.db.exec(`create table sheet_rows(cohort text,email text,spreadsheet_id text,tab text,row_key text,payload jsonb,mirror_pending boolean default false,updated_at timestamptz default now(),unique(spreadsheet_id,tab,row_key));`);
  await fixture.db.exec(readFileSync("lib/repo/db/migrations/0008_db_sheet.sql", "utf8"));
}, 60000);
afterAll(async () => { await fixture.db?.close(); });

describe("부재 기록", () => {
  it("adds sorted entries once per date·hour, removes one, and keeps result·STEP 2 counts", async () => {
    let lead = await fresh();
    lead = (await saveDbSheetContact(ctx, lead.id, { date: "2027-05-09", result: "부재", note: "" }, lead.revision)).lead;
    const before = await salesSnapshot();
    lead = (await addDbSheetAbsence(ctx, lead.id, { date: "2027-05-09", hour: 14 }, lead.revision)).lead;
    lead = (await addDbSheetAbsence(ctx, lead.id, { date: "2027-05-08", hour: 10 }, lead.revision)).lead;
    lead = (await addDbSheetAbsence(ctx, lead.id, { date: "2027-05-09", hour: 14 }, lead.revision)).lead;
    expect((await get(lead.id)).absences).toEqual([{ date: "2027-05-08", hour: 10 }, { date: "2027-05-09", hour: 14 }]);
    expect((await get(lead.id)).result).toBe("부재");
    expect(await salesSnapshot()).toBe(before);
    lead = (await removeDbSheetAbsence(ctx, lead.id, { date: "2027-05-08", hour: 10 }, lead.revision)).lead;
    expect((await get(lead.id)).absences).toEqual([{ date: "2027-05-09", hour: 14 }]);
  });
  it("rejects hours outside 08~21", async () => {
    const lead = await fresh();
    await expect(addDbSheetAbsence(ctx, lead.id, { date: "2027-05-09", hour: 22 }, lead.revision)).rejects.toThrow();
  });
  it("hint names tried hours and untried bands", () => {
    expect(dbSheetAbsenceHint([{ date: "2027-05-09", hour: 10 }, { date: "2027-05-10", hour: 11 }])).toBe("지금까지 10시·11시에 걸었어요. 점심·오후·저녁에 걸어 보세요.");
    expect(dbSheetAbsenceHint([])).toBe("");
  });
});

describe("따로 잡은 미팅 연결", () => {
  it("matches same or similar company names, ignoring (주)·spaces", () => {
    expect(isSimilarDbSheetCompany("(주)합성이엔지", "합성 이엔지")).toBe(true);
    expect(isSimilarDbSheetCompany("합성이엔지", "합성이엔지 본점")).toBe(true);
    expect(isSimilarDbSheetCompany("합성", "다른상사")).toBe(false);
    expect(isSimilarDbSheetCompany("가", "가나")).toBe(false);
  });
  it("lists unlinked similar meetings, links without touching STEP 2·3 counts, clears 지연, and unlinks", async () => {
    let lead = await fresh("(주)합성연결상사");
    const other = await fresh("합성연결상사 2호");
    lead = (await saveDbSheetContact(ctx, lead.id, { date: "2027-05-03", result: "재통화", note: "" }, lead.revision)).lead;
    const mid = await step2Meeting("합성연결상사");
    await step2Meeting("합성연결상사", { 상태: "취소" });
    await step2Meeting("전혀다른회사");
    const candidates = await listDbSheetMeetingCandidates(ctx, lead.id);
    expect(candidates.map(c => c.id)).toEqual([mid]);
    const before = await salesSnapshot();
    lead = (await linkDbSheetMeeting(ctx, lead.id, mid, lead.revision)).lead;
    const linked = await get(lead.id);
    expect(linked).toMatchObject({ meetingId: mid, linkedExisting: true, stage: "미팅예약" });
    expect(await salesSnapshot()).toBe(before);
    expect(buildRecontactLeads([linked], "2027-05-20")).toEqual([]);
    expect(await listDbSheetMeetingCandidates(ctx, other.id)).toEqual([]);
    lead = (await unlinkDbSheetMeeting(ctx, lead.id, linked.revision)).lead;
    const back = await get(lead.id);
    expect(back.meetingId).toBeNull();
    expect(back.linkedExisting).toBeUndefined();
    expect(back.stage).toBe("DB컨택중");
    expect(await salesSnapshot()).toBe(before);
  });
  it("refuses to link a meeting already linked elsewhere, or to unlink a meeting registered from the DB sheet", async () => {
    const mid = await step2Meeting("합성중복상사");
    let a = await fresh("합성중복상사");
    const b = await fresh("합성중복상사 지점");
    a = (await linkDbSheetMeeting(ctx, a.id, mid, a.revision)).lead;
    await expect(linkDbSheetMeeting(ctx, b.id, mid, b.revision)).rejects.toBeInstanceOf(DbSheetOperationBlocked);
    const c = await fresh("합성직접등록");
    await query("update db_sheet_leads set data=jsonb_set(data,'{meetingId}',to_jsonb($3::text)),meeting_id=$3::uuid where spreadsheet_id=$1 and id=$2", [ctx.spreadsheetId, c.id, randomUUID()]);
    await expect(unlinkDbSheetMeeting(ctx, c.id, c.revision)).rejects.toBeInstanceOf(DbSheetOperationBlocked);
  });
});
