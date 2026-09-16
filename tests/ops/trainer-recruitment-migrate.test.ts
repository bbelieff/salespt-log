import { describe,it,expect } from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {preflight,executeExact,VERSION,EXPECTED_CHECKSUM,parseArgs,pinnedMigration} from "../../scripts/ops/trainer-recruitment-migrate.mjs";
const sql=readFileSync(`lib/repo/db/migrations/${VERSION}`,"utf8");
const files=[{version:VERSION,sql,checksum:createHash("sha256").update(sql).digest("hex")}];
describe("exact-only trainer migration",()=>{
 it("pins exact bytes, defaults read-only, rejects broad/unknown switches",()=>{
  expect(files[0]!.checksum).toBe(EXPECTED_CHECKSUM);expect(parseArgs([])).toEqual({execute:false});
  expect(()=>parseArgs(["--all"])).toThrow();expect(()=>pinnedMigration([{...files[0],sql:sql+"--tampered"}])).toThrow();
 });
 it("read-only preflight creates nothing, exact apply ignores unrelated pending, repeat no-op",async()=>{
  const db=new PGlite();
  await db.exec("create role anon; create role authenticated");
  const client={query:async(q:string,params?:unknown[])=>q.includes("create table public.trainer_qualifications") ? db.exec(q) : db.query(q,params)};
  const inventory=[...files,{version:"9999_unrelated.sql",sql:"select 1",checksum:"unrelated"}];
  const report=await preflight(client,inventory);
  expect(report.mode).toBe("PREFLIGHT_READ_ONLY");
  expect((await db.query("select to_regclass('public.schema_migrations') as value")).rows[0]).toEqual({value:null});
  const applied=await executeExact(client,inventory);
  expect(applied.mode).toBe("APPLIED_EXACT_ONLY");expect(applied.pending).toEqual(["9999_unrelated.sql"]);
  expect(applied.catalog.every((t:any)=>t.rls&&t.serverCanStore)).toBe(true);
  expect((await executeExact(client,inventory)).mode).toBe("NO_OP");
  await db.close();
 });
 it("untracked target objects are rejected, not repaired or adopted",async()=>{
  const db=new PGlite();await db.exec("create table trainer_qualifications(email text)");
  await expect(preflight(db,files)).rejects.toThrow("UNTRACKED_TARGET_RELATION");await db.close();
 });
});
