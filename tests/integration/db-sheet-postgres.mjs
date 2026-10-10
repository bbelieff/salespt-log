/** Build a credential-free bundle locally; root runs it with DATABASE_URL in an isolated schema. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function runProbe(Pool, api, migration) {
  if (!process.env.DATABASE_URL) throw new Error("PROBE_DATABASE_URL_REQUIRED");
  const schema = `db_sheet_probe_${randomUUID().replaceAll("-", "")}`;
  assert.match(schema, /^db_sheet_probe_[a-f0-9]{32}$/);
  const configuration = { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 };
  const admin = new Pool({ ...configuration, max: 1, options: "-c search_path=pg_catalog" });
  let pool, created = false;
  const pass = label => console.log(`PASS ${label}`);
  try {
    await admin.query(`create schema "${schema}" authorization current_user`); created = true;
    pool = new Pool({ ...configuration, max: 6, options: `-c search_path=${schema},pg_catalog` });
    globalThis.__dbSheetProbePool = pool;
    const session = await pool.query("select current_schema() as schema");
    assert.equal(session.rows[0].schema, schema);
    await pool.query(`create table sheet_rows (id bigserial primary key, cohort text not null, email text, spreadsheet_id text not null, tab text not null, row_key text not null, payload jsonb not null, updated_at timestamptz not null default now(), mirror_pending boolean not null default false, unique(spreadsheet_id,tab,row_key))`);
    const isolatedMigration = migration.replaceAll("public.", `"${schema}".`);
    assert.ok(!isolatedMigration.includes("public."));
    await pool.query(isolatedMigration);
    const a = await pool.connect(), b = await pool.connect();
    assert.notEqual(a.processID, b.processID); a.release(); b.release();
    pass("isolated_schema_and_two_postgres_connections");

    const owner = { email: "probe-a@example.invalid", spreadsheetId: "synthetic-sheet-a", cohort: "연습" };
    globalThis.__dbSheetProbeUser = owner;
    globalThis.__dbSheetProbeWritable = owner.email;
    async function post(body, expected = 200) {
      const response = await api.POST(new Request("http://probe.invalid/api/db-sheet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
      assert.equal(response.status, expected, "API_STATUS_MISMATCH");
      return response.json();
    }
    async function get() { const response = await api.GET(); assert.equal(response.status, 200); return (await response.json()).leads; }
    async function sales(date) { return (await pool.query("select payload from sheet_rows where spreadsheet_id=$1 and tab='sales' and row_key=$2", [owner.spreadsheetId, `${date}:직접생산`])).rows[0]?.payload ?? {}; }
    const input = { id: randomUUID(), supplier: "메타 광고", date: "2026-10-08", channel: "직접생산", company: "합성 원본업체", owner: "합성 대표", phone: "+821000000001", memo: "합성 원본 응답" };
    const batchId = randomUUID();
    let lead = (await post({ action: "import", batchId, leads: [input] })).leads[0];
    assert.equal(lead.phone, "010-0000-0001");
    assert.equal((await get())[0].id, input.id);
    assert.equal((await post({ action: "import", batchId, leads: [input] })).leads[0].revision, lead.revision);
    assert.equal((await get()).length, 1);
    assert.equal((await sales("2026-10-08")).inflow, 1);
    assert.equal((await sales("2026-10-08")).production, 1);
    pass("api_import_reload_batch_retry_and_inflow_date");

    for (const [date, result, count] of [["2026-10-09", "부재", 0], ["2026-10-09", "단순거절", 0], ["2026-10-09", "컨택진행", 1], ["2026-10-09", "컨택진행", 1], ["2026-10-10", "컨택진행", 1]]) {
      lead = (await post({ action: "contact", id: lead.id, revision: lead.revision, date, result, note: "합성 상담 메모" })).leads[0];
      assert.equal((await sales(date)).contactProgress ?? 0, count);
    }
    assert.equal((await sales("2026-10-09")).contactProgress, 1);
    assert.equal(lead.first, "2026-10-09");
    pass("absence_refusal_zero_and_unique_consultation_per_date");

    lead = (await post({ action: "save", revision: lead.revision, lead: { ...lead, contact: { ...lead.contact, companyName: "확인한 합성 업체", ci: { ...lead.contact.ci, 대표자이름: "확인한 합성 대표", 소재지: "합성 소재지" }, date: "2026-10-10", meetingDate: "2026-10-15", time: "14:00" } } })).leads[0];
    lead = (await post({ action: "meeting", id: lead.id, revision: lead.revision })).leads[0];
    const booked = (await pool.query("select payload from sheet_rows where spreadsheet_id=$1 and tab='meetings' and row_key=$2", [owner.spreadsheetId, lead.meetingId])).rows[0].payload;
    assert.equal(booked.예약일, "2026-10-10"); assert.equal(booked.미팅날짜, "2026-10-15");
    assert.equal(booked.업체명, "확인한 합성 업체"); assert.equal(booked.장소, "합성 소재지");
    assert.equal(booked.업체정보.대표자이름, "확인한 합성 대표");
    assert.equal((await sales("2026-10-10")).meetingReservation, 1);
    assert.equal((await sales("2026-10-15")).meetingReservation ?? 0, 0);
    assert.equal((await sales("2026-10-10")).contactProgress, 1);
    const reloaded = (await get())[0];
    assert.equal(reloaded.company, input.company); assert.equal(reloaded.memo, input.memo);
    assert.equal(reloaded.contact.companyName, booked.업체명);
    pass("meeting_card_booking_date_and_raw_verified_separation");

    await post({ action: "contact", id: lead.id, revision: 1, date: "2026-10-10", result: "컨택진행", note: "합성" }, 409);
    globalThis.__dbSheetProbeWritable = "probe-other@example.invalid";
    await post({ action: "contact", id: lead.id, revision: lead.revision, date: "2026-10-10", result: "부재", note: "합성" }, 403);
    globalThis.__dbSheetProbeUser = { ...owner, email: "probe-b@example.invalid", spreadsheetId: "synthetic-sheet-b" };
    globalThis.__dbSheetProbeWritable = "probe-b@example.invalid";
    assert.equal((await get()).length, 0);
    await post({ action: "contact", id: lead.id, revision: lead.revision, date: "2026-10-10", result: "부재", note: "합성" }, 409);
    globalThis.__dbSheetProbeUser = owner; globalThis.__dbSheetProbeWritable = owner.email;
    pass("stale_revision_and_tenant_isolation");

    const command = { action: "contact", id: lead.id, revision: lead.revision, date: "2026-10-10", result: "컨택진행", note: "동시 합성 기록" };
    const responses = await Promise.all([1, 2].map(() => api.POST(new Request("http://probe.invalid/api/db-sheet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command) }))));
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
    assert.equal((await sales("2026-10-10")).contactProgress, 1);
    assert.equal((await get())[0].revision, lead.revision + 1);
    pass("concurrent_same_revision_exactly_one_commit");
  } finally {
    if (pool) await pool.end();
    delete globalThis.__dbSheetProbePool;
    try {
    if (created) {
      const owned = await admin.query("select nspname from pg_namespace where nspname=$1 and nspowner=(select oid from pg_roles where rolname=current_user)", [schema]);
      assert.equal(owned.rows[0]?.nspname, schema, "PROBE_SCHEMA_OWNERSHIP_LOST");
      await admin.query(`drop schema "${schema}" cascade`);
      pass("owned_probe_schema_removed");
    }
    } finally { await admin.end(); }
  }
}


/** Temporary loopback fixture API. No public schema or production identity is exposed. */
export async function serveProbe(Pool, api, migration, portText) {
  assert.match(String(portText ?? ""), /^\d{4,5}$/);
  const port = Number(portText);
  assert.ok(port >= 1024 && port <= 65535 && ![3000, 3100].includes(port), "PROBE_PORT_INVALID");
  if (!process.env.DATABASE_URL) throw new Error("PROBE_DATABASE_URL_REQUIRED");
  const schema = `db_sheet_probe_${randomUUID().replaceAll("-", "")}`;
  assert.match(schema, /^db_sheet_probe_[a-f0-9]{32}$/);
  const config = { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 };
  const admin = new Pool({ ...config, max: 1, options: "-c search_path=pg_catalog" });
  let pool, server, timer, stop, created = false;
  const stopped = new Promise(resolveStop => { stop = resolveStop; });
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  timer = setTimeout(stop, 10 * 60 * 1000);
  const owner = { email: "probe-a@example.invalid", spreadsheetId: "synthetic-sheet-a", cohort: "연습" };
  try {
    await admin.query(`create schema "${schema}" authorization current_user`); created = true;
    pool = new Pool({ ...config, max: 6, options: `-c search_path=${schema},pg_catalog` });
    assert.equal((await pool.query("select current_schema() as schema")).rows[0].schema, schema);
    await pool.query(`create table sheet_rows (id bigserial primary key, cohort text not null, email text, spreadsheet_id text not null, tab text not null, row_key text not null, payload jsonb not null, updated_at timestamptz not null default now(), mirror_pending boolean not null default false, unique(spreadsheet_id,tab,row_key))`);
    const isolatedMigration = migration.replaceAll("public.", `"${schema}".`);
    assert.ok(!isolatedMigration.includes("public.")); await pool.query(isolatedMigration);
    globalThis.__dbSheetProbePool = pool;
    globalThis.__dbSheetProbeUser = owner; globalThis.__dbSheetProbeWritable = owner.email;
    server = createServer(async (req, res) => {
      const json = (status, value) => { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(value)); };
      try {
        const path = new URL(req.url, "http://127.0.0.1").pathname;
        if (path === "/fixture-proof" && req.method === "GET") {
          const rows = await pool.query("select tab,row_key,payload from sheet_rows where spreadsheet_id=$1 and tab in ('sales','meetings') order by tab,row_key", [owner.spreadsheetId]);
          return json(200, { synthetic: true, rows: rows.rows });
        }
        if (path !== "/api/db-sheet" || !["GET", "POST"].includes(req.method)) return json(404, { error: "not_found" });
        let response;
        if (req.method === "GET") response = await api.GET();
        else {
          const chunks = []; let size = 0;
          for await (const chunk of req) { size += chunk.length; if (size > 2 * 1024 * 1024) return json(413, { error: "fixture_body_limit" }); chunks.push(chunk); }
          response = await api.POST(new Request("http://127.0.0.1/api/db-sheet", { method: "POST", headers: { "Content-Type": "application/json" }, body: Buffer.concat(chunks).toString("utf8") }));
        }
        json(response.status, await response.json());
      } catch { json(503, { error: "fixture_unavailable" }); }
    });
    server.requestTimeout = 15000;
    await new Promise((ready, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", ready); });
    console.log(`READY fixture_loopback_port=${port} ttl_seconds=600`);
    await stopped;
  } finally {
    if (timer) clearTimeout(timer);
    if (stop) { process.off("SIGINT", stop); process.off("SIGTERM", stop); }
    if (server?.listening) await new Promise(done => { server.close(done); server.closeAllConnections(); });
    if (pool) await pool.end();
    delete globalThis.__dbSheetProbePool; delete globalThis.__dbSheetProbeUser; delete globalThis.__dbSheetProbeWritable;
    try {
      if (created) {
        const owned = await admin.query("select nspname from pg_namespace where nspname=$1 and nspowner=(select oid from pg_roles where rolname=current_user)", [schema]);
        assert.equal(owned.rows[0]?.nspname, schema, "PROBE_SCHEMA_OWNERSHIP_LOST");
        await admin.query(`drop schema "${schema}" cascade`);
        console.log("PASS owned_fixture_schema_removed");
      }
    } finally { await admin.end(); }
  }
}

async function buildBundle() {
  const { build } = await import("esbuild");
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const outfile = resolve(process.argv[3] || "artifacts/db-sheet-postgres-probe.cjs");
  await mkdir(dirname(outfile), { recursive: true });
  const migration = await readFile(resolve(root, "lib/repo/db/migrations/0008_db_sheet.sql"), "utf8");
  const mock = {
    identity: `export class StudentViewContextError extends Error {} export const requireStudentViewContext=async()=>({email:globalThis.__dbSheetProbeUser.email}); export const getWritableUserEmail=async()=>globalThis.__dbSheetProbeWritable;`,
    users: `export const findUserByEmail=async(email)=>email===globalThis.__dbSheetProbeUser.email?globalThis.__dbSheetProbeUser:null;`,
    client: `export const dbEnabled=()=>true; export const getDbPool=()=>globalThis.__dbSheetProbePool; export const ensureSchema=async()=>{}; export const upsertSheetRow=async()=>{throw new Error("PROBE_UNEXPECTED_MIRROR");};`,
    "sales-write": `export const queueSalesRowSync=()=>{};`,
    "meetings-write": `export const queueMeetingSheetSync=()=>{};`,
    "db-sheet-sync": `export const queueDbSheetProductionSync=()=>{};`,
  };
  await build({ absWorkingDir: root, stdin: { contents: `import {Pool} from 'pg'; import * as api from './app/api/db-sheet/route.ts'; import {runProbe,serveProbe} from './tests/integration/db-sheet-postgres.mjs'; (process.argv[2]==='--serve'?serveProbe(Pool,api,${JSON.stringify(migration)},process.argv[3]):runProbe(Pool,api,${JSON.stringify(migration)})).catch(()=>{console.error('FAIL db_sheet_postgres_probe');process.exitCode=1;});`, resolveDir: root }, outfile, bundle: true, platform: "node", format: "cjs", packages: "external", logLevel: "silent", plugins: [{ name: "probe-boundaries", setup(build) {
    build.onResolve({ filter: /(?:identity|users|client|sales-write|meetings-write|db-sheet-sync)$/ }, args => {
      const key = args.path.split("/").at(-1);
      const target = key === "identity" ? args.path === "@/auth/identity" : key === "users" ? args.path === "@/repo/users" : key === "client" ? args.path === "@/repo/db/client" || args.path === "./client" : args.path === `./${key}`;
      if (target && mock[key]) return { path: key, namespace: "probe-mock" };
    });
    build.onLoad({ filter: /.*/, namespace: "probe-mock" }, args => ({ contents: mock[args.path], loader: "js" }));
  }}] });
  console.log(`BUILT ${outfile}`);
}
if (process.argv[2] === "--build") buildBundle().catch(e => { console.error("FAIL probe_bundle_build", e.errors?.map(error=>error.text).join("; ") || "BUILD_ERROR"); process.exitCode = 1; });
