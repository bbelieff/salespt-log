#!/usr/bin/env node
/**
 * R2-7a 대시보드 전수 배치 대조 (db-dashboard-aggregates 스코프4).
 *
 * 파일럿 전 사용자에 대해 대시보드 시트 수식 결과(01!R1:U6·N{38..276}·대시보드 H33:H40·B21)와
 * DB 재계산(sheet_rows sales/meetings/contracts 로부터)을 대조해 사용자×항목 diff 표를 출력.
 * lib/service/dashboard-aggregates.ts 의 4개 순수 함수를 JS 로 충실 재현(backfill 패턴).
 * 순수 로직은 dashboard-parity-lib.mjs 로 분리(테스트 가능하게 — 이 파일은 I/O 전용).
 *
 * BBE-66/63 diff 원인 자동분류(2026-08-10, belie 최우선 지시) — 손분류에 카드 하나당 4일씩
 * 쓰던 것을 없앤다. diff 가 있는 사용자만 추가로 시트 04/02 탭 **원본 행**을 읽어(쿼터 절약 —
 * 깨끗한 사용자는 추가 호출 0) 같은 집계 로직으로 재계산 → parity-classify.mjs 로 판정.
 * 시차 판정은 미팅·계약(구분/계약일/수임비) 파생 필드에만 적용 — sales(03 DB관리 4섹션 포맷) 는
 * 이번 스코프 밖(레이아웃이 더 복잡, 후속 카드로 분리 권장. 진짜불일치로 남는다).
 *
 * 실행(VPS): node scripts/ops/dashboard-parity.mjs --cohort "8,9,연습,A1-0,...,A1-6" [--user email]
 * ★URL·비밀번호·SA 키 로그 미출력. 읽기 전용(시트·DB 쓰기 없음).
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { google } from "googleapis";
import { Pool } from "pg";
import { classifyDiff, summarizeClassification } from "./parity-classify.mjs";
import {
  CHANNEL_ORDER, num, parseISO, serialToISO,
  computeAggregates, diff, buildAlternates, lookupField,
  normalizeDbMeeting, normalizeDbContract, normalizeDbSales,
  normalizeSheetMeetingRow, normalizeSheetContractRow,
  normalizeSheetSalesGrid, diffContractFingerprints, diffSourceFingerprints, safeUserKey,
  redactSensitiveLogText,
} from "./dashboard-parity-lib.mjs";

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
  const sales = sres.rows.map(({ payload: p }) => normalizeDbSales(p)).filter((r) => r.date && r.channel);
  const mres = await pool.query(
    `select payload from sheet_rows where spreadsheet_id=$1 and tab='meetings' and coalesce((payload->>'_cleared')::boolean,false)=false`, [sid]);
  const meetings = mres.rows.map(({ payload: p }) => normalizeDbMeeting(p));
  const cres = await pool.query(
    `select payload from sheet_rows where spreadsheet_id=$1 and tab='contracts' and coalesce((payload->>'_cleared')::boolean,false)=false`, [sid]);
  const contracts = cres.rows.map(({ payload: p }) => normalizeDbContract(p));
  return { sales, meetings, contracts };
}

/** 시트 04(미팅) / 02(계약) 원본 행 — DB 와 같은 정규화 형태로. diff 있는 사용자에만 호출(쿼터 절약). */
async function sheetRawMeetingRows(sid) {
  const rows = await grid(sid, "'04 업체관리(앱자동작성용)'!A2:AS");
  return rows.map(normalizeSheetMeetingRow).filter((m) => m.channel || m.상태);
}
async function sheetRawContractRows(sid) {
  const rows = await grid(sid, "'02 계약수납관리'!A6:AK");
  return rows.map(normalizeSheetContractRow).filter((c) => c.계약일);
}
async function sheetRawSalesRows(sid, courseStartISO) {
  const rows = await grid(sid, "'01 영업관리'!E10:H349");
  return normalizeSheetSalesGrid(rows, courseStartISO);
}

