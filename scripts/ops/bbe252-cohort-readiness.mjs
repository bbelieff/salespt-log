#!/usr/bin/env node
/**
 * BBE-252 전용 — 읽기 전용. 비파일럿 기수 DB 전환 준비 현황.
 * 실데이터 변경 0(DB 쓰기 0·시트 쓰기 0). 고객 개인정보는 집계·해시로만 출력.
 *
 * ① 기수별 현황: 레지스트리 인원(active/archived) + DB(sheet_rows) 탭별 행수.
 * ② 샘플 parity: 기수당 최대 3명 표본 — sales/meetings/contracts 탭의 DB 행수 vs
 *    시트 실측 행수를 대조(전량 필드 대조가 아니라 belie 지시대로 "얼추" 빠른 신호 —
 *    정밀 field-diff 가 필요하면 registry-parity/dashboard-parity 를 그 사용자 범위로 재실행).
 *
 * 실행(VPS, 읽기 전용): node scripts/ops/bbe252-cohort-readiness.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
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

const REGISTRY_ID = env("SHEETS_REGISTRY_ID");
const USERS_TAB = env("SHEETS_REGISTRY_TAB") || "users";
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const SA_KEY = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
const DB_URL = env("DATABASE_URL");

// 익명 표시용 해시(email) — PII 원문 미출력.
const anon = (email) => `u-${createHash("sha256").update(String(email || "")).digest("hex").slice(0, 8)}`;

let sheets, pool;
function initClients() {
  const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
  ]);
  sheets = google.sheets({ version: "v4", auth });
  pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false }, max: 3 });
}

const s = (r, i) => String(r?.[i] ?? "").trim();

async function readRegistryUsers() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: REGISTRY_ID,
    range: `${USERS_TAB}!A2:T`,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  const rows = res.data.values ?? [];
  return rows
    .map((r) => ({
      email: s(r, 0),
      cohort: s(r, 1),
      name: s(r, 2),
      spreadsheetId: s(r, 3),
      role: s(r, 4),
      status: s(r, 5),
    }))
    .filter((u) => u.role === "trainee" && u.spreadsheetId);
}

// R2 파일럿 게이트 사본 — lib/service/daily-source.ts:12,15-18 SSOT-COPY (자립 스크립트라 import 불가).
const DB_READ_COHORTS = new Set(["8", "9", "연습"]);
function isArenaLabel(c) {
  return /^A\d+-\d+/.test(String(c).trim());
}
function isPilot(cohort) {
  const norm = String(cohort ?? "").replace(/기\s*$/, "").trim();
  return DB_READ_COHORTS.has(norm) || isArenaLabel(norm);
}

async function dbCohortTabCounts() {
  const res = await pool.query(
    `select cohort, tab, count(*)::int as n
     from sheet_rows
     where coalesce((payload->>'_cleared')::boolean, false) = false
     group by cohort, tab order by cohort, tab`,
  );
  return res.rows;
}

/** 표본 사용자 1명의 spreadsheet_id 기준 DB 행수(탭별) — cohort 합계가 아니라 그 사람 실제 값. */
async function dbUserTabCount(spreadsheetId, tab) {
  const res = await pool.query(
    `select count(*)::int as n from sheet_rows
     where spreadsheet_id = $1 and tab = $2
       and coalesce((payload->>'_cleared')::boolean, false) = false`,
    [spreadsheetId, tab],
  );
  return res.rows[0]?.n ?? 0;
}

async function liveSheetTabRowCount(spreadsheetId, tab) {
  // 탭명·좌표 = lib/config/index.ts SHEET_RANGES SSOT-COPY(자립 스크립트라 import 불가).
  const RANGES = {
    sales: "01 영업관리!E10:E349", // production 컬럼 — blockStart=10, 10주 물리범위(안전 상한)
    meetings: "04 업체관리(앱자동작성용)!A2:A5000",
    contracts: "02 계약수납관리!C6:C5000", // 계약일(autoCols.계약일) — firstDataRow=6
  };
  const range = RANGES[tab];
  if (!range) return null;
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range, valueRenderOption: "UNFORMATTED_VALUE" });
    const rows = res.data.values ?? [];
    return rows.filter((r) => String(r?.[0] ?? "").trim() !== "").length;
  } catch (e) {
    return `err:${String(e?.message ?? e).slice(0, 60)}`;
  }
}

async function main() {
  if (!REGISTRY_ID || !SA_EMAIL || !SA_KEY || !DB_URL) {
    console.error("bbe252-cohort-readiness: env 누락");
    process.exit(1);
  }
  initClients();

  const users = await readRegistryUsers();
  const byCohort = new Map();
  for (const u of users) {
    const list = byCohort.get(u.cohort) ?? [];
    list.push(u);
    byCohort.set(u.cohort, list);
  }

  console.log("\n=== ① 기수별 레지스트리 현황 ===");
  console.log("cohort | 인원(active/archived/기타) | 파일럿여부");
  for (const [cohort, list] of [...byCohort.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const active = list.filter((u) => u.status === "active").length;
    const archived = list.filter((u) => u.status === "archived").length;
    const other = list.length - active - archived;
    console.log(`  ${cohort || "(공란)"} | ${list.length}명(${active}/${archived}/${other}) | ${isPilot(cohort) ? "파일럿" : "비파일럿"}`);
  }

  console.log("\n=== ① DB(sheet_rows) 탭별 행수 — cohort 컬럼 기준 ===");
  const dbCounts = await dbCohortTabCounts();
  console.log("cohort | tab | db행수");
  for (const r of dbCounts) console.log(`  ${r.cohort} | ${r.tab} | ${r.n}`);

  const nonPilotCohorts = [...byCohort.keys()].filter((c) => !isPilot(c) && c.trim() !== "" && c !== "유보");
  console.log(`\n=== ② 샘플 parity — 비파일럿 기수(${nonPilotCohorts.join(",")}) 기수당 최대 3명 ===`);
  console.log("cohort | user(익명) | tab | sheet행수 | db행수 | 판정");
  for (const cohort of nonPilotCohorts) {
    const sample = byCohort.get(cohort).slice(0, 3);
    for (const u of sample) {
      for (const tab of ["sales", "meetings", "contracts"]) {
        const sheetN = await liveSheetTabRowCount(u.spreadsheetId, tab);
        const dbN = await dbUserTabCount(u.spreadsheetId, tab);
        let verdict;
        if (typeof sheetN !== "number") verdict = "시트읽기실패";
        else if (dbN === 0 && sheetN > 0) verdict = "DB백필없음(이 사용자)";
        else if (dbN === 0 && sheetN === 0) verdict = "둘다0(무데이터)";
        else if (Math.abs(dbN - sheetN) <= 1) verdict = "일치(±1 허용— 헤더/합계행 근사)";
        else verdict = `불일치(차이 ${Math.abs(dbN - sheetN)})`;
        console.log(`  ${cohort} | ${anon(u.email)} | ${tab} | sheet=${sheetN} | db=${dbN} | ${verdict}`);
      }
    }
  }
}

main()
  .catch((e) => {
    const msg = (e instanceof Error ? e.message : String(e)).replace(/postgres(ql)?:\/\/\S+/gi, "[DATABASE_URL]");
    console.error(`bbe252-cohort-readiness 실패: ${msg}`);
    process.exitCode = 1;
  })
  .finally(() => pool?.end().catch(() => {}));
