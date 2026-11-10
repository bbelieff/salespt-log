/**
 * ADR-0038 5단계 — 기수를 시트에서 떼어 내기 전 대조: 수강생 시트마다 유효 행수 vs DB(sheet_rows) 행수.
 * 떼어 내면 앱이 시트 보충 읽기를 멈추므로, 시트에만 있는 행(DB 가 더 적음)이 있으면 그 기록이 앱에서 사라진다.
 * 행 판정은 a2-db-parity.mjs(백필 기준) 그대로. 읽기 전용(SELECT/values.get 만). VPS 에서 실행.
 *   node scripts/ops/cohort-detach-parity.mjs --cohort 4
 * 출력에 이름·이메일·시트 ID 를 남기지 않는다(공개 저장소 Actions 로그) — 수강생은 순번(#1..)으로만.
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

const auth = new google.auth.JWT(
  env("GOOGLE_SERVICE_ACCOUNT_EMAIL"), undefined,
  env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n"),
  ["https://www.googleapis.com/auth/spreadsheets.readonly"],
);
const sheets = google.sheets({ version: "v4", auth });

let gridFailures = 0;
let gridMissingTab = 0;
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
/** backfill-sheet-rows.mjs grid() 와 동일 — UNFORMATTED_VALUE+SERIAL_NUMBER 필수(O1 파싱 규칙 일치).
 * 2026-08-06 사고 수정 ①: 원래 `.catch(() => null)` 로 API 일시 오류를 조용히 삼켜 "0행"과
 * "읽기 실패"를 구분 못 했다 — 두 번 실행한 대조 결과가 매번 달라진(meetings 418→470 등) 원인.
 * 2026-08-06 사고 수정 ②(1차 재시도 후 재실측): 실패 50건 중 대부분이 "Unable to parse range"
 * (그 시트에 해당 탭 자체가 없음 — 옛 템플릿 복사본, 영구적·재시도 무의미. backfill 도 같은
 * grid() 라 동일하게 못 읽었을 것이므로 사람쪽·DB쪽 둘 다 0으로 수렴해 실제로는 무해)이고,
 * 나머지는 "Quota exceeded"(진짜 일시 장애인데 1~2초 백오프로는 분당 quota 리셋을 못 기다림).
 * 탭 없음은 즉시 포기(재시도 낭비 안 함), quota 는 15~30초로 늘려 재시도한다. */
async function grid(sid, range, attempt = 1) {
  try {
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: sid, range, valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "SERIAL_NUMBER",
    });
    return r?.data.values ?? [];
  } catch (e) {
    const msg = String(e?.message ?? e);
    if (/Unable to parse range/.test(msg)) { gridMissingTab++; return []; } // 탭 없음 — 영구적, 재시도 안 함
    if (attempt < 3) {
      await sleep(/Quota exceeded/.test(msg) ? 15000 * attempt : 1000 * attempt);
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

const COHORT_SQL = `regexp_replace(case when cohort in ('유보','') then cohort_label else cohort end, '기[[:space:]]*$', '')`;

async function main() {
  const arg = process.argv.indexOf("--cohort");
  const cohort = String(arg >= 0 ? process.argv[arg + 1] ?? "" : "").replace(/기\s*$/, "").trim();
  if (!/^[0-9]+$/.test(cohort)) throw new Error("--cohort <숫자 기수> 필요");
  const pool = new Pool({
    connectionString: env("DATABASE_URL"), ssl: { rejectUnauthorized: false }, max: 3,
    connectionTimeoutMillis: 15000, statement_timeout: 30000, query_timeout: 30000,
  });
  // 명단 정본 = DB users. 유보 수강생은 원래 기수(cohort_label) — 앱 sourceCohort 와 같은 규칙.
  const users = (await pool.query(
    `select distinct spreadsheet_id from users
     where role = 'trainee' and spreadsheet_id <> '' and spreadsheet_id not like 'local:%'
       and ${COHORT_SQL} = $1`,
    [cohort],
  )).rows.map((r) => String(r.spreadsheet_id));
  // 같은 시트를 다른 기수(아레나 등) 행도 쓰면 앱은 떼어 내지 않는다(lib/repo/sheet-detach.ts).
  const shared = new Set((await pool.query(
    `select distinct spreadsheet_id from users where spreadsheet_id = any($1) and ${COHORT_SQL} <> $2`,
    [users, cohort],
  )).rows.map((r) => String(r.spreadsheet_id)));
  console.log(`${cohort}기 시트 ${users.length}개 (다른 기수와 공유 ${shared.size}개 — 떼어 내기 대상 아님)\n`);
  const db = new Map();
  for (const r of (await pool.query(
    `select spreadsheet_id, tab, count(*)::int as n from sheet_rows
     where spreadsheet_id = any($1) and coalesce((payload->>'_cleared')::boolean,false)=false
     group by spreadsheet_id, tab`, [users],
  )).rows) db.set(`${r.spreadsheet_id}|${r.tab}`, r.n);
  await pool.end();

  const sheetTotals = {}, dbTotals = {};
  const short = [];
  let i = 0;
  for (const sid of users) {
    i++;
    const c = await countUserSheet(sid);
    for (const t of TABS) {
      const d = db.get(`${sid}|${t}`) ?? 0;
      sheetTotals[t] = (sheetTotals[t] ?? 0) + c[t];
      dbTotals[t] = (dbTotals[t] ?? 0) + d;
      if (d < c[t]) short.push(`#${i}${shared.has(sid) ? "(공유)" : ""} ${t}: 시트 ${c[t]} > DB ${d}`);
    }
  }
  console.log("── 대조 표 (탭 | 시트 유효행수 | DB 행수) ──");
  for (const t of TABS) console.log(`${t.padEnd(16)} | ${String(sheetTotals[t] ?? 0).padStart(5)} | ${String(dbTotals[t] ?? 0).padStart(5)}`);
  console.log(`\n탭 없음 ${gridMissingTab}건 · 진짜 읽기실패 ${gridFailures}건`);
  if (gridFailures > 0) console.log("⚠️ 읽기실패가 있어 시트 행수가 과소집계됐을 수 있음 — 재실행 권장");
  if (short.length === 0 && gridFailures === 0) {
    console.log("✅ 시트에만 있는 행 없음 — 떼어 내도 앱에서 사라지는 기록 없음(행 수 기준)");
  } else {
    console.log(`⚠️ 시트에만 있는 행 의심 ${short.length}건(수강생 순번만 표시):`);
    short.forEach((s) => console.log(`  ${s}`));
  }
}
main().catch((e) => {
  const msg = (e instanceof Error ? e.message : String(e)).replace(/postgres(ql)?:\/\/\S+/gi, "[DATABASE_URL]");
  console.error("대조 실패:", msg);
  process.exit(1);
});
