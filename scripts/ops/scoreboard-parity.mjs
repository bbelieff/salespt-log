/**
 * BBE-63(R7 Phase 3 #14) 전광판 주차별 5지표 배치 대조 — dashboard-parity.mjs 패턴 재사용.
 *
 * 대시보드 C33:H40(생산/유입/컨택/미팅/계약, H=활동량 제외)과 lib/service/scoreboard-db.ts
 * weeklyPerfFromDb() 의 DB 재계산을 대조해 사용자×주차×지표 diff 표를 출력.
 * 순수 로직은 그 파일을 JS 로 충실 재현(.mjs 는 TS import 불가 — backfill 패턴, dashboard-parity.mjs 와 동일 사유).
 *
 * ⚠️ 이 스크립트는 로컬에 운영 비밀값이 없어(worker-onboarding.md 함정 §C) **직접 실행하지
 * 못했다** — VPS(GitHub Actions workflow_dispatch 등)에서 실행해 결과를 belie/FM 에게
 * 회수받아야 한다(§0.8 Report: 미확정으로 명시한 미팅=완료 가정을 여기서 실측 확정).
 *
 * 실행(VPS): node scripts/ops/scoreboard-parity.mjs --cohort "A1-1,A1-2,...,A2-7,A2-8" [--user email]
 * ★URL·비밀번호·SA 키 로그 미출력. 읽기 전용(시트·DB 쓰기 없음).
 */
import { existsSync, readFileSync } from "node:fs";
import { google } from "googleapis";
import { Pool } from "pg";

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
if (!COHORT) { console.error("사용법: node scoreboard-parity.mjs --cohort <아레나 라벨목록> [--user email]"); process.exit(1); }

const REGISTRY_ID = env("SHEETS_REGISTRY_ID");
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const SA_KEY = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
const DB_URL = env("DATABASE_URL");
if (!REGISTRY_ID || !SA_EMAIL || !SA_KEY || !DB_URL) { console.error("parity: env 누락(SA/레지스트리/DATABASE_URL)"); process.exit(1); }

const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, ["https://www.googleapis.com/auth/spreadsheets.readonly"]);
const sheets = google.sheets({ version: "v4", auth });
const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false }, max: 3 });

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : Number.isFinite(Number(v)) ? Number(v) : 0);

async function batchGet(sid, ranges) {
  const res = await sheets.spreadsheets.values.batchGet({ spreadsheetId: sid, ranges, valueRenderOption: "UNFORMATTED_VALUE" }).catch(() => null);
  return res?.data.valueRanges ?? [];
}
const serialToISO = (v) => {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const n = Number(v);
  if (!Number.isFinite(n) || n < 20000) return null;
  return new Date((n - 25569) * 86400000).toISOString().slice(0, 10);
};
const parseISODate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const diffDays = (a, b) => Math.round((a.getTime() - b.getTime()) / 86400000);
// WEEK-INDEX-SSOT-COPY: lib/util/week.ts weekIndexOf(시작일 앵커) 사본 — .mjs 는 TS import 불가. 수정 시 정본과 동기(G8, dashboard-parity.mjs 동일 관례).
const weekIndexOf = (date, cs) => { const d = diffDays(date, cs); return d < 0 ? 0 : Math.floor(d / 7) + 1; };

// ── DB 재계산 — lib/service/scoreboard-db.ts::weeklyPerfFromDb 의 JS 재현 ──────────
async function dbWeeklyPerf(sid, courseStart) {
  const sres = await pool.query(
    `select payload from sheet_rows where spreadsheet_id=$1 and tab='sales' and coalesce((payload->>'_cleared')::boolean,false)=false`, [sid]);
  const sales = sres.rows.map(({ payload: p }) => ({
    date: String(p.date ?? "").slice(0, 10), production: num(p.production), inflow: num(p.inflow), contactProgress: num(p.contactProgress),
  })).filter((r) => r.date);
  const mres = await pool.query(
    `select payload from sheet_rows where spreadsheet_id=$1 and tab='meetings' and coalesce((payload->>'_cleared')::boolean,false)=false`, [sid]);
  const meetings = mres.rows.map(({ payload: p }) => ({
    상태: String(p.상태 ?? ""), 미팅날짜: String(p.미팅날짜 ?? "").slice(0, 10), 구분: String(p.구분 ?? "").trim(),
  }));

  const weeks = Array.from({ length: 8 }, (_, w) => ({ week: w + 1, 생산: 0, 유입: 0, 컨택: 0, 미팅: 0, 계약: 0 }));
  for (const r of sales) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) continue;
    const w = weekIndexOf(parseISODate(r.date), courseStart);
    if (w < 1 || w > 8) continue;
    const row = weeks[w - 1];
    row.생산 += r.production; row.유입 += r.inflow; row.컨택 += r.contactProgress;
  }
  for (const m of meetings) {
    if (m.구분 === "이월") continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(m.미팅날짜)) continue;
    const w = weekIndexOf(parseISODate(m.미팅날짜), courseStart);
    if (w < 1 || w > 8) continue;
    const row = weeks[w - 1];
    if (m.상태 === "완료" || m.상태 === "계약") row.미팅 += 1;
    if (m.상태 === "계약") row.계약 += 1;
  }
  return weeks;
}

