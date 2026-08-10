#!/usr/bin/env node
/**
 * BBE-63(R7 Phase 3 #14) 전광판 주차별 5지표 배치 대조 — dashboard-parity.mjs 패턴 재사용.
 *
 * 대시보드 C33:H40(생산/유입/컨택/미팅/계약, H=활동량 제외)과 lib/service/scoreboard-db.ts
 * weeklyPerfFromDb() 의 DB 재계산을 대조해 사용자×주차×지표 diff 표를 출력.
 * 순수 로직은 scoreboard-parity-lib.mjs 로 분리(테스트 가능하게 — 이 파일은 I/O 전용).
 *
 * ⚠️ BBE-63 본체(#720)는 라이브 parity 40% diff 로 2026-08-10 롤백됐다
 * (docs/incidents/2026-08-10-scoreboard-db-parity-gap.md). 이 감사 스크립트 자체는 **읽기
 * 전용·기능 무관**이라 계속 살려둔다 — 근인(BBE-66/67/68) 이 풀렸는지 재확인하는 유일한 수단.
 *
 * BBE-66/63 diff 원인 자동분류(2026-08-10, belie 최우선 지시) — dashboard-parity.mjs 와 동일
 * 패턴. 시차 판정은 미팅 파생 필드(미팅·계약)에만 적용 — sales(생산/유입/컨택) 는 스코프 밖.
 *
 * 실행(VPS): node scripts/ops/scoreboard-parity.mjs --cohort "A1-1,...,A2-8" [--user email]
 * ★URL·비밀번호·SA 키 로그 미출력. 읽기 전용(시트·DB 쓰기 없음).
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { google } from "googleapis";
import { Pool } from "pg";
import { classifyDiff, summarizeClassification } from "./parity-classify.mjs";
import { normalizeDbSales } from "./dashboard-parity-lib.mjs";
import {
  buildAlternates, computeWeeklyPerf, diffWeekly, isMeetingField, lookupWeekField,
  normalizeDbMeeting, normalizeSheetMeetingRow, num, parseISO, serialToISO,
} from "./scoreboard-parity-lib.mjs";

function loadEnv() {
  const out = {};
  for (const f of [".env", ".env.local"]) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").replace(/\r/g, "").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      out[m[1]] = v;
    }
  }
  return out;
}
const fileEnv = loadEnv();
const env = (k) => process.env[k] || fileEnv[k] || "";

const COHORT = (process.argv[process.argv.indexOf("--cohort") + 1] || "").trim();
const ONLY_USER = (process.argv.includes("--user") ? process.argv[process.argv.indexOf("--user") + 1] : "").trim().toLowerCase();
const COHORTS = COHORT.split(",").map((s) => s.trim()).filter(Boolean);

const REGISTRY_ID = env("SHEETS_REGISTRY_ID");
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const SA_KEY = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
const DB_URL = env("DATABASE_URL");

let sheets, pool;
function initClients() {
  const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, ["https://www.googleapis.com/auth/spreadsheets.readonly"]);
  sheets = google.sheets({ version: "v4", auth });
  pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false }, max: 3 });
}

async function grid(sid, range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sid, range, valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "SERIAL_NUMBER",
  }).catch(() => null);
  return res?.data.values ?? [];
}
async function batchGet(sid, ranges) {
  const res = await sheets.spreadsheets.values.batchGet({ spreadsheetId: sid, ranges, valueRenderOption: "UNFORMATTED_VALUE" }).catch(() => null);
  return res?.data.valueRanges ?? [];
}

async function dbRows(sid) {
  const sres = await pool.query(
    `select payload from sheet_rows where spreadsheet_id=$1 and tab='sales' and coalesce((payload->>'_cleared')::boolean,false)=false`, [sid]);
  const sales = sres.rows.map(({ payload: p }) => normalizeDbSales(p)).filter((r) => r.date);
  const mres = await pool.query(
    `select payload from sheet_rows where spreadsheet_id=$1 and tab='meetings' and coalesce((payload->>'_cleared')::boolean,false)=false`, [sid]);
  const meetings = mres.rows.map(({ payload: p }) => normalizeDbMeeting(p));
  return { sales, meetings };
}

async function sheetRawMeetingRows(sid) {
  const rows = await grid(sid, "'04 업체관리(앱자동작성용)'!A2:AS");
  return rows.map(normalizeSheetMeetingRow).filter((m) => m.channel || m.상태);
}

async function sheetWeeklyPerf(sid) {
  const vr = await batchGet(sid, ["'01 영업관리'!O1", "'대시보드(자동작성)'!C33:H40"]);
  const courseStart = serialToISO(vr[0]?.values?.[0]?.[0]);
  const rows = vr[1]?.values ?? [];
  const weeks = Array.from({ length: 8 }, (_, w) => {
    const row = rows[w] ?? [];
    return { week: w + 1, 생산: num(row[0]), 유입: num(row[1]), 컨택: num(row[2]), 미팅: num(row[3]), 계약: num(row[4]) };
  });
  return { courseStart, weeks };
}

async function main() {
  if (!COHORT) { console.error("사용법: node scoreboard-parity.mjs --cohort <아레나 라벨목록> [--user email]"); process.exit(1); }
  if (!REGISTRY_ID || !SA_EMAIL || !SA_KEY || !DB_URL) { console.error("parity: env 누락(SA/레지스트리/DATABASE_URL)"); process.exit(1); }
  initClients();

  const reg = await grid(REGISTRY_ID, "'users'!A2:R");
  const seen = new Set();
  const targets = reg.map((r) => ({
    email: String(r[0] ?? "").trim().toLowerCase(), cohort: String(r[1] ?? "").trim(), sid: String(r[3] ?? "").trim(), role: String(r[4] ?? "").trim() || "trainee",
  })).filter((u) => u.sid && COHORTS.includes(u.cohort) && u.role !== "trainer" && u.role !== "admin"
    && (!ONLY_USER || u.email === ONLY_USER) && !seen.has(u.sid) && seen.add(u.sid));

  console.log(`scoreboard-parity: 대상 ${targets.length}명 (cohort=${COHORT}${ONLY_USER ? `, user=${ONLY_USER}` : ""})`);
  let totalDiff = 0, cleanUsers = 0;
  const classified = [];
  for (const u of targets) {
    const sheet = await sheetWeeklyPerf(u.sid);
    if (!sheet.courseStart) { console.log(`  ${u.email}: courseStart(O1) 없음 — 스킵`); continue; }
    const cs = parseISO(sheet.courseStart);
    const { sales, meetings } = await dbRows(u.sid);
    const dbAgg = computeWeeklyPerf(meetings, sales, cs);
    const ds = diffWeekly(sheet.weeks, dbAgg.weeks);
    totalDiff += ds.length;
    if (ds.length === 0) { cleanUsers++; console.log(`  ✅ ${u.email} (${u.cohort}) — diff 0`); continue; }

    console.log(`  ⚠️ ${u.email} (${u.cohort}) — diff ${ds.length}:`);
    for (const x of ds.slice(0, 12)) console.log(`      ${x.f}: sheet=${x.s} db=${x.d}`);
    if (ds.length > 12) console.log(`      … 외 ${ds.length - 12}건`);

    // diff 있는 사용자만 — 시트 04 원본 행 재계산(시차 판정용, 쿼터 절약).
    const sheetMeetings = await sheetRawMeetingRows(u.sid);
    const sheetRowAgg = computeWeeklyPerf(sheetMeetings, [], cs);

    for (const x of ds) {
      const contributingDbRows = dbAgg.contrib.get(x.f) ?? [];
      const alternates = buildAlternates(x.f);
      const sheetRowRecount = isMeetingField(x.f) ? lookupWeekField(sheetRowAgg.weeks, x.f) : undefined;
      const r = classifyDiff({ field: x.f, sheetValue: x.s, dbValue: x.d }, { contributingDbRows, alternates, sheetRowRecount });
      classified.push({ user: u.email, field: x.f, sheetValue: x.s, dbValue: x.d, type: r.type, detail: r.detail });
    }
  }
  console.log(`\n── 요약 ── 사용자 ${targets.length} · diff 0 사용자 ${cleanUsers} · 총 diff ${totalDiff}`);
  if (classified.length > 0) console.log(summarizeClassification(classified).text);
  await pool.end();
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch((e) => { console.error("parity 실패:", (e?.message || e).replace(/postgres(ql)?:\/\/\S+/gi, "[DATABASE_URL]")); process.exit(1); });
}
