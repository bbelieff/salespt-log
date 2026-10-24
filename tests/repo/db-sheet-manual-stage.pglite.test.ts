/** 현재상태 직접 정하기(장기관리·진행종료·DB컨택중, 2026-10-23 belie) — 실제 저장소 + 합성 PostgreSQL. */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { DbSheetLeadInput } from "@/types/db-sheet";
import { buildRecontactLeads, buildInitialLeads } from "@/lib/analytics/dashboard-follow-ups";
const fixture = vi.hoisted(() => ({ db: null as PGlite | null }));
vi.mock("@/repo/db/client", () => ({ dbEnabled: () => true, getDbPool: () => ({ query, connect: async () => ({ query, release() {} }) }) }));
vi.mock("@/util/week", async (original) => ({ ...(await original<typeof import("@/util/week")>()), todayKST: () => "2027-05-10" }));
async function query(sql: string, params: unknown[] = []) { const r = await fixture.db!.query(sql, params); return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length }; }
import { listDbSheet, saveDbSheetLead, saveDbSheetContact, setDbSheetManualStage, DbSheetOperationBlocked, DbSheetConflict } from "@/repo/db/db-sheet";
const ctx = { spreadsheetId: "manual-stage-synthetic", cohort: "fixture", email: "stage@example.test" };
let serial = 0;
const input = () => DbSheetLeadInput.parse({ id: randomUUID(), date: "2027-05-01", channel: "매입DB", supplier: "합성공급", company: "합성 상태 " + (++serial), phone: "010-0000-" + String(serial).padStart(4, "0") });
const fresh = async () => (await saveDbSheetLead(ctx, input(), null)).lead;
const get = async (id: string) => (await listDbSheet(ctx)).find(x => x.id === id)!;
beforeAll(async () => {
  fixture.db = new PGlite();
  await fixture.db.exec(`create table sheet_rows(cohort text,email text,spreadsheet_id text,tab text,row_key text,payload jsonb,mirror_pending boolean default false,updated_at timestamptz default now(),unique(spreadsheet_id,tab,row_key));`);
  await fixture.db.exec(readFileSync("lib/repo/db/migrations/0008_db_sheet.sql", "utf8"));
}, 60000);
afterAll(async () => { await fixture.db?.close(); });

it.each(["장기관리", "진행종료"] as const)("%s persists, survives a plain save, and leaves 오늘 챙길 일", async (stage) => {
  let lead = await fresh();
  lead = (await saveDbSheetContact(ctx, lead.id, { date: "2027-05-09", result: "부재", note: "" }, lead.revision)).lead;
  expect(buildRecontactLeads([await get(lead.id)], "2027-05-11")).toHaveLength(1);
  lead = (await setDbSheetManualStage(ctx, lead.id, stage, lead.revision)).lead;
  expect(lead).toMatchObject({ stage, manualStage: stage, result: "부재", next: "2027-05-10" }); // 부재를 적은 날(05-09) 다음날 — 2026-10-25 규칙
  lead = (await saveDbSheetLead(ctx, { ...lead, memo: "메모만 수정" }, lead.revision)).lead;
  const read = await get(lead.id);
  expect(read).toMatchObject({ stage, manualStage: stage });
  expect(buildRecontactLeads([read], "2027-05-11")).toEqual([]);
});

it("장기관리 returns to DB컨택중 even for a 부재 result", async () => {
  let lead = await fresh();
  lead = (await saveDbSheetContact(ctx, lead.id, { date: "2027-05-09", result: "부재", note: "" }, lead.revision)).lead;
  lead = (await setDbSheetManualStage(ctx, lead.id, "장기관리", lead.revision)).lead;
  lead = (await setDbSheetManualStage(ctx, lead.id, "DB컨택중", lead.revision)).lead;
  expect((await get(lead.id)).stage).toBe("DB컨택중");
  expect(buildRecontactLeads([await get(lead.id)], "2027-05-11")).toHaveLength(1);
});

it("a new contact result releases the manual stage; AS신청 still ends it", async () => {
  let lead = await fresh();
  lead = (await setDbSheetManualStage(ctx, lead.id, "장기관리", lead.revision)).lead;
  expect(buildInitialLeads([await get(lead.id)], "2027-05-10")).toEqual([]);
  lead = (await saveDbSheetContact(ctx, lead.id, { date: "2027-05-10", result: "재통화", note: "" }, lead.revision)).lead;
  expect(lead.manualStage).toBeUndefined();
  expect((await get(lead.id)).stage).toBe("DB컨택중");
  lead = (await saveDbSheetContact(ctx, lead.id, { date: "2027-05-11", result: "AS예정", note: "" }, lead.revision)).lead;
  expect((await get(lead.id)).stage).toBe("진행종료");
});

it("rejects stale revisions and meeting-linked leads", async () => {
  const lead = await fresh();
  await expect(setDbSheetManualStage(ctx, lead.id, "장기관리", lead.revision + 5)).rejects.toBeInstanceOf(DbSheetConflict);
  await query("update db_sheet_leads set data=jsonb_set(data,'{meetingId}',to_jsonb($3::text)) where spreadsheet_id=$1 and id=$2", [ctx.spreadsheetId, lead.id, randomUUID()]);
  await expect(setDbSheetManualStage(ctx, lead.id, "진행종료", lead.revision)).rejects.toBeInstanceOf(DbSheetOperationBlocked);
});
