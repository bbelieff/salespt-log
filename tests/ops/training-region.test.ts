import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { applyTrainingRegions } from "../../scripts/ops/training-region-data.mjs";
const qa = process.env.QA_TOOLS_DIR;
const PGlite = qa ? createRequire(resolve(qa, "package.json"))("@electric-sql/pglite").PGlite : null;
const row = {keyHash:createHash("sha256").update(["fixture@example.test","99","Fixture","fixture-id"].join("\u001f")).digest("hex"),cohort:"99",region:"서울"};
describe.skipIf(!PGlite)("training region exact-key blank-only update", () => {
  async function run(test: (db: any) => Promise<void>) {
    const db = new PGlite();
    try {
      await db.exec("CREATE TABLE users(email text,cohort text,name text,spreadsheet_id text,role text,team text,assigned_trainer text); INSERT INTO users VALUES ('fixture@example.test','99','Fixture','fixture-id','trainee','','preserved'),('fixture@example.test','98','Fixture','old-id','trainee','','old-trainer')");
      const client = {query: async (s: string,p?: unknown[]) => {const r=await db.query(s,p);return {...r,rowCount:/^SELECT/i.test(s) ? r.rows.length : r.affectedRows};}};
      await test({db,client});
    } finally { await db.close(); }
  }
  it("dry run does not change any fields", async () => run(async ({db,client}) => {
    const before = (await db.query("SELECT * FROM users")).rows;
    expect(await applyTrainingRegions(client,[row])).toMatchObject({blank:1,changed:0});
    expect((await db.query("SELECT * FROM users")).rows).toEqual(before);
  }),30000);
  it("changes only region on the exact enrollment, and repeat is idempotent", async () => run(async ({db,client}) => {
    const before = (await db.query("SELECT * FROM users ORDER BY cohort")).rows;
    expect(await applyTrainingRegions(client,[row],true)).toMatchObject({changed:1});
    const after = (await db.query("SELECT * FROM users ORDER BY cohort")).rows;
    expect(after).toEqual([before[0],{...before[1],team:"서울"}]);
    expect(await applyTrainingRegions(client,[row],true)).toMatchObject({changed:0,already:1});
  }),30000);
  it("refuses existing region conflict", async () => run(async ({db,client}) => {
    await db.exec("UPDATE users SET team='부산'");
    await expect(applyTrainingRegions(client,[row],true)).rejects.toThrow("EXISTING_REGION_CONFLICT");
  }),30000);
  it("refuses wrong sheet or missing enrollment", async () => run(async ({client}) => {
    await expect(applyTrainingRegions(client,[{...row,keyHash:"0".repeat(64)}],true)).rejects.toThrow("REGISTRY_IDENTITY_MISMATCH");
  }),30000);
});
