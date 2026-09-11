// Private input file: SHA-256 opaque registry keys + confirmed Notion baseline region, never committed.
// Region only; no insert/delete/role/assignment/date changes. Default is read-only.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { Pool } from "pg";
import { applyTrainingRegions } from "./training-region-data.mjs";
const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
const args = process.argv.slice(2);
const input = args[0], config = args[1];
if (!input || !config) throw new Error("Expected private input path and existing app config directory");
loadEnvConfig(resolve(config), false, { info() {}, error() {} });
let rows;
try { rows = JSON.parse(readFileSync(input, "utf8")); } catch { console.error("INVALID_PRIVATE_INPUT"); process.exit(1); }
if (!Array.isArray(rows) || !rows.length || rows.length > 200) throw new Error("Invalid input size");
const seen = new Set();
for (const r of rows) {
  if (!["서울", "부산"].includes(r.region) || !/^[0-9]+(?:기)?$/.test(r.cohort) || !/^[a-f0-9]{64}$/.test(r.keyHash) || r.before !== "") throw new Error("Invalid confirmed region input");
  const key = r.keyHash;
  if (seen.has(key)) throw new Error("Duplicate registry key");
  seen.add(key);
}
if (!process.env.DATABASE_URL) { console.error("DATABASE_CONFIGURATION_UNAVAILABLE"); process.exit(1); }
// Match the existing Supabase Session Pooler transport in repo/db/client.ts and migration tooling.
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1, connectionTimeoutMillis: 10000 });
let client;
try {
  client = await pool.connect();
  await client.query(args.includes("--execute") ? "BEGIN" : "BEGIN READ ONLY");
  await client.query("SET LOCAL statement_timeout = '10s'");
  await client.query("SET LOCAL lock_timeout = '3s'");
  const result = await applyTrainingRegions(client, rows, args.includes("--execute"));
  await client.query(args.includes("--execute") ? "COMMIT" : "ROLLBACK");
  console.log(JSON.stringify(result));
} catch (e) {
  await client?.query("ROLLBACK").catch(() => {});
  const safe = ["REGISTRY_IDENTITY_MISMATCH", "EXISTING_REGION_CONFLICT", "CONCURRENT_REGION_CHANGE"];
  console.error(safe.includes(e.message) ? e.message : "REGION_OPERATION_FAILED_NO_DETAILS");
  process.exitCode = 1;
} finally { client?.release(); await pool.end(); }
