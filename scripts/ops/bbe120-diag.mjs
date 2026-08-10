#!/usr/bin/env node
/**
 * BBE-120 근인 조사 전용 — 읽기 전용 진단. parity 감사도구(BBE-66 소유, dashboard-parity*.mjs·
 * parity-classify.mjs)와 무관한 별도 스크립트 — 그 파일들은 무접촉.
 *
 * 목적: 잔여 20건 diff 의 실제 DB row 형태를 눈으로 확인한다.
 *   --mode=sales-rows   : 지정 사용자의 sales(01 영업관리) sheet_rows 원본 행을 채널·주차별로
 *                         나열 — 갈래 A(sheet<db, 중복적재 의심) 의 실제 row_key 중복 여부 확인.
 *   --mode=contract-row : 지정 사용자의 contracts(02) sheet_rows 원본 행을 계약일 범위로 나열 —
 *                         B21 550,000 케이스의 실제 payload(전체 필드) 확인.
 *   --mode=meeting-row  : 지정 사용자의 meetings(04) sheet_rows 원본 행을 주차·상태로 나열 —
 *                         갈래 B/C(sheet>db, 계약 결측) 의 실제 존재 여부 확인.
 *
 * 실행(VPS, 읽기 전용 — 쓰기 없음): node scripts/ops/bbe120-diag.mjs --user <email> --mode <mode>
 * ★ raw payload 를 그대로 출력한다 — 이 스크립트의 출력은 Linear 에 그대로 올리지 말고
 *   로컬에서 판독 후 필드명·건수·플래그만 요약해서 올릴 것(개인정보 원문 금지 원칙).
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
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

const USER = (process.argv.includes("--user") ? process.argv[process.argv.indexOf("--user") + 1] : "").trim().toLowerCase();
const MODE = (process.argv.includes("--mode") ? process.argv[process.argv.indexOf("--mode") + 1] : "").trim();

const REGISTRY_ID = env("SHEETS_REGISTRY_ID");
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const SA_KEY = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
const DB_URL = env("DATABASE_URL");

let sheets, pool;
function initClients() {
  const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, ["https://www.googleapis.com/auth/spreadsheets.readonly"]);
  sheets = google.sheets({ version: "v4", auth });
  pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false }, max: 2 });
}

async function grid(sid, range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sid, range, valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "SERIAL_NUMBER",
  }).catch(() => null);
  return res?.data.values ?? [];
}

async function findSid(email) {
  const reg = await grid(REGISTRY_ID, "'users'!A2:R");
  const row = reg.find((r) => String(r[0] ?? "").trim().toLowerCase() === email);
  if (!row) throw new Error(`registry 에 이메일 없음: ${email}`);
  return String(row[3] ?? "").trim();
}

// PII 필드는 값을 마스킹하고 존재 여부만 남긴다 — 회사명·담당자명·연락처 등 원문 미출력.
const PII_KEYS = /^(업체명|담당자|연락처|이름|email|메모|memo|주소|이메일)$/i;
function redact(payload) {
  const out = {};
  for (const [k, v] of Object.entries(payload ?? {})) {
    out[k] = PII_KEYS.test(k) ? "[REDACTED]" : v;
  }
  return out;
}

async function main() {
  if (!USER || !MODE) { console.error("사용법: node bbe120-diag.mjs --user <email> --mode sales-rows|contract-row|meeting-row"); process.exit(1); }
  if (!REGISTRY_ID || !SA_EMAIL || !SA_KEY || !DB_URL) { console.error("env 누락"); process.exit(1); }
  initClients();
  const sid = await findSid(USER);
  console.log(`대상: ${USER} · spreadsheetId=${sid}`);

  if (MODE === "sales-rows") {
    const res = await pool.query(
      `select row_key, payload from sheet_rows where spreadsheet_id=$1 and tab='sales'
       and coalesce((payload->>'_cleared')::boolean,false)=false order by row_key`,
      [sid],
    );
    console.log(`DB sales 행 수: ${res.rows.length}`);
    // row_key = "{date}:{channel}" — 같은 (date,channel) 이 2개 이상 row_key 로 존재하면 그 자체가
    // 이상(유니크 제약이 있으므로 정의상 불가능해야 함) — 대신 날짜별 채널 분포로 이상 패턴을 본다.
    const byKey = new Map();
    for (const r of res.rows) byKey.set(r.row_key, (byKey.get(r.row_key) ?? 0) + 1);
    const dups = [...byKey.entries()].filter(([, c]) => c > 1);
    console.log(`row_key 중복(있으면 이상, unique 제약상 불가해야 함): ${dups.length}건`, dups);
    for (const r of res.rows) {
      console.log(`  ${r.row_key} :: ${JSON.stringify(redact(r.payload))}`);
    }
  } else if (MODE === "contract-row") {
    const res = await pool.query(
      `select row_key, payload from sheet_rows where spreadsheet_id=$1 and tab='contracts'
       and coalesce((payload->>'_cleared')::boolean,false)=false order by row_key`,
      [sid],
    );
    console.log(`DB contracts 행 수: ${res.rows.length}`);
    for (const r of res.rows) {
      console.log(`  ${r.row_key} :: ${JSON.stringify(redact(r.payload))}`);
    }
    console.log("--- 시트 원본(02 계약수납관리 A6:AK) ---");
    const rows = await grid(sid, "'02 계약수납관리'!A6:AK");
    rows.forEach((r, i) => {
      const 계약일 = r[2], 수임비 = r[4], 구분 = r[34];
      if (계약일 !== undefined && 계약일 !== "") console.log(`  row${i + 6}: 계약일=${계약일} 수임비=${수임비} 구분=${구분}`);
    });
  } else if (MODE === "meeting-row") {
    const res = await pool.query(
      `select row_key, payload from sheet_rows where spreadsheet_id=$1 and tab='meetings'
       and coalesce((payload->>'_cleared')::boolean,false)=false order by row_key`,
      [sid],
    );
    console.log(`DB meetings 행 수: ${res.rows.length}`);
    const 계약행 = res.rows.filter((r) => {
      const p = r.payload;
      const status = p["상태"] ?? p["J"];
      return status === "계약";
    });
    console.log(`DB 상 상태=계약 행 수: ${계약행.length}`);
    for (const r of 계약행) console.log(`  ${r.row_key} :: ${JSON.stringify(redact(r.payload))}`);
    console.log("--- 시트 원본(04 업체관리 A2:AS) 상태=계약 행만 ---");
    const rows = await grid(sid, "'04 업체관리(앱자동작성용)'!A2:AS");
    rows.forEach((r, i) => {
      const id = r[0], status = r[9], channel = r[5], 미팅날짜 = r[3], 구분 = r[40];
      if (status === "계약") console.log(`  row${i + 2}: id=${id} channel=${channel} 미팅날짜=${미팅날짜} 구분=${구분}`);
    });
  } else {
    console.error("알 수 없는 mode:", MODE);
    process.exit(1);
  }
  await pool.end();
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch((e) => { console.error("실패:", (e?.message || e).replace(/postgres(ql)?:\/\/\S+/gi, "[DATABASE_URL]")); process.exit(1); });
}
