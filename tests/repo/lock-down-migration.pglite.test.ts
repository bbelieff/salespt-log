/** 0019 — 서버 전용 표 잠그기: 두 번 돌려도 안전, 없는 표는 건너뜀, 있는 표는 RLS 켜짐, 주인 연결은 그대로 읽는다. 가상 값만. */
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";

let db: PGlite;
const sql = readFileSync("lib/repo/db/migrations/0019_lock_down_server_only_tables.sql", "utf8");
beforeAll(async () => {
  db = new PGlite();
  // 실행 중에 만들어지던 표 몇 개만 흉내(나머지는 없는 상태 — to_regclass 로 건너뛰어야 한다).
  await db.exec("create table sheet_rows(spreadsheet_id text, tab text, row_key text, payload jsonb, primary key(spreadsheet_id,tab,row_key))");
  await db.exec("create table public.push_subscriptions(endpoint text primary key, email text)");
  await db.exec("insert into sheet_rows values('lock-synthetic','daily','r1','{}')");
  await db.exec(sql);
  await db.exec(sql);
}, 60000);
afterAll(async () => { await db?.close(); });

const rls = async (t: string) => ((await db.query("select relrowsecurity as on from pg_class where relname=$1", [t])).rows[0] as { on: boolean } | undefined)?.on;

it("있는 표와 보관함 두 표는 RLS 가 켜진다", async () => {
  for (const t of ["sheet_rows", "push_subscriptions", "company_vault", "vault_pins"]) expect(await rls(t)).toBe(true);
});

it("없는 표는 만들지 않고 건너뛴다", async () => {
  expect(await rls("gcal_tokens")).toBeUndefined();
  expect(await rls("bug_reports")).toBeUndefined();
});

it("주인 연결은 RLS 를 우회해 데이터를 그대로 읽는다(FORCE 없음)", async () => {
  const r = await db.query("select count(*)::int as n from sheet_rows");
  expect((r.rows[0] as { n: number }).n).toBe(1);
  const forced = await db.query("select relforcerowsecurity as f from pg_class where relname='sheet_rows'");
  expect((forced.rows[0] as { f: boolean }).f).toBe(false);
});
