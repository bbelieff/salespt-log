import { beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { loadMigrationFiles } from "../../scripts/db-migrate.mjs";
import { EXPECTED_CHECKSUM, VERSION, executeExact, parseArgs, pinnedMigration, preflight } from "../../scripts/ops/weekly-goals-migrate.mjs";

type File = { version: string; sql: string; checksum: string };
type Result = { rows: Record<string, unknown>[] };
type Db = { query: (sql: string, params?: unknown[]) => Promise<Result>; exec: (sql: string) => Promise<unknown>; close: () => Promise<void> };
let files: File[];
beforeAll(async () => { files = await loadMigrationFiles(); });

describe("weekly-goals exact migration artifact (no connection)", () => {
  it("pins exact immutable bytes rather than trusting supplied checksum", () => {
    expect(pinnedMigration(files).checksum).toBe(EXPECTED_CHECKSUM);
    const changed = files.map((f) => f.version === VERSION ? { ...f, sql: f.sql + "\n" } : f);
    expect(() => pinnedMigration(changed)).toThrow("SQL_CHECKSUM_NOT_APPROVED");
  });
  it("rejects missing/duplicate exact filename", () => {
    expect(() => pinnedMigration([])).toThrow("EXACT_MIGRATION_MISSING_OR_DUPLICATED");
    expect(() => pinnedMigration([...files, pinnedMigration(files)])).toThrow("EXACT_MIGRATION_MISSING_OR_DUPLICATED");
  });
  it("defaults to preflight and recognizes only the two explicit modes", () => {
    expect(parseArgs([])).toEqual({ execute: false });
    expect(parseArgs(["--preflight"])).toEqual({ execute: false });
    expect(parseArgs(["--execute"])).toEqual({ execute: true });
  });
  it.each([["--only", VERSION], ["--version", VERSION], ["--dry-run"], ["--execute", "--preflight"], ["--execute", "--execute"]])(
    "rejects unknown/conflicting arguments %j before connection", (...args) => {
      expect(() => parseArgs(args)).toThrow("INVALID_ARGUMENTS");
    });
  it("preflight uses BEGIN READ ONLY and no DDL/DML/advisory lock with absent history", async () => {
    const calls: string[] = [];
    const client = { query: async (sql: string) => { calls.push(sql); return { rows: [] }; } };
    const report = await preflight(client, files);
    expect(report.historyExists).toBe(false);
    expect(report.pending).toContain(VERSION);
    expect(calls[0]).toBe("begin read only");
    expect(calls.at(-1)).toBe("rollback");
    expect(calls.every((sql) => /^(select|begin read only|rollback)\b/i.test(sql))).toBe(true);
    expect(calls.some((sql) => /advisory_lock|create table|insert into|update public|delete from/i.test(sql))).toBe(false);
    expect(calls.filter((sql) => sql.includes("to_regclass")).length).toBe(3);
  });
  it("preflight always rolls back on catalog failure", async () => {
    const calls: string[] = [];
    const client = { query: async (sql: string) => {
      calls.push(sql);
      if (sql.startsWith("select")) throw new Error("fixture catalog failure");
      return { rows: [] };
    } };
    await expect(preflight(client, files)).rejects.toThrow("fixture catalog failure");
    expect(calls.at(-1)).toBe("rollback");
  });
});

// Optional external QA tool installation; never connects to DATABASE_URL or installs a production dependency.
const qaDir = process.env.QA_TOOLS_DIR;
const PGlite = qaDir ? createRequire(resolve(qaDir, "package.json"))("@electric-sql/pglite").PGlite : null;
const integration = describe.skipIf(!PGlite);
const extra: File = { version: "0004_fixture_pending.sql", sql: "create table must_not_apply (id int)", checksum: "fixture-pending" };
async function fixture(run: (db: Db, client: Db, calls: string[]) => Promise<void>) {
  const db: Db = new PGlite();
  const calls: string[] = [];
  // PGlite extended query accepts one command only; exec supports the real multi-statement SQL file.
  const client: Db = { ...db, query: async (sql, params) => {
    calls.push(sql);
    if (sql === pinnedMigration(files).sql) { await db.exec(sql); return { rows: [] }; }
    return db.query(sql, params);
  }, exec: db.exec.bind(db), close: db.close.bind(db) };
  try { await run(db, client, calls); } finally { await db.close(); }
}

integration("weekly-goals disposable PostgreSQL exact runner (no operational DB)", () => {
  it("absent history preflight creates nothing; exact apply creates only two target tables plus standard history", async () => fixture(async (db, client, calls) => {
    const report = await preflight(client, [...files, extra]);
    expect(report.historyExists).toBe(false);
    expect((await db.query("select to_regclass('public.schema_migrations') as value")).rows[0]?.value).toBeNull();
    calls.length = 0;
    const applied = await executeExact(client, [...files, extra]);
    expect(applied.mode).toBe("APPLIED_EXACT_ONLY");
    expect(applied.exactAppliedAt).toBeTruthy();
    expect(applied.pending).toContain(extra.version);
    expect((await db.query("select version from schema_migrations")).rows).toEqual([{ version: VERSION }]);
    expect((await db.query("select to_regclass('public.must_not_apply') as value")).rows[0]?.value).toBeNull();
    expect(calls[0]).toContain("pg_advisory_lock");
    expect(calls.at(-1)).toContain("pg_advisory_unlock");
    expect(calls.indexOf("commit")).toBeGreaterThan(calls.findIndex((q) => q.startsWith("insert into public.schema_migrations")));
  }), 30000);
  it("same checksum is no-op and preserves stored goal data/history timestamp", async () => fixture(async (db, client, calls) => {
    const first = await executeExact(client, files);
    await db.query("insert into weekly_goals(student_id,cohort,course_start,week_start,task,revision) values ('fixture-sheet','fixture','2026-09-07','2026-09-04','saved',1)");
    calls.length = 0;
    const second = await executeExact(client, files);
    expect(second.mode).toBe("NO_OP");
    expect(second.exactAppliedAt).toEqual(first.exactAppliedAt);
    expect(calls.some((q) => q === pinnedMigration(files).sql || q.startsWith("insert into"))).toBe(false);
    expect((await db.query("select task from weekly_goals")).rows).toEqual([{ task: "saved" }]);
  }), 30000);
  it("revokes inherited direct browser defaults and PUBLIC without changing global defaults", async () => fixture(async (db, client) => {
    await db.exec("create role anon; create role authenticated; alter default privileges in schema public grant all on tables to anon, authenticated, public;");
    await executeExact(client, files);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await expect(db.query("select * from weekly_goals")).rejects.toThrow(/permission denied/);
      await expect(db.query("select * from weekly_goal_private")).rejects.toThrow(/permission denied/);
      await db.exec("reset role");
    }
    await db.exec("create table fixture_default_unchanged(id integer)");
    expect((await db.query("select has_table_privilege('anon','fixture_default_unchanged','SELECT') as allowed")).rows[0]?.allowed).toBe(true);
  }), 30000);
  it("rejects untracked target table without altering it or creating history", async () => fixture(async (db, client) => {
    await db.exec("create table weekly_goals (fixture text)");
    await expect(executeExact(client, files)).rejects.toThrow("UNTRACKED_TARGET_RELATION");
    expect((await db.query("select to_regclass('public.schema_migrations') as value")).rows[0]?.value).toBeNull();
    expect((await db.query("select column_name from information_schema.columns where table_name='weekly_goals'")).rows).toEqual([{ column_name: "fixture" }]);
  }), 30000);
  it("rejects altered applied checksum before changing anything", async () => fixture(async (db, client) => {
    await executeExact(client, files);
    await db.query("update schema_migrations set checksum='fixture-mismatch' where version=$1", [VERSION]);
    await expect(executeExact(client, files)).rejects.toThrow("CHECKSUM_MISMATCH");
  }), 30000);
  it.each([
    ["alter table weekly_goals disable row level security", "UNSAFE_TABLE_SECURITY"],
    ["create policy fixture_read on weekly_goals for select using (true)", "UNSAFE_TABLE_SECURITY"],
    ["grant select on weekly_goal_private to public", "UNSAFE_TABLE_SECURITY"],
    ["alter table weekly_goals add column surprise text", "CONFLICTING_COLUMNS"],
    ["alter table weekly_goals drop constraint weekly_goals_production_check", "CONFLICTING_CONSTRAINTS"],
    ["create unique index fixture_extra_unique on weekly_goals(task)", "CONFLICTING_INDEXES"],
    ["alter table schema_migrations enable row level security", "HISTORY_VISIBILITY_NOT_FULL"],
  ])("rejects tracked catalog drift: %s", async (sql, code) => fixture(async (db, client) => {
    await executeExact(client, files);
    await db.exec(sql);
    await expect(preflight(client, files)).rejects.toThrow(code);
    await expect(executeExact(client, files)).rejects.toThrow(code);
  }), 30000);
  it("inherited browser privilege is refused rather than altering shared role grants", async () => fixture(async (db, client) => {
    await db.exec("create role fixture_parent; create role anon; grant fixture_parent to anon; alter default privileges in schema public grant select on tables to fixture_parent;");
    await expect(executeExact(client, files)).rejects.toThrow("UNSAFE_TABLE_SECURITY");
    expect((await db.query("select to_regclass('public.weekly_goals') as value")).rows[0]?.value).toBeNull();
    expect((await db.query("select pg_has_role('anon','fixture_parent','MEMBER') as member")).rows[0]?.member).toBe(true);
  }), 30000);
  it("SQL and filename history are atomic when history insert fails", async () => fixture(async (db, client) => {
    const broken = { query: async (sql: string, params?: unknown[]) => {
      if (sql.startsWith("insert into public.schema_migrations")) throw new Error("fixture insert failure");
      return client.query(sql, params);
    } };
    await expect(executeExact(broken, files)).rejects.toThrow("fixture insert failure");
    for (const table of ["schema_migrations", "weekly_goals", "weekly_goal_private"]) {
      expect((await db.query("select to_regclass($1) as value", [`public.${table}`])).rows[0]?.value).toBeNull();
    }
  }), 30000);
  it("leaves filename-keyed unrelated history unchanged (duplicate numeric prefixes supported)", async () => fixture(async (db, client) => {
    const unrelated = ["0002_fixture_a.sql", "0002_fixture_b.sql"].map((version) => ({ version, sql: "--fixture", checksum: createHash("sha256").update("--fixture").digest("hex") }));
    await db.exec("create table schema_migrations(version text primary key, checksum text not null, applied_at timestamptz not null default now())");
    for (const f of unrelated) await db.query("insert into schema_migrations(version,checksum) values ($1,$2)", [f.version, f.checksum]);
    const before = (await db.query("select * from schema_migrations order by version")).rows;
    await executeExact(client, [...files, ...unrelated]);
    expect((await db.query("select * from schema_migrations where version<>$1 order by version", [VERSION])).rows).toEqual(before);
  }), 30000);
});
