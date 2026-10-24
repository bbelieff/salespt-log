/** 컨택결과 규칙(2026-10-23) — 최초상담일·현재상태·부재 다음 연락일을 실제 저장소 + 합성 PostgreSQL 로 확인. */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { DbSheetLeadInput } from "@/types/db-sheet";
const fixture = vi.hoisted(() => ({ db: null as PGlite | null }));
vi.mock("@/repo/db/client", () => ({ dbEnabled: () => true, getDbPool: () => ({ query, connect: async () => ({ query, release() {} }) }) }));
vi.mock("@/util/week", async (original) => ({ ...(await original<typeof import("@/util/week")>()), todayKST: () => "2027-05-10" }));
async function query(sql: string, params: unknown[] = []) { const r = await fixture.db!.query(sql, params); return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length }; }
import { listDbSheet, saveDbSheetLead, saveDbSheetContact, scheduleDbSheetContact, setDbSheetFirstDate, addDbSheetAbsence } from "@/repo/db/db-sheet";
const ctx = { spreadsheetId: "contact-rules-synthetic", cohort: "fixture", email: "rules@example.test" };
let serial = 0;
const input = () => DbSheetLeadInput.parse({ id: randomUUID(), date: "2027-05-01", channel: "매입DB", supplier: "합성공급", company: "합성 규칙 " + (++serial), phone: "010-0000-" + String(serial).padStart(4, "0") });
const fresh = async () => (await saveDbSheetLead(ctx, input(), null)).lead;
const get = async (id: string) => (await listDbSheet(ctx)).find(x => x.id === id)!;
beforeAll(async () => {
  fixture.db = new PGlite();
  await fixture.db.exec(`create table sheet_rows(cohort text,email text,spreadsheet_id text,tab text,row_key text,payload jsonb,mirror_pending boolean default false,updated_at timestamptz default now(),unique(spreadsheet_id,tab,row_key));`);
  await fixture.db.exec(readFileSync("lib/repo/db/migrations/0008_db_sheet.sql", "utf8"));
}, 60000);
afterAll(async () => { await fixture.db?.close(); });

it.each(["재통화", "단순거절"])("%s records 최초상담일 even after an empty manual first-date save", async (result) => {
  let lead = await fresh();
  lead = (await setDbSheetFirstDate(ctx, lead.id, "", lead.revision)).lead; // 표 칸을 눌렀다 떼기만 한 옛 저장
  lead = (await saveDbSheetContact(ctx, lead.id, { date: "2027-05-09", result, note: "" }, lead.revision)).lead;
  expect(lead.first).toBe("2027-05-09");
  expect(await get(lead.id)).toMatchObject({ first: "2027-05-09", stage: "DB컨택중", hasQualifiedContact: false });
});

it("keeps a manually entered 최초상담일", async () => {
  let lead = await fresh();
  lead = (await setDbSheetFirstDate(ctx, lead.id, "2027-05-02", lead.revision)).lead;
  lead = (await saveDbSheetContact(ctx, lead.id, { date: "2027-05-09", result: "재통화", note: "" }, lead.revision)).lead;
  expect(lead).toMatchObject({ first: "2027-05-02", firstManual: true });
});

it.each([["부재", "미컨택"], ["재통화", "DB컨택중"], ["단순거절", "DB컨택중"], ["컨택진행", "상담 중"], ["상담 후 거절", "상담 중"], ["AS예정", "진행종료"]])("%s → 현재상태 %s", async (result, stage) => {
  let lead = await fresh();
  lead = (await saveDbSheetContact(ctx, lead.id, { date: "2027-05-09", result: result!, note: "" }, lead.revision)).lead;
  expect(lead.stage).toBe(stage);
  expect((await get(lead.id)).stage).toBe(stage);
});

it("AS신청 ends the lead even after a qualified consultation", async () => {
  let lead = await fresh();
  lead = (await saveDbSheetContact(ctx, lead.id, { date: "2027-05-08", result: "컨택진행", note: "" }, lead.revision)).lead;
  lead = (await saveDbSheetContact(ctx, lead.id, { date: "2027-05-09", result: "AS예정", note: "" }, lead.revision)).lead;
  expect(lead.stage).toBe("진행종료");
});

it("derives 현재상태 for old rows on read without rewriting stored data", async () => {
  let lead = await fresh();
  lead = (await saveDbSheetContact(ctx, lead.id, { date: "2027-05-09", result: "재통화", note: "" }, lead.revision)).lead;
  await query(`update db_sheet_leads set data=jsonb_set(data,'{stage}','"미컨택"') where spreadsheet_id=$1 and id=$2`, [ctx.spreadsheetId, lead.id]);
  expect((await get(lead.id)).stage).toBe("DB컨택중");
  const stored = await query("select data->>'stage' as stage from db_sheet_leads where spreadsheet_id=$1 and id=$2", [ctx.spreadsheetId, lead.id]);
  expect(stored.rows[0]).toEqual({ stage: "미컨택" });
});

