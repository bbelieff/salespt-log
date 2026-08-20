#!/usr/bin/env node
/**
 * BBE-258 전용 — 읽기 전용. BBE-252 샘플 parity 의 sales 4/4 불일치 원인 규명.
 * 실데이터 변경 0(DB 쓰기 0·시트 쓰기 0). 개인정보는 해시·집계로만 출력.
 *
 * 가설 순서(카드 지시):
 *   ① 측정기 차이 — bbe252-cohort-readiness.mjs 는 sales 를 "E열(생산)만 non-empty 카운트"로
 *      근사했다. 그러나 정본 비교기(bbe120-diag.mjs sales-crosscheck, BBE-120 검증필)는
 *      "E~H(생산·유입·컨택진행·미팅예약) 중 하나라도 non-empty" 를 기준으로 (date,channel)
 *      row_key 를 재구성한다(lib/repo/sales.ts:379 row_key=`{date}:{channel}` 와 동일 키 체계).
 *      이 스크립트는 같은 표본에 대해 **구법(E열만)과 정본법(E~H) 을 나란히 계산**해
 *      측정기 차이가 불일치의 몇 %를 설명하는지 직접 수치로 보여준다.
 *   ② 정본법으로도 남는 진짜 드리프트(missingInDb/orphanInDb) 를 기수·건수로 분포 확인.
 *   ③ 표본 중 드리프트가 남는 건은 row_key 단위로 원문(비PII 필드만) 출력 — 어디서 갈라지는지.
 *
 * 실행(VPS, 읽기 전용): node scripts/ops/bbe258-sales-drift.mjs
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

const anon = (spreadsheetId) => `sid-${createHash("sha256").update(String(spreadsheetId || "")).digest("hex").slice(0, 8)}`;
// PII 필드는 값을 마스킹 — bbe120-diag.mjs 와 동일 규칙.
const PII_KEYS = /^(업체명|담당자|연락처|이름|email|메모|memo|주소|이메일)$/i;
function redact(payload) {
  const out = {};
  for (const [k, v] of Object.entries(payload ?? {})) out[k] = PII_KEYS.test(k) ? "[REDACTED]" : v;
  return out;
}

let sheets, pool;
function initClients() {
  const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
  ]);
  sheets = google.sheets({ version: "v4", auth });
  pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false }, max: 3 });
}

const s = (r, i) => String(r?.[i] ?? "").trim();

async function grid(sid, range) {
  const res = await sheets.spreadsheets.values
    .get({ spreadsheetId: sid, range, valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "SERIAL_NUMBER" })
    .catch((e) => ({ __err: String(e?.message ?? e).slice(0, 80) }));
  if (res?.__err) return { err: res.__err };
  return { rows: res.data.values ?? [] };
}

function serialToISO(v) {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const n = Number(v);
  if (!Number.isFinite(n) || n < 20000) return null;
  return new Date((n - 25569) * 86400000).toISOString().slice(0, 10);
}

const CH = ["매입DB", "직접생산", "현수막", "콜·지·기·소"];

async function readRegistryUsers() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: REGISTRY_ID,
    range: `${USERS_TAB}!A2:T`,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  const rows = res.data.values ?? [];
  return rows
    .map((r) => ({ cohort: s(r, 1), spreadsheetId: s(r, 3), role: s(r, 4), status: s(r, 5) }))
    .filter((u) => u.role === "trainee" && u.spreadsheetId);
}

/** 정본법(E~H 중 하나라도 non-empty) — bbe120-diag.mjs sales-crosscheck 이식, O1 기준 날짜 재구성. */
async function reconstructSheetKeys(sid) {
  const o1res = await grid(sid, "'01 영업관리'!O1");
  if (o1res.err) return { err: `O1 읽기 실패: ${o1res.err}` };
  const startISO = serialToISO(o1res.rows[0]?.[0]);
  if (!startISO) return { err: "O1 파싱 실패(수강시작일 공란/이상값)" };
  const start = new Date(startISO + "T00:00:00Z");
  const blockRes = await grid(sid, "'01 영업관리'!E10:H349");
  if (blockRes.err) return { err: `E10:H349 읽기 실패: ${blockRes.err}` };
  const block = blockRes.rows;
  const sheetVals = new Map();
  let legacyEOnlyCount = 0; // 구법(bbe252) 근사 — E열만 non-empty 카운트
  for (let w = 1; w <= 10; w++) {
    for (let d = 0; d < 7; d++) {
      for (let c = 0; c < 4; c++) {
        const sheetRow = 10 + (w - 1) * 34 + d * 4 + c;
        const r = block[sheetRow - 10] ?? [];
        const [E, F, G, H] = [r[0], r[1], r[2], r[3]].map((v) => String(v ?? "").trim());
        if (E !== "") legacyEOnlyCount++;
        if (E === "" && F === "" && G === "" && H === "") continue;
        const date = new Date(start.getTime() + ((w - 1) * 7 + d) * 86400000).toISOString().slice(0, 10);
        sheetVals.set(`${date}:${CH[c]}`, {
          production: E === "" ? undefined : Number(E),
          inflow: F === "" ? undefined : Number(F),
          contactProgress: G === "" ? undefined : Number(G),
          meetingReservation: H === "" ? undefined : Number(H),
        });
      }
    }
  }
  return { startISO, sheetVals, legacyEOnlyCount };
}

