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

let gridFailures = 0;
/** backfill-sheet-rows.mjs grid() 와 동일 — UNFORMATTED_VALUE+SERIAL_NUMBER 필수(O1 파싱 규칙 일치).
 * 2026-08-06 사고 수정: 원래 `.catch(() => null)` 로 API 일시 오류를 조용히 삼켜 "0행"과
 * "읽기 실패"를 구분 못 했다 — 두 번 실행한 대조 결과가 매번 달라진(meetings 418→470 등)
 * 원인으로 추정. 최대 2회 재시도 + 최종 실패는 카운트해 결과에 함께 보고한다. */
async function grid(sid, range, attempt = 1) {
  try {
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: sid, range, valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "SERIAL_NUMBER",
    });
    return r?.data.values ?? [];
  } catch (e) {
    if (attempt < 3) {
      await new Promise((res) => setTimeout(res, 1000 * attempt));
      return grid(sid, range, attempt + 1);
    }
    gridFailures++;
    console.warn(`  ⚠ grid 읽기 3회 실패(sid=${sid.slice(0, 8)}…, range=${range}): ${String(e?.message ?? e).slice(0, 100)}`);
    return [];
  }
}
const serialToISO = (v) => {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const n = Number(v);
  if (!Number.isFinite(n) || n < 20000) return null;
  return new Date((n - 25569) * 86400000).toISOString().slice(0, 10);
};

const TABS = ["meetings", "contracts", "todos", "sales", "db", "company_archive"];

/** 2026-08-06 수정 — db-parity.ts(간이 판정)가 아니라 backfill-sheet-rows.mjs 의 실제
 * 행 유효성 판정을 그대로 재현한다. db-parity.ts 는 계약 헤더/예시행(첫 데이터행 이전) 구분이
 * 없고, sales 는 O1 의존·주차 stride 구조를 무시한 채 범위 전체를 세어 실측해 보니 실제
 * "백필이 놓친 것"이 아니라 "판정 기준이 백필과 달라서" 생기는 오탐이 컸다(대조 결과로 확인).
 * "백필이 스스로 정의한 대로 다 했는가"를 묻는 게 이 검증의 목적이므로 백필 기준을 따른다. */
async function countUserSheet(sid) {
  const c = { meetings: 0, contracts: 0, todos: 0, sales: 0, db: 0, company_archive: 0 };
  for (const r of await grid(sid, "'04 업체관리(앱자동작성용)'!A2:AP"))
    if (String(r[0] ?? "").trim()) c.meetings++;
  for (const r of await grid(sid, "'05 실무투두'!A2:N"))
    if (String(r[0] ?? "").trim()) c.todos++;
  for (const [tabName, firstDataRow] of [["02 계약수납관리", 6], ["02 계약관리", 5]]) {
    const rows = await grid(sid, `'${tabName}'!C1:AK`);
    if (rows.length === 0) continue;
    rows.forEach((r, i) => {
      const 계약일 = String(r[0] ?? "").trim();
      const sheetRow = i + 1;
      if (계약일 && sheetRow >= firstDataRow && !/계약일/.test(계약일)) c.contracts++;
    });
    break;
  }
  for (const [c1, c2] of [["B", "H"], ["I", "O"], ["P", "V"], ["X", "AD"]])
    for (const r of await grid(sid, `'03 DB관리'!${c1}4:${c2}100`))
      if (String(r[0] ?? "").trim()) c.db++;
  const o1 = (await grid(sid, "'01 영업관리'!O1"))[0]?.[0];
  const startISO = serialToISO(o1);
  if (startISO) {
    const block = await grid(sid, "'01 영업관리'!E10:H349");
    for (let w = 1; w <= 10; w++) {
      for (let d = 0; d < 7; d++) {
        for (let ch = 0; ch < 4; ch++) {
          const sheetRow = 10 + (w - 1) * 34 + d * 4 + ch;
          const r = block[sheetRow - 10] ?? [];
          const [E, F, G, H] = [r[0], r[1], r[2], r[3]].map((v) => String(v ?? "").trim());
          if (E === "" && F === "" && G === "" && H === "") continue;
          c.sales++;
        }
      }
    }
  }
  for (const r of await grid(sid, "'06 업체정보'!A2:AB"))
    if (String(r[2] ?? "").trim()) c.company_archive++;
  return c;
}

async function main() {
  // 2026-08-06 사고 수정: 커넥션/쿼리 타임아웃이 없어 DB 가 응답 없을 때 무한정 멈춰
  // 있었다(5시간+ 관측, 진행 로그도 없어 진단 불가). 둘 다 짧게 캡 + 진행 로그 추가.
  const pool = new Pool({
    connectionString: env("DATABASE_URL"), ssl: { rejectUnauthorized: false }, max: 3,
    connectionTimeoutMillis: 15000, statement_timeout: 30000, query_timeout: 30000,
  });
  const reg = await grid(REG, "'users'!A2:R");
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
  console.log(gridFailures > 0
    ? `⚠️ grid 읽기 3회 재시도 후에도 실패 ${gridFailures}건 — 위 시트 유효행수는 그만큼 과소집계됐을 수 있음(재실행 권장)`
    : `grid 읽기 실패 0건 — 시트 유효행수는 신뢰 가능`);

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
