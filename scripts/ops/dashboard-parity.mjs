/**
 * R2-7a 대시보드 전수 배치 대조 (db-dashboard-aggregates 스코프4).
 *
 * 파일럿 전 사용자에 대해 대시보드 시트 수식 결과(01!R1:U6·N{38..276}·대시보드 H33:H40·B21)와
 * DB 재계산(sheet_rows sales/meetings/contracts 로부터)을 대조해 사용자×항목 diff 표를 출력.
 * lib/service/dashboard-aggregates.ts 의 4개 순수 함수를 JS 로 충실 재현(backfill 패턴).
 *
 * 실행(VPS): node scripts/ops/dashboard-parity.mjs --cohort "8,9,연습,A1-0,...,A1-6" [--user email]
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
const COHORTS = COHORT.split(",").map((s) => s.trim().replace(/기\s*$/, "")).filter(Boolean);
if (!COHORT) { console.error("사용법: node dashboard-parity.mjs --cohort <라벨목록> [--user email]"); process.exit(1); }

const REGISTRY_ID = env("SHEETS_REGISTRY_ID");
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const SA_KEY = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
const DB_URL = env("DATABASE_URL");
if (!REGISTRY_ID || !SA_EMAIL || !SA_KEY || !DB_URL) { console.error("parity: env 누락(SA/레지스트리/DATABASE_URL)"); process.exit(1); }

const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, ["https://www.googleapis.com/auth/spreadsheets.readonly"]);
const sheets = google.sheets({ version: "v4", auth });
const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false }, max: 3 });

const CHANNEL_ORDER = ["매입DB", "직접생산", "현수막", "콜·지·기·소"];
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : Number.isFinite(Number(v)) ? Number(v) : 0);
const colName = (i) => (i < 26 ? String.fromCharCode(65 + i) : "A" + String.fromCharCode(65 + i - 26));
const coerce = (v) => {
  if (typeof v !== "string") return v;
  if (v === "true" || v === "TRUE") return true;
  if (v === "false" || v === "FALSE") return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
};

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
const serialToISO = (v) => {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const n = Number(v);
  if (!Number.isFinite(n) || n < 20000) return null;
  return new Date((n - 25569) * 86400000).toISOString().slice(0, 10);
};
const parseISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const diffDays = (a, b) => Math.round((a.getTime() - b.getTime()) / 86400000);
const weekIndexOf = (date, cs) => { const d = diffDays(date, cs); return d < 0 ? 0 : Math.floor(d / 7) + 1; };

// ── DB payload → 값 (필드명 우선, 열문자 fallback) ─────────────────
function fieldOrCol(p, field, colIdx) {
  if (p[field] !== undefined && p[field] !== null && p[field] !== "") return p[field];
  return coerce(p[colName(colIdx)]);
}

async function dbAggregates(sid, courseStart, courseStartISO) {
  // sales: 필드명(readSalesRowsFromDb 규약)
  const sres = await pool.query(
    `select payload from sheet_rows where spreadsheet_id=$1 and tab='sales' and coalesce((payload->>'_cleared')::boolean,false)=false`, [sid]);
  const sales = sres.rows.map(({ payload: p }) => ({
    date: String(p.date ?? "").slice(0, 10), channel: String(p.channel ?? ""),
    production: num(p.production), inflow: num(p.inflow), contactProgress: num(p.contactProgress), meetingReservation: num(p.meetingReservation),
  })).filter((r) => r.date && r.channel);
  // meetings: 필드명(상태/channel/미팅날짜/계약여부) 우선, 열문자(J9/F5/D3/K10) fallback
  const mres = await pool.query(
    `select payload from sheet_rows where spreadsheet_id=$1 and tab='meetings' and coalesce((payload->>'_cleared')::boolean,false)=false`, [sid]);
  const meetings = mres.rows.map(({ payload: p }) => ({
    상태: String(fieldOrCol(p, "상태", 9) ?? ""),
    channel: String(fieldOrCol(p, "channel", 5) ?? ""),
    미팅날짜: (() => { const v = fieldOrCol(p, "미팅날짜", 3); return typeof v === "number" ? serialToISO(v) : String(v ?? "").slice(0, 10); })(),
    계약여부: fieldOrCol(p, "계약여부", 10) === true || fieldOrCol(p, "계약여부", 10) === "TRUE",
    구분: String(fieldOrCol(p, "구분", 40) ?? "").trim(), // AO 이월 깃발
  }));
  // contracts: 수임비(E4)/구분(AI34)/계약일(C2)
  const cres = await pool.query(
    `select payload from sheet_rows where spreadsheet_id=$1 and tab='contracts' and coalesce((payload->>'_cleared')::boolean,false)=false`, [sid]);
  const contracts = cres.rows.map(({ payload: p }) => ({
    수임비: num(fieldOrCol(p, "수임비", 4)),
    구분: String(fieldOrCol(p, "구분", 34) ?? "").trim(),
    계약일: (() => { const v = fieldOrCol(p, "계약일", 2); return typeof v === "number" ? serialToISO(v) : String(v ?? "").slice(0, 10); })(),
  }));

  const alive = (s) => s === "예약" || s === "완료" || s === "계약";
  const done = (s) => s === "완료" || s === "계약";
  // channelMatrix — 생산/유입/컨택진행=sales, 미팅예약/완료/계약=미팅 카드 상태별(누적 퍼널)
  const cm = CHANNEL_ORDER.map((ch) => ({ 채널: ch, 생산: 0, 유입: 0, 컨택진행: 0, 미팅예약: 0, 미팅완료: 0, 계약: 0 }));
  const byCh = Object.fromEntries(cm.map((m) => [m.채널, m]));
  for (const r of sales) { const m = byCh[r.channel]; if (!m) continue; m.생산 += r.production; m.유입 += r.inflow; m.컨택진행 += r.contactProgress; }
  for (const mt of meetings) { const m = byCh[mt.channel]; if (!m || mt.구분 === "이월") continue; if (alive(mt.상태)) m.미팅예약 += 1; if (done(mt.상태)) m.미팅완료 += 1; if (mt.계약여부) m.계약 += 1; }
  // weeklyContracts = 상태=계약 by 미팅날짜 주차
  const wc = new Array(8).fill(0);
  for (const mt of meetings) { if (mt.상태 !== "계약" || !/^\d{4}-\d{2}-\d{2}$/.test(mt.미팅날짜 || "")) continue; const w = weekIndexOf(parseISO(mt.미팅날짜), courseStart); if (w >= 1 && w <= 8) wc[w - 1] += 1; }
  // weeklyActivity = 생산×1 + 컨택×1.5 + 미팅완료(by 미팅날짜)×2
  const wa = new Array(8).fill(0);
  for (const r of sales) { if (!CHANNEL_ORDER.includes(r.channel) || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) continue; const w = weekIndexOf(parseISO(r.date), courseStart); if (w < 1 || w > 8) continue; wa[w - 1] += r.production * 1 + r.contactProgress * 1.5; }
  for (const mt of meetings) { if (mt.구분 === "이월" || !done(mt.상태) || !/^\d{4}-\d{2}-\d{2}$/.test(mt.미팅날짜 || "")) continue; const w = weekIndexOf(parseISO(mt.미팅날짜), courseStart); if (w >= 1 && w <= 8) wa[w - 1] += 2; }
  // 누적수임비 = 이월 제외 Σ수임비 (isCarryoverContract: 구분='이월' or 계약일<courseStart)
  let fee = 0;
  for (const c of contracts) { const carry = c.구분 === "이월" || (c.계약일 && c.계약일 < courseStartISO); if (!carry) fee += c.수임비; }
  return { channelMatrix: cm, weeklyContracts: wc, weeklyActivity: wa, 누적수임비: fee };
}

const WEEK_ROWS = [38, 72, 106, 140, 174, 208, 242, 276];
async function sheetValues(sid) {
  const ranges = ["'01 영업관리'!O1", "'01 영업관리'!R1:U6", ...WEEK_ROWS.map((r) => `'01 영업관리'!N${r}`), "'대시보드(자동작성)'!C33:H40", "'대시보드(자동작성)'!B21"];
  const vr = await batchGet(sid, ranges);
  const g = (i) => vr[i]?.values ?? [];
  const courseStart = serialToISO(g(0)[0]?.[0]);
  const stk = g(1); // R1:U6
  const channelMatrix = CHANNEL_ORDER.map((ch, ci) => ({
    채널: ch, 생산: num(stk[0]?.[ci]), 유입: num(stk[1]?.[ci]), 컨택진행: num(stk[2]?.[ci]),
    미팅예약: num(stk[3]?.[ci]), 미팅완료: num(stk[4]?.[ci]), 계약: num(stk[5]?.[ci]),
  }));
  const weeklyContracts = WEEK_ROWS.map((_, i) => num(g(2 + i)[0]?.[0]));
  const wa = g(10); // C33:H40
  const weeklyActivity = Array.from({ length: 8 }, (_, w) => num(wa[w]?.[5]));
  const 누적수임비 = num(g(11)[0]?.[0]);
  return { courseStart, channelMatrix, weeklyContracts, weeklyActivity, 누적수임비 };
}

function diff(sheet, db) {
  const out = [];
  const push = (f, s, d) => { if (num(s) !== num(d)) out.push({ f, s: num(s), d: num(d) }); };
  const STAGES = ["생산", "유입", "컨택진행", "미팅예약", "미팅완료", "계약"];
  for (const ch of CHANNEL_ORDER) { const s = sheet.channelMatrix.find((m) => m.채널 === ch); const d = db.channelMatrix.find((m) => m.채널 === ch); for (const st of STAGES) push(`R1:U6.${ch}.${st}`, s?.[st] ?? 0, d?.[st] ?? 0); }
  for (let i = 0; i < 8; i++) push(`N.주${i + 1}계약`, sheet.weeklyContracts[i] ?? 0, db.weeklyContracts[i] ?? 0);
  for (let i = 0; i < 8; i++) push(`H.주${i + 1}활동`, sheet.weeklyActivity[i] ?? 0, db.weeklyActivity[i] ?? 0);
  push("B21.누적수임비", sheet.누적수임비, db.누적수임비);
  return out;
}

async function main() {
  const reg = await grid(REGISTRY_ID, "'users'!A2:R");
  const seen = new Set();
  const targets = reg.map((r) => ({
    email: String(r[0] ?? "").trim().toLowerCase(), cohort: String(r[1] ?? "").trim(), sid: String(r[3] ?? "").trim(), role: String(r[4] ?? "").trim() || "trainee",
  })).filter((u) => u.sid && COHORTS.includes(u.cohort.replace(/기\s*$/, "")) && u.role !== "trainer" && u.role !== "admin"
    && (!ONLY_USER || u.email === ONLY_USER) && !seen.has(u.sid) && seen.add(u.sid));

  console.log(`dashboard-parity: 대상 ${targets.length}명 (cohort=${COHORT}${ONLY_USER ? `, user=${ONLY_USER}` : ""})`);
  let totalDiff = 0, cleanUsers = 0;
  for (const u of targets) {
    const sheet = await sheetValues(u.sid);
    if (!sheet.courseStart) { console.log(`  ${u.email}: courseStart(O1) 없음 — 스킵`); continue; }
    const db = await dbAggregates(u.sid, parseISO(sheet.courseStart), sheet.courseStart);
    const ds = diff(sheet, db);
    totalDiff += ds.length;
    if (ds.length === 0) { cleanUsers++; console.log(`  ✅ ${u.email} (${u.cohort}) — diff 0`); }
    else {
      console.log(`  ⚠️ ${u.email} (${u.cohort}) — diff ${ds.length}:`);
      for (const x of ds.slice(0, 12)) console.log(`      ${x.f}: sheet=${x.s} db=${x.d}`);
      if (ds.length > 12) console.log(`      … 외 ${ds.length - 12}건`);
    }
  }
  console.log(`\n── 요약 ── 사용자 ${targets.length} · diff 0 사용자 ${cleanUsers} · 총 diff ${totalDiff}`);
  await pool.end();
}
main().catch((e) => { console.error("parity 실패:", (e?.message || e).replace(/postgres(ql)?:\/\/\S+/gi, "[DATABASE_URL]")); process.exit(1); });
