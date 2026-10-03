import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { repairHistoryAcl } from "../../scripts/ops/weekly-goals-history-repair.mjs";
import { inspectRuntimeDatabase } from "../../scripts/ops/weekly-goals-runtime.mjs";
const qa = process.env.QA_TOOLS_DIR;
const PGlite = qa ? createRequire(resolve(qa, "package.json"))("@electric-sql/pglite").PGlite : null;
type Client = { query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> };
const setup = `create role anon; create role authenticated; create role service_role;
  create table schema_migrations(version text primary key,checksum text not null,applied_at timestamptz not null default now());
  insert into schema_migrations values ('fixture.sql','fixture-original',now());
  grant all on schema_migrations to anon,authenticated;
  grant select,insert,update on schema_migrations to service_role;`;
describe.skipIf(!PGlite)("approved history ACL repair (disposable database only)", () => {
  async function run(test: (db: Client & { exec(s: string): Promise<void> }, client: Client, calls: string[]) => Promise<void>) {
    const db = new PGlite();
    const calls: string[] = [];
    const client = { query: async (sql: string, p?: unknown[]) => { calls.push(sql); return db.query(sql,p); } };
    try { await db.exec(setup); await test(db,client,calls); } finally { await db.close(); }
  }
  it("revokes only two browser ACLs, preserves ledger/service, and is idempotent", async () => run(async (db,c,calls) => {
    const before = await db.query("select * from schema_migrations");
    const result = await repairHistoryAcl(c, async () => {});
    expect(result).toMatchObject({ mode: "HISTORY_ACL_REPAIRED", ledgerCount: 1, ledgerDigestMatches: true,
      ownerServiceServerPermissionsPreserved: true, browserEffectiveAccess: false });
    expect((await db.query("select * from schema_migrations")).rows).toEqual(before.rows);
    expect((await db.query("select has_table_privilege('service_role','schema_migrations','SELECT,INSERT,UPDATE') as ok")).rows[0]?.ok).toBe(true);
    expect(calls.filter(s => /^revoke/i.test(s))).toEqual(["revoke all privileges on table public.schema_migrations from anon, authenticated restrict"]);
    expect(calls.some(s => /\b(cascade|alter|drop|create|insert into|update public|delete from)\b/i.test(s))).toBe(false);
    expect(calls.indexOf("select pg_advisory_xact_lock($1)")).toBeGreaterThan(calls.findIndex(s => s.startsWith("set local statement")));
    expect((await repairHistoryAcl(c, async () => {})).mode).toBe("HISTORY_ACL_ALREADY_SAFE");
  }),30000);
  it.each([
    "grant select on schema_migrations to public",
    "create role fixture_unknown; grant select on schema_migrations to fixture_unknown",
    "grant update(checksum) on schema_migrations to anon",
    "alter table schema_migrations enable row level security",
    "grant service_role to anon",
  ])("rolls back unknown scope or residual inherited access: %s", async change => run(async (db,c,calls) => {
    await db.exec(change);
    const before = (await db.query("select relacl::text from pg_class where oid='schema_migrations'::regclass")).rows;
    await expect(repairHistoryAcl(c,async () => {})).rejects.toThrow();
    expect(calls.at(-1)).toBe("rollback");
    expect((await db.query("select relacl::text from pg_class where oid='schema_migrations'::regclass")).rows).toEqual(before);
  }),30000);
  it("runtime changed after revoke rolls back, including browser ACL", async () => run(async (db,c,calls) => {
    let count = 0;
    await expect(repairHistoryAcl(c,async () => { if (++count === 2) throw new Error("fixture changed"); })).rejects.toThrow();
    expect(calls.at(-1)).toBe("rollback");
    expect((await db.query("select has_table_privilege('anon','schema_migrations','SELECT') as ok")).rows[0]?.ok).toBe(true);
  }),30000);
  it("ledger mutation detected inside transaction rolls back instead of accepting a new digest", async () => run(async (db,c) => {
    let count = 0;
    await expect(repairHistoryAcl(c,async () => { if (++count === 1) await db.query("update schema_migrations set checksum='fixture-changed'"); })).rejects.toThrow();
    expect((await db.query("select checksum from schema_migrations")).rows).toEqual([{checksum:"fixture-original"}]);
  }),30000);
  it("runtime metadata query is read-only and handles not-yet-created goal tables", async () => run(async (_db,c,calls) => {
    const result = await inspectRuntimeDatabase(c);
    expect(result.permissions).toEqual([
      {table:"schema_migrations",exists:true,select:true,insert:true,update:true,delete:true},
      {table:"weekly_goals",exists:false,select:null,insert:null,update:null,delete:null},
      {table:"weekly_goal_private",exists:false,select:null,insert:null,update:null,delete:null},
    ]);
    expect(calls[0]).toBe("begin read only"); expect(calls.at(-1)).toBe("rollback");
    expect(calls.every(s => /^(select|begin read only|set local|rollback)/.test(s))).toBe(true);
    expect(calls.some(s => /from public.schema_migrations|from weekly_goals|from weekly_goal_private/.test(s))).toBe(false);
  }),30000);
  it("service ACL change during repair aborts and restores the original permissions", async () => run(async (db,c) => {
    let count = 0;
    await expect(repairHistoryAcl(c,async () => {
      if (++count === 1) await db.query("revoke update on schema_migrations from service_role");
    })).rejects.toThrow();
    expect((await db.query("select has_table_privilege('service_role','schema_migrations','UPDATE') as ok")).rows[0]?.ok).toBe(true);
  }),30000);
  it("runtime metadata failure always rolls back", async () => run(async (_db,c,calls) => {
    await expect(inspectRuntimeDatabase({ query: async (s,p) => {
      if(s.startsWith("select current_database")) throw new Error("fixture metadata failure");
      return c.query(s,p);
    } })).rejects.toThrow("fixture metadata failure");
    expect(calls.at(-1)).toBe("rollback");
  }),30000);
});
