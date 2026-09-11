#!/usr/bin/env node
// Exact-only #947 runner. CLI defaults to a genuinely read-only catalog preflight.
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMigrationFiles, resolveDatabaseUrl } from "../db-migrate.mjs";
import { assertRelation, inspectState, MigrationGateError, TARGETS } from "./weekly-goals-migrate-catalog.mjs";

export const VERSION = "0005_weekly_goals.sql";
export const EXPECTED_CHECKSUM = "144b15924b59f0ebb757482540752154d48068207f9c905a51293986b2eb4831";
export const LOCK_KEY = 786569;
const fail = (code) => { throw new MigrationGateError(code); };

export function parseArgs(args) {
  if (args.length === 0 || (args.length === 1 && args[0] === "--preflight")) return { execute: false };
  if (args.length === 1 && args[0] === "--execute") return { execute: true };
  fail("INVALID_ARGUMENTS_USE_PREFLIGHT_OR_EXECUTE");
}

export function pinnedMigration(files) {
  const matches = files.filter((f) => f.version === VERSION);
  if (matches.length !== 1) fail("EXACT_MIGRATION_MISSING_OR_DUPLICATED");
  const file = matches[0];
  const rawHash = createHash("sha256").update(file.sql).digest("hex");
  if (file.checksum !== EXPECTED_CHECKSUM || rawHash !== EXPECTED_CHECKSUM) fail("SQL_CHECKSUM_NOT_APPROVED");
  return file;
}

function summarize(state, files) {
  const applied = new Map(state.applied.map((r) => [r.version, r.checksum]));
  const drift = files.filter((f) => applied.has(f.version) && applied.get(f.version) !== f.checksum);
  if (drift.length) fail("APPLIED_HISTORY_CHECKSUM_MISMATCH");
  const targetHistory = state.applied.find((r) => r.version === VERSION);
  if (targetHistory && targetHistory.checksum !== EXPECTED_CHECKSUM) fail("EXACT_HISTORY_CHECKSUM_MISMATCH");
  if (targetHistory) {
    for (const name of TARGETS) assertRelation(name, state.targets[name]);
  } else if (TARGETS.some((name) => state.targets[name])) fail("UNTRACKED_TARGET_RELATION");
  return {
    version: VERSION, checksum: EXPECTED_CHECKSUM, historyExists: state.historyExists,
    applied: state.applied.map(({ version, checksum, applied_at }) => ({ version, checksum, appliedAt: applied_at })),
    pending: files.filter((f) => !applied.has(f.version)).map((f) => f.version),
    exactStatus: targetHistory ? "ALREADY_APPLIED" : "READY_TO_APPLY_EXACT_ONLY",
    exactAppliedAt: targetHistory?.applied_at ?? null,
    catalog: TARGETS.map((name) => ({ table: name, exists: !!state.targets[name],
      verified: !!targetHistory, rls: state.targets[name]?.rls ?? null,
      policies: state.targets[name]?.policies ?? null, browserAccess: state.targets[name]?.browser ?? [],
      serverCanStore: targetHistory ? state.targets[name].server_rls_bypass && state.targets[name].server_dml : null })),
  };
}

export async function preflight(client, files) {
  pinnedMigration(files); // local artifact gate, before any connection query
  await client.query("begin read only");
  try {
    const report = summarize(await inspectState(client), files);
    await client.query("rollback");
    return { mode: "PREFLIGHT_READ_ONLY", observedAt: new Date().toISOString(), ...report };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  }
}

export async function executeExact(client, files) {
  const file = pinnedMigration(files);
  await client.query("select pg_advisory_lock($1)", [LOCK_KEY]);
  try {
    await client.query("begin");
    try {
      // Pin schema resolution and check again under the existing runner's shared lock.
      await client.query("set local search_path = pg_catalog, public");
      await client.query("set local lock_timeout = '10s'");
      await client.query("set local statement_timeout = '60s'");
      const state = await inspectState(client);
      const before = summarize(state, files);
      if (before.exactStatus === "ALREADY_APPLIED") {
        await client.query("rollback");
        return { mode: "NO_OP", observedAt: new Date().toISOString(), ...before };
      }
      if (!state.historyExists) await client.query(`create table public.schema_migrations (
        version text primary key, checksum text not null, applied_at timestamptz not null default now())`);
      await client.query(file.sql);
      await client.query("insert into public.schema_migrations (version, checksum) values ($1, $2)", [VERSION, file.checksum]);
      const report = summarize(await inspectState(client), files);
      await client.query("commit");
      return { mode: "APPLIED_EXACT_ONLY", observedAt: new Date().toISOString(), ...report };
    } catch (error) {
      await client.query("rollback").catch(() => {});
      throw error;
    }
  } finally {
    await client.query("select pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
  }
}

export async function main(args = process.argv.slice(2)) {
  const { execute } = parseArgs(args);
  const files = await loadMigrationFiles();
  pinnedMigration(files);
  const databaseUrl = resolveDatabaseUrl(); // established resolver: no shell export, no CLI credential argument
  if (!databaseUrl) fail("DATABASE_URL_NOT_CONFIGURED");
  const { Client } = await import("pg");
  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    return execute ? await executeExact(client, files) : await preflight(client, files);
  } finally { await client.end().catch(() => {}); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((report) => console.log(JSON.stringify(report, null, 2))).catch((error) => {
    // Driver error messages/details may contain connection or data values. Never print them.
    console.error(error instanceof MigrationGateError ? error.message : "[weekly-goals-migrate] DATABASE_OR_IO_FAILURE_DETAILS_WITHHELD");
    process.exitCode = 1;
  });
}
