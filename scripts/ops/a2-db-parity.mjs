/**
 * A2 백필 완주 검증 — 시트 유효 행수 vs DB(sheet_rows) 행수 대조 (BBE-50 완료 조건).
 * 읽기 전용(SELECT/values.get 만). VPS 에서 실행(SA·DATABASE_URL 필요).
 *   node scripts/ops/a2-db-parity.mjs
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
const mask = (e) => (e ? e.replace(/^(.{2}).*(@.*)$/, "$1***$2") : "");

const REG = env("SHEETS_REGISTRY_ID");
const auth = new google.auth.JWT(
  env("GOOGLE_SERVICE_ACCOUNT_EMAIL"), undefined,
  env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n"),
  ["https://www.googleapis.com/auth/spreadsheets.readonly"],
);
const sheets = google.sheets({ version: "v4", auth });

async function safeRows(sid, range) {
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: sid, range }).catch(() => null);
  return r?.data.values ?? [];
}

const TABS = ["meetings", "contracts", "todos", "sales", "db", "company_archive"];

/** db-parity.ts countUserSheet 와 동일 판정 — 배포된 앱과 같은 기준이어야 "완주 검증"이 의미 있다. */
async function countUserSheet(sid) {
  const c = { meetings: 0, contracts: 0, todos: 0, sales: 0, db: 0, company_archive: 0 };
  for (const r of await safeRows(sid, "'04 업체관리(앱자동작성용)'!A2:A")) if (r[0]?.trim()) c.meetings++;
  for (const r of await safeRows(sid, "'05 실무투두'!A2:A")) if (r[0]?.trim()) c.todos++;
  for (const tab of ["02 계약수납관리", "02 계약관리"]) {
    const rows = await safeRows(sid, `'${tab}'!C3:C`);
    if (rows.length === 0) continue;
    for (const r of rows) { const v = r[0]?.trim() ?? ""; if (v && !/계약일/.test(v)) c.contracts++; }
    break;
  }
  for (const col of ["B", "I", "P", "X"])
    for (const r of await safeRows(sid, `'03 DB관리'!${col}4:${col}100`)) if (r[0]?.trim()) c.db++;
  for (const r of await safeRows(sid, "'01 영업관리'!E10:H349"))
    if ((r[0] ?? r[1] ?? r[2] ?? r[3] ?? "").toString().trim()) c.sales++;
  for (const r of await safeRows(sid, "'06 업체정보'!C2:C")) if (r[0]?.trim()) c.company_archive++;
  return c;
}

async function main() {
  // 2026-08-06 사고 수정: 커넥션/쿼리 타임아웃이 없어 DB 가 응답 없을 때 무한정 멈춰
  // 있었다(5시간+ 관측, 진행 로그도 없어 진단 불가). 둘 다 짧게 캡 + 진행 로그 추가.
  const pool = new Pool({
    connectionString: env("DATABASE_URL"), ssl: { rejectUnauthorized: false }, max: 3,
    connectionTimeoutMillis: 15000, statement_timeout: 30000, query_timeout: 30000,
  });
  const reg = await safeRows(REG, "'users'!A2:R");
  const targets = reg
    .map((r) => ({ email: String(r[0] ?? "").trim(), cohort: String(r[1] ?? "").trim(), name: String(r[2] ?? "").trim(), sid: String(r[3] ?? "").trim(), role: String(r[4] ?? "").trim() }))
    .filter((u) => u.sid && u.role === "trainee" && /^A2-/.test(u.cohort));
  console.log(`A2 대상 시트 ${targets.length}개\n`);

  const sheetTotals = {};
  const perPerson = [];
  let i = 0;
  for (const u of targets) {
    const c = await countUserSheet(u.sid);
    for (const t of TABS) sheetTotals[t] = (sheetTotals[t] ?? 0) + c[t];
    perPerson.push({ email: mask(u.email), cohort: u.cohort, name: u.name, ...c });
    i++;
    if (i % 10 === 0 || i === targets.length) console.log(`  ...시트 스캔 ${i}/${targets.length}`);
  }
  console.log("DB 조회 시작...");

  const dbRes = await pool.query(
    `select cohort, tab, count(*)::int as n from sheet_rows
     where cohort like 'A2-%' and coalesce((payload->>'_cleared')::boolean,false)=false
     group by cohort, tab`,
  );
  await pool.end();
  const dbTotals = {};
  for (const r of dbRes.rows) dbTotals[r.tab] = (dbTotals[r.tab] ?? 0) + r.n;

  console.log("── 대조 표 (탭 | 시트 유효행수 | DB 행수 | 차이) ──");
  let allMatch = true;
  for (const t of TABS) {
    const s = sheetTotals[t] ?? 0, d = dbTotals[t] ?? 0, diff = d - s;
    if (diff !== 0) allMatch = false;
    console.log(`${t.padEnd(16)} | ${String(s).padStart(5)} | ${String(d).padStart(5)} | ${diff === 0 ? "일치" : diff > 0 ? `+${diff}` : diff}`);
  }
  console.log(`\n${allMatch ? "✅ 전 탭 일치 — 백필 완주 확인" : "⚠️ 불일치 있음 — 아래 사람별 내역에서 원인 확인 필요"}`);

  const noSales = perPerson.filter((p) => p.sales === 0);
  if (noSales.length) {
    console.log(`\n(참고) sales 탭 시트값 자체가 0인 사람 ${noSales.length}명(개막 전이라 정상일 수 있음):`);
    noSales.forEach((p) => console.log(`  ${p.cohort} ${p.name}`));
  }
}
main().catch((e) => {
  const msg = (e instanceof Error ? e.message : String(e)).replace(/postgres(ql)?:\/\/\S+/gi, "[DATABASE_URL]");
  console.error("검증 실패:", msg);
  process.exit(1);
});