const WEEK_ROWS = [38, 72, 106, 140, 174, 208, 242, 276];
async function sheetFormulaValues(sid) {
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

async function main() {
  if (!COHORT) { console.error("사용법: node dashboard-parity.mjs --cohort <라벨목록> [--user email]"); process.exit(1); }
  if (!REGISTRY_ID || !SA_EMAIL || !SA_KEY || !DB_URL) { console.error("parity: env 누락(SA/레지스트리/DATABASE_URL)"); process.exit(1); }
  initClients();

  const reg = await grid(REGISTRY_ID, "'users'!A2:R");
  const seen = new Set();
  const targets = reg.map((r) => ({
    email: String(r[0] ?? "").trim().toLowerCase(), cohort: String(r[1] ?? "").trim(), sid: String(r[3] ?? "").trim(), role: String(r[4] ?? "").trim() || "trainee",
  })).filter((u) => u.sid && COHORTS.includes(u.cohort.replace(/기\s*$/, "")) && u.role !== "trainer" && u.role !== "admin"
    && (!ONLY_USER || u.email === ONLY_USER) && !seen.has(u.sid) && seen.add(u.sid));

  console.log(`dashboard-parity: 대상 ${targets.length}명 (cohort=${COHORT}${ONLY_USER ? ", user-filter=1" : ""})`);
  let totalDiff = 0, cleanUsers = 0;
  const classified = [];
  for (const u of targets) {
    const userKey = safeUserKey(u.sid);
    const sheet = await sheetFormulaValues(u.sid);
    if (!sheet.courseStart) { console.log(`  ${userKey}: courseStart(O1) 없음 — 스킵`); continue; }
    const cs = parseISO(sheet.courseStart);
    const { sales, meetings, contracts } = await dbRows(u.sid);
    const dbAgg = computeAggregates(meetings, sales, contracts, cs, sheet.courseStart);
    const ds = diff(sheet, dbAgg);
    totalDiff += ds.length;
    if (ds.length === 0) { cleanUsers++; console.log(`  ✅ ${userKey} (${u.cohort}) — diff 0`); continue; }

    console.log(`  ⚠️ ${userKey} (${u.cohort}) — diff ${ds.length}:`);
    for (const x of ds.slice(0, 12)) console.log(`      ${x.f}: sheet=${x.s} db=${x.d}`);
    if (ds.length > 12) console.log(`      … 외 ${ds.length - 12}건`);

    // diff 있는 사용자만 — 시트 04/02/01 원본 행 재계산(시차 판정용, 쿼터 절약).
    const [sheetMeetings, sheetContracts, sheetSales] = await Promise.all([
      sheetRawMeetingRows(u.sid), sheetRawContractRows(u.sid), sheetRawSalesRows(u.sid, sheet.courseStart),
    ]);
    const sheetRowAgg = computeAggregates(sheetMeetings, sheetSales, sheetContracts, cs, sheet.courseStart);

    for (const x of ds) {
      const contributingDbRows = dbAgg.contrib.get(x.f) ?? [];
      const alternates = buildAlternates(x.f);
      const sheetRowRecount = lookupField(sheetRowAgg, x.f);
      const r = classifyDiff({ field: x.f, sheetValue: x.s, dbValue: x.d }, { contributingDbRows, alternates, sheetRowRecount });
      classified.push({ user: userKey, field: x.f, sheetValue: x.s, dbValue: x.d, type: r.type, detail: r.detail });
    }

    // 진짜 불일치의 원행 방향을 개인정보 없는 지문으로 확정한다. sales/H 는 sales+meetings,
    // 계약/N 은 meetings 가 원천이다. 날짜·채널·상태·수치·구분만 출력한다.
    const hasSalesDiff = ds.some((x) => /^R1:U6\.[^.]+\.(생산|유입|컨택진행)$/.test(x.f) || /^H\.주\d+활동$/.test(x.f));
    const hasMeetingDiff = ds.some((x) => /^R1:U6\.[^.]+\.(계약|미팅예약|미팅완료)$/.test(x.f) || /^N\.주\d+계약$/.test(x.f) || /^H\.주\d+활동$/.test(x.f));
    const printSourceDiff = (label, fp) => {
      const groups = [["sheet-only(DB 누락 후보)", fp.onlyInSheet], ["DB-only(extra 후보)", fp.onlyInDb], ["건수 불일치(중복 후보)", fp.countMismatch]];
      if (groups.every(([, list]) => list.length === 0)) return;
      console.log(`      ${label} 원행 지문 차집합:`);
      for (const [name, list] of groups) {
        if (list.length === 0) continue;
        console.log(`        [${name}] ${list.length}건`);
        for (const e of list.slice(0, 8)) console.log(`          ${e.fingerprint} (sheet=${e.sheetCount} db=${e.dbCount})`);
        if (list.length > 8) console.log(`          … 외 ${list.length - 8}건`);
      }
    };
    if (hasSalesDiff) printSourceDiff("sales", diffSourceFingerprints("sales", sheetSales, sales));
    if (hasMeetingDiff) printSourceDiff("meetings", diffSourceFingerprints("meetings", sheetMeetings, meetings));

    // B21(누적수임비) diff 전용 — belie 지시(2026-08-10): "DB가 정본"이라고 선언 금지, 계약
    // 지문(계약일·수임비·구분) 차집합으로 어느 쪽에 어떤 행이 몇 건 더/덜 있는지 확정만 한다.
    // 개인정보(이름·이메일·회사명·행 인덱스) 없음 — sheetContracts/dbAgg.contrib 는 이미 정규화됨.
    const b21Diff = ds.find((x) => x.f === "B21.누적수임비");
    if (b21Diff) {
      const dbContracts = dbAgg.contrib.get("B21.누적수임비") ?? [];
      const fp = diffContractFingerprints(sheetContracts, dbContracts);
      console.log(`      B21 계약 지문 차집합 (sheet=${b21Diff.s} db=${b21Diff.d}, diff=${b21Diff.d - b21Diff.s}):`);
      const printGroup = (label, list) => {
        if (list.length === 0) return;
        console.log(`        [${label}] ${list.length}건`);
        for (const e of list.slice(0, 5)) {
          console.log(`          계약일=${e.계약일} 수임비=${e.수임비} 구분=${e.구분 ?? "-"}` +
            (e.sheetCount !== undefined ? ` (sheet=${e.sheetCount}건 db=${e.dbCount}건)` : "") +
            (e.detail ? ` — ${e.detail}` : ""));
        }
        if (list.length > 5) console.log(`          … 외 ${list.length - 5}건`);
      };
      printGroup("sheet 에만 있음(DB 누락 후보)", fp.onlyInSheet);
      printGroup("DB 에만 있음(DB extra·중복 후보)", fp.onlyInDb);
      printGroup("둘 다 있는데 건수(중복) 다름", fp.countMismatch);
      printGroup("구분(이월 판정) 드리프트 후보", fp.typeDrift);
      if (fp.onlyInSheet.length + fp.onlyInDb.length + fp.countMismatch.length === 0) {
        console.log("        지문 차집합 0건 — 개별 계약 단위로는 안 잡힘(합산·반올림 등 다른 원인 의심)");
      }
    }
  }
  console.log(`\n── 요약 ── 사용자 ${targets.length} · diff 0 사용자 ${cleanUsers} · 총 diff ${totalDiff}`);
  if (classified.length > 0) console.log(summarizeClassification(classified).text);
  await pool.end();
}

// Windows 에서 file:// URL 과 process.argv[1] 슬래시/인코딩 차이로 문자열 비교가 항상 거짓이 되는
// 함정을 피하려고 경로 비교(backfill-db-row-numbers.mjs 와 동일 패턴) — import 시 부작용 없음.
const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch((e) => { console.error("parity 실패:", redactSensitiveLogText(e?.message || e)); process.exit(1); });
}
