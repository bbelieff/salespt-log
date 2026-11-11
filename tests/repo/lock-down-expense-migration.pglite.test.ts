/** 0021 — 지출 표 잠그기: 두 번 돌려도 안전, 없는 표는 건너뜀, 있는 표는 RLS 켜짐, 주인 연결은 그대로 읽고 쓴다. 가상 값만. */
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";

let db: PGlite;
const sql = readFileSync("lib/repo/db/migrations/0021_lock_down_expense_tables.sql", "utf8");
beforeAll(async () => {
  db = new PGlite();
  await db.exec("create table public.expense_entries(id text primary key, spreadsheet_id text, amount_won int)");
  await db.exec("create table public.expense_categories(id text primary key, name text)");
  await db.exec("insert into expense_entries values('e1','synthetic',1000)");
  await db.exec("create role anon");
  await db.exec("grant select, insert, update, delete on public.expense_entries to anon");
  await db.exec(sql);
  await db.exec(sql);
}, 60000);
afterAll(async () => { await db?.close(); });

const rls = async (t: string) => ((await db.query("select relrowsecurity as on from pg_class where relname=$1", [t])).rows[0] as { on: boolean } | undefined)?.on;

it("있는 지출 표는 RLS 가 켜진다", async () => {
  for (const t of ["expense_entries", "expense_categories"]) expect(await rls(t)).toBe(true);
});

it("없는 표는 만들지 않고 건너뛴다", async () => {
  expect(await rls("expense_recurring_rules")).toBeUndefined();
});

it("공개 역할(anon) 권한이 회수된다", async () => {
  const r = await db.query("select has_table_privilege('anon', 'public.expense_entries', 'select') as ok");
  expect((r.rows[0] as { ok: boolean }).ok).toBe(false);
});

it("주인 연결(앱)은 그대로 읽고 쓴다(FORCE 없음)", async () => {
  await db.exec("insert into expense_entries values('e2','synthetic',2000)");
  const r = await db.query("select count(*)::int as n from expense_entries");
  expect((r.rows[0] as { n: number }).n).toBe(2);
  const forced = await db.query("select relforcerowsecurity as f from pg_class where relname='expense_entries'");
  expect((forced.rows[0] as { f: boolean }).f).toBe(false);
});
