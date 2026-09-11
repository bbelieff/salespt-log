// Private host-local observation. Never log PM2/env/URLs/process commands.
import { execFile, fork } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir, readlink, stat, lstat, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { DATABASE_LIMITS } from "./weekly-goals-migrate.mjs";
import { resolveDatabaseUrl } from "../db-migrate.mjs";
const exec = promisify(execFile);
const APP = "/opt/salespt-log";
const ENV_FILES = [".env.production.local", ".env.local", ".env.production", ".env"];
const fail = () => { throw new Error("RUNTIME_COMPARISON_BLOCKED"); };
export function parseProcessEnv(raw) {
  const out = {};
  for (const entry of raw.split("\0").filter(Boolean)) {
    const at = entry.indexOf("=");
    if (at < 1 || Object.hasOwn(out, entry.slice(0, at))) fail();
    out[entry.slice(0, at)] = entry.slice(at + 1);
  }
  return out;
}
function processStat(raw) {
  const fields = raw.slice(raw.lastIndexOf(")") + 2).split(" ");
  return { parent: Number(fields[1]), ticks: Number(fields[19]) };
}
export function selectPm2(list) {
  const matches = list.filter(p => p.name === "salespt-log");
  if (matches.length !== 1 || matches[0].pm2_env?.status !== "online" ||
      matches[0].pm2_env?.pm_cwd !== APP || !Number.isSafeInteger(matches[0].pid) || matches[0].pid < 1) fail();
  return matches[0].pid;
}
async function observe() {
  const { stdout } = await exec("pm2", ["jlist"], { timeout: 10000, maxBuffer: 8 * 1024 * 1024 });
  const parent = selectPm2(JSON.parse(stdout)); // private memory only
  const ids = (await readdir("/proc")).filter(n => /^\d+$/.test(n));
  const processes = new Map();
  for (const id of ids) {
    try { processes.set(Number(id), processStat(await readFile(`/proc/${id}/stat`, "utf8"))); } catch { /* exited */ }
  }
  const descendants = new Set([parent]);
  for (let i = 0; i < processes.size; i++) {
    const size = descendants.size;
    for (const [id, p] of processes) if (descendants.has(p.parent)) descendants.add(id);
    if (size === descendants.size) break;
  }
  const sockets = new Set();
  for (const file of ["/proc/net/tcp", "/proc/net/tcp6"]) {
    for (const line of (await readFile(file, "utf8")).trim().split("\n").slice(1)) {
      const f = line.trim().split(/\s+/);
      if (f[1]?.endsWith(":0BB8") && f[3] === "0A") sockets.add(`socket:[${f[9]}]`);
    }
  }
  const owners = [];
  for (const id of descendants) {
    try {
      const fds = await readdir(`/proc/${id}/fd`);
      for (const fd of fds) if (sockets.has(await readlink(`/proc/${id}/fd/${fd}`))) { owners.push(id); break; }
    } catch { /* disappearing process is excluded; no unique listener means blocked */ }
  }
  if (owners.length !== 1) fail();
  const pid = owners[0], p = processes.get(pid);
  if (!p || !Number.isFinite(p.ticks) || await readlink(`/proc/${pid}/cwd`) !== APP) fail();
  if (await readlink(`/proc/${pid}/exe`) !== await realpath(process.execPath)) fail();
  const command = await readFile(`/proc/${pid}/cmdline`, "utf8");
  if (!/^next-server(?:\s|\0)/.test(command) && !/next\/dist\/bin\/next\0start(?:\0|$)/.test(command)) fail();
  const env = parseProcessEnv(await readFile(`/proc/${pid}/environ`, "utf8"));
  if ((env.NODE_ENV && env.NODE_ENV !== "production") || env.__NEXT_PROCESSED_ENV || env.LD_PRELOAD ||
      (env.NODE_OPTIONS && !/^(?:\s*--max-old-space-size=\d+\s*)+$/.test(env.NODE_OPTIONS))) fail();
  const btime = Number((await readFile("/proc/stat", "utf8")).match(/^btime (\d+)$/m)?.[1]);
  const hz = Number((await exec("getconf", ["CLK_TCK"], { timeout: 5000 })).stdout.trim());
  if (!Number.isFinite(btime) || !(hz > 0)) fail();
  const startedAt = (btime + p.ticks / hz) * 1000;
  const envMeta = [];
  const contract = JSON.parse(await readFile(new URL("../../runtime-contract.json", import.meta.url), "utf8"));
  if (Object.keys(contract).sort().join() !== ["lib/repo/db/client.ts", "next.config.mjs"].sort().join()) fail();
  for (const name of Object.keys(contract)) {
    const hash = createHash("sha256").update(await readFile(`${APP}/${name}`)).digest("hex");
    if (hash !== contract[name] || (await stat(`${APP}/${name}`)).ctimeMs > startedAt) fail();
    envMeta.push([name, hash]);
  }
  const required = `${APP}/.next/required-server-files.json`;
  if ((await stat(required)).ctimeMs > startedAt ||
      Object.hasOwn(JSON.parse(await readFile(required, "utf8")).config?.env || {}, "DATABASE_URL")) fail();
  if ((await stat(`${APP}/node_modules/@next/env/dist/index.js`)).ctimeMs > startedAt) fail();
  envMeta.push(...await inspectEnvironmentFiles(APP, startedAt));
  return { env, fingerprint: createHash("sha256").update(JSON.stringify([parent,pid,p.ticks,env,envMeta])).digest("hex") };
}
export async function inspectEnvironmentFiles(root, startedAt) {
  const envMeta = [];
  // If files/root changed after launch, replay cannot prove the loaded runtime; fail on ambiguity.
  if ((await stat(root)).mtimeMs > startedAt) fail();
  for (const name of ENV_FILES) {
    try {
      const s = await lstat(`${root}/${name}`);
      if (!s.isFile() || s.isSymbolicLink() || s.mtimeMs > startedAt || s.ctimeMs > startedAt) fail();
      envMeta.push([name, s.size, s.mtimeMs, s.ctimeMs, createHash("sha256").update(await readFile(`${root}/${name}`)).digest("hex")]);
    } catch (error) { if (error.code !== "ENOENT") throw error; envMeta.push([name, null]); }
  }
  return envMeta;
}
async function resolveRuntimeEnv(env) {
  return new Promise((accept, reject) => {
    const child = fork(fileURLToPath(import.meta.url), ["--resolve-private"], {
      cwd: APP, env: { ...env, NODE_ENV: "production" }, execArgv: [], silent: true,
    });
    // Child stdio is never forwarded; only the private IPC channel carries the resolved value.
    child.stdout?.resume(); child.stderr?.resume();
    const timer = setTimeout(() => { child.kill(); reject(new Error("RUNTIME_RESOLUTION_TIMEOUT")); }, 10000);
    let value;
    child.on("message", msg => { if (typeof msg?.url === "string") value = msg.url; });
    child.on("error", () => { clearTimeout(timer); reject(new Error("RUNTIME_RESOLUTION_FAILED")); });
    child.on("exit", code => { clearTimeout(timer); if (code === 0 && value) accept(value); else reject(new Error("RUNTIME_RESOLUTION_FAILED")); });
  });
}
export function compareResolvedUrls(app, migration) {
  const a = new URL(app), b = new URL(migration);
  if (!["postgres:", "postgresql:"].includes(a.protocol) || !["postgres:", "postgresql:"].includes(b.protocol) ||
      !a.hostname || !a.username || !a.pathname.slice(1) || !b.hostname || !b.username || !b.pathname.slice(1)) fail();
  // Strict equality of routing/options prevents pooler project/options ambiguity; values never returned.
  const targetMatches = a.hostname === b.hostname && (a.port || "5432") === (b.port || "5432") &&
    a.pathname === b.pathname && a.search === b.search;
  const configuredRoleMatches = a.username === b.username;
  return { targetMatches, configuredRoleMatches };
}
export async function compareRuntime() {
  if (process.cwd() !== APP) fail();
  assertNoPgOverrides(process.env);
  const snapshot = await observe();
  const appUrl = await resolveRuntimeEnv(snapshot.env);
  const migrationUrl = resolveDatabaseUrl();
  const matching = compareResolvedUrls(appUrl, migrationUrl);
  if (!matching.targetMatches || !matching.configuredRoleMatches) fail();
  const { Client } = createRequire(`${APP}/package.json`)("pg");
  const inspect = async (url) => {
    const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, ...DATABASE_LIMITS });
    try { await c.connect(); return await inspectRuntimeDatabase(c); }
    finally { await c.end().catch(() => {}); }
  };
  const app = await inspect(appUrl), migration = await inspect(migrationUrl);
  const sameDatabase = typeof app.server === "string" && Number.isInteger(app.port) &&
    app.db === migration.db && app.server === migration.server && app.port === migration.port;
  const sameRole = typeof app.role === "string" && app.role === migration.role && app.session === migration.session;
  const permissionsMatch = JSON.stringify(app.permissions) === JSON.stringify(migration.permissions);
  if (!sameDatabase || !sameRole || !permissionsMatch) fail();
  const assertUnchanged = async () => {
    if ((await observe()).fingerprint !== snapshot.fingerprint || resolveDatabaseUrl() !== migrationUrl) fail();
  };
  await assertUnchanged();
  return { assertUnchanged, report: { mode: "RUNTIME_DATABASE_COMPARISON", ...matching,
    observedDatabaseMatches: sameDatabase, observedRoleMatches: sameRole,
    permissionsMatch, tablePermissions: app.permissions,
    appBypassRls: app.bypass === true, migrationBypassRls: migration.bypass === true, runtimeStable: true } };
}
// Internal identity values are compared privately; only fixed booleans/permissions reach the CLI.
export async function inspectRuntimeDatabase(c) {
    await c.query("begin read only");
    try {
      await c.query(`set local statement_timeout = '${DATABASE_LIMITS.statement_timeout}ms'`);
      await c.query(`set local lock_timeout = '${DATABASE_LIMITS.lock_timeout}ms'`);
      const { rows } = await c.query(`select current_database() as db,current_user as role,session_user as session,
        inet_server_addr()::text as server,inet_server_port() as port,
        (select rolsuper or rolbypassrls from pg_roles where rolname=current_user) as bypass`);
      const permissions = [];
      for (const name of ["schema_migrations", "weekly_goals", "weekly_goal_private"]) {
        const rights = await c.query(`select to_regclass($1) is not null as exists,
          has_table_privilege(current_user,to_regclass($1),'SELECT') as select,
          has_table_privilege(current_user,to_regclass($1),'INSERT') as insert,
          has_table_privilege(current_user,to_regclass($1),'UPDATE') as update,
          has_table_privilege(current_user,to_regclass($1),'DELETE') as delete`, [`public.${name}`]);
        if (rights.rows.length !== 1) fail();
        permissions.push({ table: name, ...Object.fromEntries(["exists","select","insert","update","delete"].map(k =>
          [k, typeof rights.rows[0][k] === "boolean" ? rights.rows[0][k] : null])) });
      }
      await c.query("rollback");
      if (rows.length !== 1) fail();
      return { ...rows[0], permissions };
    } catch (error) { await c.query("rollback").catch(() => {}); throw error; }
}
if (process.argv[2] === "--resolve-private") {
  try {
    if (!process.send || process.cwd() !== APP) fail();
    const result = resolveNextEnvironment(APP);
    assertNoPgOverrides(result.combinedEnv);
    const url = result.combinedEnv.DATABASE_URL;
    if (typeof url !== "string" || !url.trim()) fail();
    process.send({ url }, () => process.disconnect());
  } catch { process.exitCode = 1; if (process.connected) process.disconnect(); }
}
// Exported for isolated-process tests; production CLI only accepts its fixed APP directory.
export function resolveNextEnvironment(root) {
  const nextEnv = createRequire(`${root}/package.json`)("@next/env");
  let failed = false;
  const result = nextEnv.loadEnvConfig(root, false, { info() {}, error() { failed = true; } }, true);
  if (failed) fail();
  return result;
}
export function assertNoPgOverrides(env) {
  // node-postgres fallback env could otherwise differ between the running app and observer.
  if (Object.entries(env).some(([key,value]) => /^PG[A-Z_]+$/.test(key) && value)) fail();
}