// ── 시트값 — 대시보드 C33:H40 (C~G = 생산/유입/컨택/미팅/계약, H=활동량 제외) ──────
async function sheetWeeklyPerf(sid) {
  const vr = await batchGet(sid, ["'01 영업관리'!O1", "'대시보드(자동작성)'!C33:H40"]);
  const courseStartRaw = vr[0]?.values?.[0]?.[0];
  const courseStart = serialToISO(courseStartRaw);
  const rows = vr[1]?.values ?? [];
  const weeks = Array.from({ length: 8 }, (_, w) => {
    const row = rows[w] ?? [];
    return { week: w + 1, 생산: num(row[0]), 유입: num(row[1]), 컨택: num(row[2]), 미팅: num(row[3]), 계약: num(row[4]) };
  });
  return { courseStart, weeks };
}

function diff(sheetWeeks, dbWeeks) {
  const out = [];
  const push = (f, s, d) => { if (num(s) !== num(d)) out.push({ f, s: num(s), d: num(d) }); };
  const FIELDS = ["생산", "유입", "컨택", "미팅", "계약"];
  for (let i = 0; i < 8; i++) {
    for (const f of FIELDS) push(`주${i + 1}.${f}`, sheetWeeks[i]?.[f] ?? 0, dbWeeks[i]?.[f] ?? 0);
  }
  return out;
}

async function main() {
  const reg = await (async () => {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: REGISTRY_ID, range: "'users'!A2:R", valueRenderOption: "UNFORMATTED_VALUE",
    }).catch(() => null);
    return res?.data.values ?? [];
  })();
  const seen = new Set();
  const targets = reg.map((r) => ({
    email: String(r[0] ?? "").trim().toLowerCase(), cohort: String(r[1] ?? "").trim(), sid: String(r[3] ?? "").trim(), role: String(r[4] ?? "").trim() || "trainee",
  })).filter((u) => u.sid && COHORTS.includes(u.cohort) && u.role !== "trainer" && u.role !== "admin"
    && (!ONLY_USER || u.email === ONLY_USER) && !seen.has(u.sid) && seen.add(u.sid));

  console.log(`scoreboard-parity: 대상 ${targets.length}명 (cohort=${COHORT}${ONLY_USER ? `, user=${ONLY_USER}` : ""})`);
  let totalDiff = 0, cleanUsers = 0;
  for (const u of targets) {
    const sheet = await sheetWeeklyPerf(u.sid);
    if (!sheet.courseStart) { console.log(`  ${u.email}: courseStart(O1) 없음 — 스킵`); continue; }
    const db = await dbWeeklyPerf(u.sid, parseISODate(sheet.courseStart));
    const ds = diff(sheet.weeks, db);
    totalDiff += ds.length;
    if (ds.length === 0) { cleanUsers++; console.log(`  ✅ ${u.email} (${u.cohort}) — diff 0`); }
    else {
      console.log(`  ⚠️ ${u.email} (${u.cohort}) — diff ${ds.length}:`);
      for (const x of ds.slice(0, 12)) console.log(`      ${x.f}: sheet=${x.s} db=${x.d}`);
      if (ds.length > 12) console.log(`      … 외 ${ds.length - 12}건`);
    }
  }
  console.log(`\n── 요약 ── 사용자 ${targets.length} · diff 0 사용자 ${cleanUsers} · 총 diff ${totalDiff}`);
  if (totalDiff > 0) {
    console.log(`\n⚠️ diff 가 "미팅" 필드에 집중된다면 = 대시보드 D(미팅)열이 미팅완료(L)가 아니라`);
    console.log(`   미팅예약(H, sales.meetingReservation)일 가능성 — weeklyPerfFromDb 의 미팅 정의를`);
    console.log(`   isDone 기준에서 meetingReservation 합산으로 교체 검토(lib/service/scoreboard-db.ts).`);
  }
  await pool.end();
}
main().catch((e) => { console.error("parity 실패:", (e?.message || e).replace(/postgres(ql)?:\/\/\S+/gi, "[DATABASE_URL]")); process.exit(1); });