it("부재 schedules tomorrow (KST) as a new pending follow-up when 다음 연락일 is empty", async () => {
  let lead = await fresh();
  lead = (await saveDbSheetContact(ctx, lead.id, { date: "2027-05-10", result: "부재", note: "" }, lead.revision)).lead;
  expect(lead.next).toBe("2027-05-11");
  expect(lead.followUp).toMatchObject({ generation: 1, completedGeneration: 0 });
  expect((await get(lead.id)).next).toBe("2027-05-11");
});

it("부재 never overwrites a 다음 연락일 that is already set", async () => {
  let lead = await fresh();
  lead = (await scheduleDbSheetContact(ctx, lead.id, "2027-05-20", lead.revision)).lead;
  lead = (await saveDbSheetContact(ctx, lead.id, { date: "2027-05-10", result: "부재", note: "" }, lead.revision)).lead;
  expect(lead.next).toBe("2027-05-20");
  expect(lead.followUp?.generation).toBe(1);
});

it("other results keep the old rule: a consumed 다음 연락일 is cleared, not auto-filled", async () => {
  let lead = await fresh();
  lead = (await saveDbSheetContact(ctx, lead.id, { date: "2027-05-10", result: "재통화", note: "" }, lead.revision)).lead;
  expect(lead.next).toBe("");
});

// ── 2026-10-25 belie: 부재 다음 연락일은 「부재를 적은 날」 다음날, 부재 기록도 같은 규칙, 예전 기록 보정 ──
it("부재 on a past date schedules the day after that date, not tomorrow from today", async () => {
  let lead = await fresh();
  lead = (await saveDbSheetContact(ctx, lead.id, { date: "2027-05-07", result: "부재", note: "" }, lead.revision)).lead;
  expect(lead.next).toBe("2027-05-08");
});

it("부재 기록 schedules the next day when 다음 연락일 is empty or already reached, and keeps a later one", async () => {
  let lead = await fresh();
  lead = (await addDbSheetAbsence(ctx, lead.id, { date: "2027-05-08", hour: 10 }, lead.revision)).lead;
  expect(lead.next).toBe("2027-05-09");
  lead = (await addDbSheetAbsence(ctx, lead.id, { date: "2027-05-09", hour: 15 }, lead.revision)).lead;
  expect(lead.next).toBe("2027-05-10"); // 잡혀 있던 날 다시 부재 → 다음날로
  lead = (await scheduleDbSheetContact(ctx, lead.id, "2027-05-20", lead.revision)).lead;
  lead = (await addDbSheetAbsence(ctx, lead.id, { date: "2027-05-11", hour: 9 }, lead.revision)).lead;
  expect(lead.next).toBe("2027-05-20"); // 더 뒤로 정해 둔 날은 그대로
});

it("read backfills old 단순거절 rows without 최초상담일 to the refusal date, without counting them as STEP 2", async () => {
  let lead = await fresh();
  lead = (await saveDbSheetContact(ctx, lead.id, { date: "2027-05-06", result: "단순거절", note: "" }, lead.revision)).lead;
  await query("update db_sheet_leads set data = data || '{\"first\":\"\"}'::jsonb where spreadsheet_id=$1 and id=$2", [ctx.spreadsheetId, lead.id]);
  expect(await get(lead.id)).toMatchObject({ first: "2027-05-06", hasQualifiedContact: false, stage: "DB컨택중" });
});

it("read fills every 부재 row without 다음 연락일 with the day after the 부재, as a pending (not completed) reservation", async () => {
  let lead = await fresh();
  lead = (await saveDbSheetContact(ctx, lead.id, { date: "2027-05-06", result: "부재", note: "" }, lead.revision)).lead;
  await query("update db_sheet_leads set data = data || '{\"next\":\"\",\"followUp\":{\"generation\":0,\"completedGeneration\":0,\"lastContactDate\":\"2027-05-06\"}}'::jsonb where spreadsheet_id=$1 and id=$2", [ctx.spreadsheetId, lead.id]);
  lead = (await addDbSheetAbsence(ctx, lead.id, { date: "2027-05-08", hour: 11 }, lead.revision)).lead;
  await query("update db_sheet_leads set data = data || '{\"next\":\"\"}'::jsonb where spreadsheet_id=$1 and id=$2", [ctx.spreadsheetId, lead.id]);
  const seen = await get(lead.id);
  expect(seen.next).toBe("2027-05-09"); // 컨택일(05-06)·부재 기록(05-08) 중 늦은 날 다음날
  expect(seen.followUp!.completedGeneration).not.toBe(seen.followUp!.generation);
});
