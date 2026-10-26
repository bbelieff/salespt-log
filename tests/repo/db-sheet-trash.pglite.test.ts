/** 휴지통(2026-10-26 belie) — 실제 PostgreSQL SQL(pglite). 합성 데이터만, 네트워크·운영 자격 없음. */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { DbSheetLeadInput } from "@/types/db-sheet";
const fixture = vi.hoisted(() => ({ db: null as PGlite | null }));
vi.mock("@/repo/db/client", () => ({ dbEnabled: () => true, getDbPool: () => ({ query, connect: async () => ({ query, release() {} }) }) }));
async function query(sql: string, params: unknown[] = []) { const r = await fixture.db!.query(sql, params); return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length }; }
import { listDbSheet, saveDbSheetLead, saveDbSheetContact, deleteDbSheetLead, listDbSheetTrash, restoreDbSheetTrash, emptyDbSheetTrash, DbSheetDuplicate } from "@/repo/db/db-sheet";
const ctx = { spreadsheetId: "synthetic-trash", cohort: "fixture", email: "owner@example.test" };
const other = { ...ctx, spreadsheetId: "synthetic-trash-b" };
let serial = 0;
const input = (over: Record<string, unknown> = {}) => DbSheetLeadInput.parse({ id: randomUUID(), date: "2027-01-08", channel: "매입DB", supplier: "가상DB", company: "합성 휴지통업체 " + (++serial), phone: "0105555" + String(serial).padStart(4, "0"), ...over });
async function sales(date: string) { const r = await query("select payload from sheet_rows where spreadsheet_id=$1 and tab='sales' and row_key=$2", [ctx.spreadsheetId, date + ":매입DB"]); return (r.rows[0] as { payload: Record<string, number> } | undefined)?.payload; }
beforeAll(async () => {
  fixture.db = new PGlite();
  await fixture.db.exec(`create table sheet_rows(cohort text,email text,spreadsheet_id text,tab text,row_key text,payload jsonb,mirror_pending boolean default false,updated_at timestamptz default now(),unique(spreadsheet_id,tab,row_key));`);
  await fixture.db.exec(readFileSync("lib/repo/db/migrations/0008_db_sheet.sql", "utf8"));
  const { lockedMeetingCounts } = await import("@/repo/db/sales-meeting-counts");
  await lockedMeetingCounts({ query } as never, ctx.spreadsheetId);
}, 60000);
afterAll(async () => { await fixture.db?.close(); });

it("삭제 = 휴지통: 활성 목록·STEP 2 에서 빠지고, 같은 DB 를 바로 다시 등록할 수 있다", async () => {
  let lead = (await saveDbSheetLead(ctx, input(), null)).lead;
  lead = (await saveDbSheetContact(ctx, lead.id, { date: "2027-01-09", result: "컨택진행", note: "가상 상담" }, lead.revision)).lead;
  expect((await sales("2027-01-08"))?.inflow).toBe(1);
  await deleteDbSheetLead(ctx, lead.id, lead.revision);
  expect((await listDbSheet(ctx)).some((x) => x.id === lead.id)).toBe(false);
  expect((await sales("2027-01-08"))?.inflow).toBe(0);
  expect((await sales("2027-01-09"))?.contactProgress).toBe(0);
  const trash = await listDbSheetTrash(ctx);
  expect(trash).toEqual([expect.objectContaining({ id: lead.id, company: lead.company, channel: "매입DB", supplier: "가상DB" })]);
  expect(await listDbSheetTrash(other)).toEqual([]);
  const again = (await saveDbSheetLead(ctx, { ...input(), company: lead.company, phone: lead.phone }, null)).lead;
  expect(again.id).not.toBe(lead.id);
  // 되돌리려면 같은 업체가 있다고 막고, 허용하면 되돌린다 — 상담 기록·STEP 2 도 돌아온다.
  await expect(restoreDbSheetTrash(ctx, [lead.id])).rejects.toBeInstanceOf(DbSheetDuplicate);
  const [back] = await restoreDbSheetTrash(ctx, [lead.id], true);
  expect(back!.lead).toMatchObject({ id: lead.id, company: lead.company, first: "2027-01-09" });
  expect((await sales("2027-01-08"))?.inflow).toBe(2);
  expect((await sales("2027-01-09"))?.contactProgress).toBe(1);
  expect((await listDbSheet(ctx)).find((x) => x.id === lead.id)?.inflowStatus?.state).toBe("recorded");
  expect(await listDbSheetTrash(ctx)).toEqual([]);
  // 되돌린 DB 는 다시 지울 수 있다(이력이 함께 돌아와 「유입 연결 기록 확인」에 막히지 않음).
  const restored = (await listDbSheet(ctx)).find((x) => x.id === lead.id)!;
  await expect(deleteDbSheetLead(ctx, restored.id, restored.revision)).resolves.toBeDefined();
});

it("영구 삭제·비우기는 보관본만 지운다", async () => {
  const a = (await saveDbSheetLead(ctx, input(), null)).lead, b = (await saveDbSheetLead(ctx, input(), null)).lead;
  await deleteDbSheetLead(ctx, a.id, a.revision); await deleteDbSheetLead(ctx, b.id, b.revision);
  expect((await listDbSheetTrash(ctx)).map((x) => x.id)).toEqual(expect.arrayContaining([a.id, b.id]));
  expect(await emptyDbSheetTrash(ctx, [a.id])).toBe(1);
  expect((await listDbSheetTrash(ctx)).map((x) => x.id)).not.toContain(a.id);
  expect(await restoreDbSheetTrash(ctx, [a.id])).toEqual([]);
  await emptyDbSheetTrash(ctx);
  expect(await listDbSheetTrash(ctx)).toEqual([]);
});
