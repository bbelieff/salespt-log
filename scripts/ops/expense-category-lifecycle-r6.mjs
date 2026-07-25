#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = new Map(process.argv.slice(2).map((arg) => { const [key, ...rest] = arg.replace(/^--/, "").split("="); return [key, rest.length ? rest.join("=") : true]; }));
const sqlPath = resolve(dirname(fileURLToPath(import.meta.url)), "expense-category-lifecycle-r6.sql");
const sql = await readFile(sqlPath, "utf8");
const scriptSha = createHash("sha256").update(sql).digest("hex");
const phase = String(args.get("phase") ?? "B").toUpperCase();
const apply = args.get("apply") === true;
const rollback = args.get("rollback") === true;
const scope = String(args.get("scope") ?? "");
const actor = String(args.get("actor") ?? "");
const scopesSha = String(args.get("scopes-sha256") ?? "");
const allowed = new Set(["A", "B", "C", "D"]);
if ((!allowed.has(phase) && !rollback) || (rollback && phase !== "B")) throw new Error("invalid phase");
if ((phase === "C" || rollback) && !scope) throw new Error("--scope is required; --all is intentionally unsupported");
if (args.has("all")) throw new Error("--all is forbidden for first-run scope migration");
const selected = rollback ? ["ROLLBACK_SCOPE"] : phase === "A" ? ["A_TX", "A_CONCURRENT"] : [phase];
console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", phase: rollback ? "ROLLBACK_SCOPE" : phase, scope: scope || null, scriptSha256: scriptSha, scopesSha256: scopesSha || null, mutationCanary: "NOT_RUN_BY_GATE" }));
if (!apply) process.exit(0);
if (process.env.EXPENSE_CATEGORY_MIGRATION_FREEZE_R6?.trim() !== "1") throw new Error("freeze flag must be exactly 1");
const operationalPacket = ["backup-id", "freeze-destination", "restart-command-hash", "verification-plan", "rollback-plan", "verifier", "window"];
if (args.get("operational-approval") !== "APPROVED" || args.get("freeze-value") !== "1" || operationalPacket.some((key) => !args.get(key)) || !scopesSha) throw new Error("exact approved freeze destination/value/restart/verification/rollback/backup/verifier/window/scopes packet is required");
if (!actor) throw new Error("--actor is required");
if (!process.env.DATABASE_URL?.trim()) throw new Error("DATABASE_URL is required");

const { Client } = await import("pg");
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const quote = (value) => value.replaceAll("'", "''");
const rendered = sql.replaceAll("{{script_sha}}", scriptSha).replaceAll("{{scopes_sha}}", quote(scopesSha)).replaceAll("{{scope}}", quote(scope)).replaceAll("{{actor}}", quote(actor));
const sections = new Map(); let current = null;
for (const line of rendered.split(/\r?\n/)) { const marker = line.match(/^-- @phase (\S+)/); if (marker) { current = marker[1]; sections.set(current, []); } else if (current) sections.get(current).push(line); }
const statements = (name) => { const body = (sections.get(name) ?? []).join("\n").trim(); return name === "A_CONCURRENT" ? body.split(/;\s*(?:\r?\n|$)/).map((x) => x.trim()).filter(Boolean) : [body]; };
await client.connect();
try {
  for (const name of selected) {
    const transactional = name !== "A_CONCURRENT" && name !== "B";
    if (transactional) await client.query("begin isolation level serializable");
    try { for (const statement of statements(name)) await client.query(statement); if (transactional) await client.query("commit"); }
    catch (error) { if (transactional) await client.query("rollback").catch(() => {}); throw error; }
  }
  console.log(JSON.stringify({ result: "PASS", phase: selected.join("+"), scriptSha256: scriptSha, mutationCanary: "NOT_RUN_BY_GATE" }));
} finally { await client.end(); }
