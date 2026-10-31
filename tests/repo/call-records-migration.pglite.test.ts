/** 0014_call_records — 다시 돌려도 안전, 상태는 정해진 값만, DB 한 건을 지우면 그 통화 기록도 지워진다. 가상 값만 쓴다. */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";

let db: PGlite;
const sheet = "call-synthetic";
beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync("lib/repo/db/migrations/0008_db_sheet.sql", "utf8"));
  const sql = readFileSync("lib/repo/db/migrations/0014_call_records.sql", "utf8");
  await db.exec(sql);
  await db.exec(sql);
}, 60000);
afterAll(async () => { await db?.close(); });

const lead = async () => {
  const id = randomUUID();
  await db.query("insert into db_sheet_leads(spreadsheet_id,id,revision,data) values($1,$2,1,'{}')", [sheet, id]);
  return id;
};
const call = (leadId: string, status = "queued") =>
  db.query("insert into call_records(id,spreadsheet_id,lead_id,email,status,called_at) values($1,$2,$3,'call@example.test',$4,now())", [randomUUID(), sheet, leadId, status]);

it("정해진 상태만 받는다", async () => {
  const id = await lead();
  await call(id, "review");
  await expect(call(id, "applied")).rejects.toThrow();
});

it("없는 DB 에는 통화 기록을 못 만든다", async () => {
  await expect(call(randomUUID())).rejects.toThrow();
});

it("DB 한 건을 지우면 그 통화 기록도 지워진다(휴지통 이동 경로와 같은 순서)", async () => {
  const id = await lead();
  await call(id);
  await db.query("delete from db_sheet_contacts where spreadsheet_id=$1 and lead_id=$2", [sheet, id]);
  await db.query("delete from db_sheet_history where spreadsheet_id=$1 and lead_id=$2", [sheet, id]);
  await db.query("delete from db_sheet_leads where spreadsheet_id=$1 and id=$2", [sheet, id]);
  const left = await db.query("select count(*)::int as n from call_records where lead_id=$1", [id]);
  expect((left.rows[0] as { n: number }).n).toBe(0);
});
