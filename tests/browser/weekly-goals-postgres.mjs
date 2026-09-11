// Disposable embedded PostgreSQL (PGlite), real repository SQL. No production connection or data.
// QA_TOOLS_DIR: external tooling install containing @electric-sql/pglite.
import { createRequire } from "node:module";
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import assert from "node:assert/strict";
const tools = createRequire(resolve(process.env.QA_TOOLS_DIR, "package.json"));
const { PGlite } = tools("@electric-sql/pglite");
const db = new PGlite();
const dir = mkdtempSync(join(tmpdir(), "weekly-goals-pg-"));
globalThis.__goalDb = { query: async (sql, params) => {
  const r = await db.query(sql, params);
  return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
} };
try {
  const sql = readFileSync("lib/repo/db/migrations/0005_weekly_goals.sql", "utf8");
  await db.exec(sql);
  await db.exec(sql); // additive migration replay does not drop records/schema
  await build({ entryPoints: ["lib/repo/db/weekly-goals.ts"], bundle: true, platform: "node", format: "esm",
    outfile: join(dir, "repo.mjs"), plugins: [{ name: "isolated-pool", setup(b) {
      b.onResolve({ filter: /^\.\/client$/ }, () => ({ path: "pool", namespace: "fixture" }));
      b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const dbEnabled=()=>true; export const getDbPool=()=>globalThis.__goalDb;", loader: "js" }));
    }}] });
  const repo = await import(pathToFileURL(join(dir, "repo.mjs")));
  const key = { email: "fixture@example.invalid", cohort: "test", courseStart: "2026-09-07", weekStart: "2026-09-04" };
  const data = { goals: { production: null, inflow: 0, contacts: 1, meetings: 2, contracts: 3 }, task: "line1\n<script>test</script>", revision: 0 };
  const first = await Promise.all([repo.saveWeeklyGoal(key, data), repo.saveWeeklyGoal(key, data)]);
  assert.deepEqual(first.sort(), [false, true]);
  let saved = await repo.readWeeklyGoal(key);
  assert.deepEqual(saved.goals, data.goals);
  assert.equal(saved.task, data.task);
  assert.equal(saved.revision, 1);
  const second = await Promise.all([repo.saveWeeklyGoal(key, { ...data, revision: 1, task: "A" }), repo.saveWeeklyGoal(key, { ...data, revision: 1, task: "B" })]);
  assert.deepEqual(second.sort(), [false, true]);
  saved = await repo.readWeeklyGoal(key);
  assert.equal(saved.revision, 2);
  assert.equal(await repo.saveWeeklyGoal(key, data), false);
  for (const other of [{ email: "other@example.invalid" }, { cohort: "other" }, { courseStart: "2026-09-08" }, { weekStart: "2026-09-11" }]) {
    assert.equal((await repo.readWeeklyGoal({ ...key, ...other })).revision, 0);
  }
  const notes = { specialNotes: "PRIVATE", priorOutcome: "PRIOR", revision: 0 };
  assert.equal(await repo.saveWeeklyGoalPrivate(key, notes), true);
  assert.equal(await repo.saveWeeklyGoalPrivate(key, notes), false);
  assert.equal((await repo.readWeeklyGoalPrivate(key)).specialNotes, "PRIVATE");
  assert.equal(JSON.stringify(await repo.readWeeklyGoal(key)).includes("PRIVATE"), false);
  await assert.rejects(db.query("update weekly_goals set production=-1"), /check constraint/);
  await db.exec("create role fixture_anon; set role fixture_anon");
  await assert.rejects(db.query("select * from weekly_goal_private"), /permission denied/);
  await assert.rejects(db.query("select * from weekly_goals"), /permission denied/);
  await db.exec("reset role");
  mkdirSync("docs/qa/weekly-goals-evidence", { recursive: true });
  console.log(JSON.stringify({ database: "disposable embedded PostgreSQL", migration: "0005_weekly_goals.sql", assertions: 18, result: "PASS", productionApplied: false }));
  writeFileSync("docs/qa/weekly-goals-evidence/postgres-result.json", JSON.stringify({ assertions: 18, result: "PASS", productionApplied: false }, null, 2));
} finally { await db.close(); delete globalThis.__goalDb; }
