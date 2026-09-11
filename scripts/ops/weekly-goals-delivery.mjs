#!/usr/bin/env node
// #947 immutable migration-only artifact. No connection or app checkout mutation here.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, lstat, readdir, realpath } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMigrationFiles } from "../db-migrate.mjs";
import { VERSION, EXPECTED_CHECKSUM } from "./weekly-goals-migrate.mjs";

export const PAYLOAD = ["scripts/db-migrate.mjs", "scripts/ops/weekly-goals-migrate.mjs",
  "scripts/ops/weekly-goals-migrate-catalog.mjs", "scripts/ops/weekly-goals-delivery.mjs",
  "scripts/ops/weekly-goals-delivery-run.mjs", `lib/repo/db/migrations/${VERSION}`, "inventory.json"];
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fail = (code) => { throw new Error(`DELIVERY_${code}`); };
const hex = (value, length) => typeof value === "string" && new RegExp(`^[a-f0-9]{${length}}$`).test(value);
export function validateInputs({ sha, actualSha, sqlChecksum, mode, execute, runId, attempt }) {
  if (!hex(sha, 40) || actualSha !== sha) fail("EXPECTED_SHA_MISMATCH");
  if (!hex(sqlChecksum, 64) || sqlChecksum !== EXPECTED_CHECKSUM) fail("SQL_CHECKSUM_MISMATCH");
  if (mode !== VERSION || !["true", "false"].includes(execute)) fail("SCOPE_OR_EXECUTE_INVALID");
  if (![runId, attempt].every((v) => typeof v === "string" && /^[1-9][0-9]*$/.test(v))) fail("RUN_ID_INVALID");
  return `/opt/salespt-migrations/${runId}-${attempt}-${sha}`;
}
export function validateInventory(inventory) {
  if (!Array.isArray(inventory) || !inventory.length) fail("INVENTORY_INVALID");
  const names = new Set();
  for (const item of inventory) {
    if (!item || Object.keys(item).sort().join() !== "checksum,version" ||
      !/^\d{4}_[a-zA-Z0-9_-]+\.sql$/.test(item.version) || !hex(item.checksum, 64) || names.has(item.version)) fail("INVENTORY_INVALID");
    names.add(item.version);
  }
  if (inventory.find((f) => f.version === VERSION)?.checksum !== EXPECTED_CHECKSUM) fail("INVENTORY_TARGET_MISMATCH");
  return inventory;
}
export async function buildArtifact(root, destination, inputs) {
  validateInputs(inputs);
  // Destination must be fresh: never overwrite an earlier run's evidence.
  await mkdir(destination, { recursive: false, mode: 0o700 });
  const migrations = await loadMigrationFiles(join(root, "lib/repo/db/migrations"));
  const inventory = validateInventory(migrations.map(({ version, checksum }) => ({ version, checksum })));
  const files = {};
  for (const name of PAYLOAD) {
    if (name !== "inventory.json") {
      const source = resolve(root, name);
      const stat = await lstat(source);
      if (!stat.isFile() || stat.isSymbolicLink() || await realpath(source) !== source) fail("SOURCE_NOT_REGULAR");
    }
    const bytes = name === "inventory.json" ? Buffer.from(JSON.stringify(inventory, null, 2) + "\n") : await readFile(join(root, name));
    if (name.endsWith(`/${VERSION}`) && sha256(bytes) !== EXPECTED_CHECKSUM) fail("SQL_CHECKSUM_MISMATCH");
    await mkdir(dirname(join(destination, name)), { recursive: true });
    await writeFile(join(destination, name), bytes, { flag: "wx", mode: 0o600 });
    files[name] = sha256(bytes);
  }
  const manifest = Buffer.from(JSON.stringify({ schema: 1, sha: inputs.sha, sqlChecksum: inputs.sqlChecksum, files }, null, 2) + "\n");
  await writeFile(join(destination, "manifest.json"), manifest, { flag: "wx", mode: 0o600 });
  return { manifestChecksum: sha256(manifest), sha: inputs.sha, sqlChecksum: inputs.sqlChecksum, files };
}
async function regularFiles(root, relative = "") {
  const names = [];
  for (const entry of await readdir(join(root, relative))) {
    const name = relative ? `${relative}/${entry}` : entry;
    const stat = await lstat(join(root, name));
    if (stat.isSymbolicLink()) fail("SYMLINK_FORBIDDEN");
    if (stat.isDirectory()) names.push(...await regularFiles(root, name));
    else if (stat.isFile()) names.push(name);
    else fail("NON_REGULAR_FILE");
  }
  return names.sort();
}
export async function verifyArtifact(root, expectedSha, expectedManifest, expectedSql) {
  if (!hex(expectedSha, 40) || !hex(expectedManifest, 64) || expectedSql !== EXPECTED_CHECKSUM) fail("EXPECTED_VALUES_INVALID");
  const names = await regularFiles(root);
  if (names.join() !== [...PAYLOAD, "manifest.json"].sort().join()) fail("FILE_INVENTORY_MISMATCH");
  const raw = await readFile(join(root, "manifest.json"));
  if (sha256(raw) !== expectedManifest) fail("MANIFEST_CHECKSUM_MISMATCH");
  const manifest = JSON.parse(raw);
  if (manifest.schema !== 1 || manifest.sha !== expectedSha || manifest.sqlChecksum !== expectedSql ||
    Object.keys(manifest.files).sort().join() !== [...PAYLOAD].sort().join()) fail("MANIFEST_CONTRACT_MISMATCH");
  for (const name of PAYLOAD) {
    if (!hex(manifest.files[name], 64) || sha256(await readFile(join(root, name))) !== manifest.files[name]) fail("FILE_CHECKSUM_MISMATCH");
  }
  const inventory = validateInventory(JSON.parse(await readFile(join(root, "inventory.json"), "utf8")));
  const sql = await readFile(join(root, `lib/repo/db/migrations/${VERSION}`), "utf8");
  if (sha256(sql) !== expectedSql) fail("SQL_CHECKSUM_MISMATCH");
  return { manifest, files: inventory.map((f) => ({ ...f, sql: f.version === VERSION ? sql : "" })) };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, destination, ...extra] = process.argv.slice(2);
  const inputs = { sha: process.env.EXPECTED_SHA, actualSha: process.env.GITHUB_SHA,
    sqlChecksum: process.env.EXPECTED_SQL_SHA256, mode: process.env.MODE, execute: process.env.EXECUTE,
    runId: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT };
  Promise.resolve().then(() => {
    if (command !== "build" || !destination || extra.length) fail("ARGUMENTS_INVALID");
    return buildArtifact(process.cwd(), resolve(destination), inputs);
  }).then((report) => console.log(JSON.stringify(report))).catch(() => { console.error("DELIVERY_BUILD_FAILED_DETAILS_WITHHELD"); process.exitCode = 1; });
}
