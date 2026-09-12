// Isolated PostgreSQL only. The production client is replaced before importing any module.
import { createRequire } from "node:module";
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { build } from "esbuild";
const requireTools = createRequire(resolve(process.env.QA_TOOLS_DIR, "package.json"));
const { PGlite } = requireTools("@electric-sql/pglite");
const db = new PGlite();
const dir = mkdtempSync(join(tmpdir(), "trainer-access-pg-"));
const output = resolve(process.env.QA_OUTPUT_DIR || "docs/qa/trainer-access-settings"); mkdirSync(output, { recursive: true });
let tail = Promise.resolve();
const query = async (sql, params) => { const r = await db.query(sql, params); return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length }; };
globalThis.__accessPool = {
  query,
  connect: async () => {
    const previous = tail; let release; tail = new Promise(r => { release = r; }); await previous;
    return { query, release };
  },
};
globalThis.__accessActor = "admin@example.test";
let assertions = 0;
function equal(actual, expected) { assertions++; assert.deepEqual(actual, expected); }
async function rejects(fn, matcher) { assertions++; await assert.rejects(fn, matcher); }
try {
  // Only synthetic qualification contract, never an operational #956 migration execution.
  await db.exec(`create table public.trainer_qualifications (email text primary key, name text not null, status text not null);
    create role anon; create role authenticated;
    insert into public.trainer_qualifications values ('one@example.test','동명이인','active'),
      ('two@example.test','동명이인','active'), ('pending@example.test','신청자','pending');`);
  await db.exec(readFileSync("lib/repo/db/migrations/0007_trainer_access.sql", "utf8"));
  await build({ stdin: { contents: 'export * from "@/service/trainer-access-settings"; export * from "@/service/trainer-student-access"; export { withTrainerAccessLock } from "@/repo/db/trainer-access-settings";', resolveDir: process.cwd(), loader: "ts" }, bundle: true, platform: "node", format: "esm", outfile: join(dir, "service.mjs"),
    plugins: [{ name: "isolated-access", setup(b) {
      // Negative control runs only in this disposable bundle; shipping source stays byte-identical.
      if (process.env.QA_ACCESS_MUTATION) b.onLoad({ filter: /lib[\\/]service[\\/]trainer-access-settings\.ts$/ }, args => {
        const source = readFileSync(args.path, "utf8");
        const mutation = process.env.QA_ACCESS_MUTATION;
        const contents = mutation === "allow-nonadmin" ? source.replace('!email || !isAdminEmail(email)', '!email')
          : mutation === "force-grade-reset" ? source.replace('tx.save(input, actor)', 'tx.save({ ...input, grants: defaultTrainerGrants(input.grade) }, actor)') : source;
        assert.notEqual(contents, source, "The negative control must modify its specific guard");
        return { contents, loader: "ts", resolveDir: resolve("lib/service") };
      });
      b.onResolve({ filter: /^\.\/client$/ }, () => ({ path: "pool", namespace: "fixture" }));
      b.onResolve({ filter: /^@\/auth\/identity$/ }, () => ({ path: "identity", namespace: "fixture" }));
      b.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: args.path === "pool"
        ? "export const dbEnabled=()=>true; export const getDbPool=()=>globalThis.__accessPool;"
        : "export const getSessionEmail=async()=>globalThis.__accessActor; export const isAdminEmail=e=>e==='admin@example.test';", loader: "js" }));
    } }] });
  const service = await import(pathToFileURL(join(dir, "service.mjs")));
  const grants = grade => ({ active: { read: true, write: true }, arena: { read: grade === "senior", write: grade === "senior" }, archived: { read: grade === "senior", write: grade === "senior" } });
  const command = (version, grade = "senior", email = "one@example.test") => ({ email, grade, grants: grants(grade), version });
  equal((await service.listTrainerAccessSettings()).map(p => [p.email, p.grade, p.version]), [["one@example.test", null, 0], ["two@example.test", null, 0]]);
  globalThis.__accessActor = "viewer@example.test";
  await rejects(() => service.saveTrainerAccessSettings(command(0)), e => e.status === 403);
  globalThis.__accessActor = "admin@example.test";
  await rejects(() => service.saveTrainerAccessSettings(command(0, "regular", "pending@example.test")), e => e.status === 403);
  await service.saveTrainerAccessSettings(command(0));
  let people = await service.listTrainerAccessSettings(); equal(people[0].version, 1); equal(people[1].grade, null);
  const readOnly = command(1); readOnly.grants.arena.write = false;
  await service.saveTrainerAccessSettings(readOnly); equal((await service.listTrainerAccessSettings())[0].grants.arena, { read: true, write: false });
  const concurrent = await Promise.allSettled([service.saveTrainerAccessSettings(command(2)), service.saveTrainerAccessSettings(command(2))]);
  equal(concurrent.filter(r => r.status === "fulfilled").length, 1);
  equal(concurrent.find(r => r.status === "rejected").reason.status, 409);
  const downgrade = command(3, "regular"); downgrade.grants.active = { read: false, write: false };
  await service.saveTrainerAccessSettings(downgrade); people = await service.listTrainerAccessSettings(); equal(people[0].grants, downgrade.grants);
  equal(people[0].version, 4);
  equal((await db.query("select version, changed_by from trainer_access_audit order by version")).rows,
    [1, 2, 3, 4].map(version => ({ version, changed_by: "admin@example.test" })));
  // Exercise SQL CAS directly as well, so the service pre-check cannot hide a broken query.
  equal(await service.withTrainerAccessLock("one@example.test", tx => tx.save(command(3, "regular"), "admin@example.test")), false);
  equal(await service.withTrainerAccessLock("one@example.test", tx => tx.save(command(0, "regular"), "admin@example.test")), false);
  equal((await db.query("select count(*)::int as count from trainer_access_audit")).rows[0].count, 4);
  // A failed audit insert must roll back the settings update in the same transaction.
  await db.exec("alter table trainer_access_audit add constraint fixture_audit_failure check(version <> 5)");
  await rejects(() => service.withTrainerAccessLock("one@example.test", tx => tx.save(command(4, "regular"), "admin@example.test")), /check constraint/);
  equal((await service.listTrainerAccessSettings())[0].version, 4);
  await db.exec("alter table trainer_access_audit drop constraint fixture_audit_failure");
  // Direct DB corruption attempts: null/partial/extra/string/write-without-read/ceiling/grade/version.
  const invalidGrants = [null, {}, { ...grants("regular"), extra: false }, { ...grants("regular"), active: { read: "true", write: false } },
    { ...grants("regular"), active: { read: null, write: false } }, { ...grants("regular"), active: { read: false, write: true } }, grants("senior")];
  for (const value of invalidGrants) await rejects(() => db.query("update trainer_access_settings set grants=$1::jsonb", [JSON.stringify(value)]), /check constraint/);
  await rejects(() => db.query("update trainer_access_settings set grade='unknown'"), /check constraint/);
  await rejects(() => db.query("update trainer_access_settings set version=0"), /check constraint/);
  await db.exec("update trainer_qualifications set status='revoked' where email='one@example.test'");
  await rejects(() => service.saveTrainerAccessSettings(command(4)), e => e.status === 403);
  equal((await service.listTrainerAccessSettings()).length, 1);
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    for (const table of ["trainer_access_settings", "trainer_access_audit"]) {
      for (const sql of [`select * from ${table}`, `delete from ${table}`, `update ${table} set grade='senior'`, `insert into ${table} (email) values ('attacker@example.test')`]) await rejects(() => db.query(sql), /permission denied/);
    }
    await db.exec("reset role");
  }
  equal((await db.query("select relname, relrowsecurity from pg_class where relname in ('trainer_access_settings','trainer_access_audit') order by relname")).rows,
    [{ relname: "trainer_access_audit", relrowsecurity: true }, { relname: "trainer_access_settings", relrowsecurity: true }]);
  // Execute the real central read-only SQL against isolated raw fixtures (no registry migration).
  await db.exec(`create table public.users (email text, role text, status text, cohort text, cohort_label text, spreadsheet_id text, course_start_iso text);
    create table public.cohorts (label text, status text, type text);
    insert into users values ('student@example.test','trainee','active','8','8기','selected-sheet','2026-09-04');
    insert into cohorts values ('8','active','cohort');`);
  await service.saveTrainerAccessSettings(command(0, "regular", "two@example.test"));
  equal(await service.canAccessManagedStudent("two@example.test", "student@example.test", "read"), true);
  equal(await service.canAccessManagedStudent("two@example.test", "student@example.test", "write"), true);
  const restricted = command(1, "regular", "two@example.test"); restricted.grants.active.write = false;
  await service.saveTrainerAccessSettings(restricted);
  equal(await service.canAccessManagedStudent("two@example.test", "student@example.test", "read"), true);
  equal(await service.canAccessManagedStudent("two@example.test", "student@example.test", "write"), false);
  await db.exec("update cohorts set status='archived'");
  equal(await service.canAccessManagedStudent("two@example.test", "student@example.test", "read"), false);
  await db.exec("update cohorts set status='active'; insert into cohorts values ('7','archived','cohort'); insert into users values ('student@example.test','trainee','archived','7','7기','prior-sheet','2025-01-01')");
  equal(await service.canAccessManagedStudent("two@example.test", "student@example.test", "read"), false);
  const selected = { email: "student@example.test", spreadsheetId: "selected-sheet", cohort: "8", courseStart: "2026-09-04" };
  equal(await service.canAccessManagedStudent("two@example.test", selected, "read"), true);
  equal(await service.canAccessManagedStudent("two@example.test", selected, "write"), false);
  equal(await service.canAccessManagedStudent("two@example.test", { ...selected, spreadsheetId: "prior-sheet", cohort: "7", courseStart: "2025-01-01" }, "read"), false);
  equal(await service.canAccessManagedStudent("two@example.test", { ...selected, spreadsheetId: "stale-sheet" }, "read"), false);
  await db.exec("update trainer_qualifications set status='revoked' where email='two@example.test'");
  equal(await service.canAccessManagedStudent("two@example.test", selected, "read"), false);
  const result = { result: "PASS", assertions, engine: "PGlite PostgreSQL", syntheticOnly: true,
    concurrency: "overlapping calls serialized by fixture connection lease; real SQL CAS and transaction tested; multi-connection row-lock timing NOT_RUN" };
  writeFileSync(join(output, "postgres-result.json"), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} finally { await db.close(); delete globalThis.__accessPool; delete globalThis.__accessActor; rmSync(dir, { recursive: true, force: true }); }