async function auditUser(u) {
  const label = anon(u.spreadsheetId);
  console.log(`\n--- ${u.cohort} | ${label} ---`);
  const recon = await reconstructSheetKeys(u.spreadsheetId);
  if (recon.err) {
    console.log(`  ${recon.err}`);
    return;
  }
  const { startISO, sheetVals, legacyEOnlyCount } = recon;
  const sheetKeys = new Set(sheetVals.keys());

  const res = await pool.query(
    `select row_key, payload from sheet_rows where spreadsheet_id=$1 and tab='sales'
     and coalesce((payload->>'_cleared')::boolean,false)=false`,
    [u.spreadsheetId],
  );
  const dbKeys = new Set(res.rows.map((r) => r.row_key));

  const orphanInDb = [...dbKeys].filter((k) => !sheetKeys.has(k)); // DB에만(고아/중복 후보)
  const missingInDb = [...sheetKeys].filter((k) => !dbKeys.has(k)); // 시트에만(백필 갭 후보)

  console.log(`  O1(수강시작일)=${startISO}`);
  console.log(
    `  구법(bbe252, E열만 카운트)=${legacyEOnlyCount} | 정본법(E~H, row_key 수)=${sheetKeys.size} | DB row_key 수=${dbKeys.size}`,
  );
  console.log(
    `  정본법 대조: DB에만(고아) ${orphanInDb.length}건 · 시트에만(백필갭 후보) ${missingInDb.length}건`,
  );

  const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : Number.isFinite(Number(v)) ? Number(v) : 0);
  const FIELDS = ["production", "inflow", "contactProgress", "meetingReservation"];
  let valueMismatches = 0;
  for (const r of res.rows) {
    const sv = sheetVals.get(r.row_key);
    if (!sv) continue;
    for (const f of FIELDS) {
      if (num(sv[f]) !== num(r.payload[f])) valueMismatches++;
    }
  }
  console.log(`  값 불일치(같은 row_key, 필드값 다름): ${valueMismatches}건`);

  // 심층 해부용 — 잔여 드리프트가 있으면 상위 5건만 원문(비PII) 출력.
  if (missingInDb.length > 0) {
    console.log(`  시트에만 있는 row_key(상위 5): ${missingInDb.slice(0, 5).join(", ")}`);
  }
  if (orphanInDb.length > 0) {
    console.log(`  DB에만 있는 row_key(상위 5, payload):`);
    for (const k of orphanInDb.slice(0, 5)) {
      const row = res.rows.find((r) => r.row_key === k);
      console.log(`    ${k} :: ${JSON.stringify(redact(row.payload))} (_backfill=${row.payload._backfill ?? false})`);
    }
  }
}

async function main() {
  if (!REGISTRY_ID || !SA_EMAIL || !SA_KEY || !DB_URL) {
    console.error("bbe258-sales-drift: env 누락");
    process.exit(1);
  }
  initClients();
  const users = await readRegistryUsers();
  const TARGET_COHORTS = ["4", "6", "7", "10"];
  const byCohort = new Map();
  for (const u of users) {
    if (!TARGET_COHORTS.includes(u.cohort)) continue;
    const list = byCohort.get(u.cohort) ?? [];
    list.push(u);
    byCohort.set(u.cohort, list);
  }

  console.log("=== BBE-258 sales 측정기차이+드리프트 심층 해부 ===");
  for (const cohort of TARGET_COHORTS) {
    const sample = (byCohort.get(cohort) ?? []).slice(0, 2); // 기수당 최대 2명 — 카드 "표본 3건" 취지, 4기수 커버 우선
    for (const u of sample) await auditUser(u);
  }
}

main()
  .catch((e) => {
    const msg = (e instanceof Error ? e.message : String(e)).replace(/postgres(ql)?:\/\/\S+/gi, "[DATABASE_URL]");
    console.error(`bbe258-sales-drift 실패: ${msg}`);
    process.exitCode = 1;
  })
  .finally(() => pool?.end().catch(() => {}));
