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
 *   --mode=sales-crosscheck : 현재 시트 O1 기준으로 01 영업관리 E10:H349 를 재구성해 기대
 *                         row_key 집합을 만들고, DB sales row_key 집합과 직접 대조 — DB 에만
 *                         있는(=현재 시트 어느 셀과도 안 맞는) 행을 "고아 행" 후보로 뽑는다.
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

/** FORMULA 렌더옵션 — 셀에 저장된 수식 문자열 그대로(값 아님). */
async function gridFormula(sid, range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sid, range, valueRenderOption: "FORMULA",
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

const CH = ["매입DB", "직접생산", "현수막", "콜·지·기·소"];
function serialToISO(v) {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const n = Number(v);
  if (!Number.isFinite(n) || n < 20000) return null;
  return new Date((n - 25569) * 86400000).toISOString().slice(0, 10);
}

async function main() {
  if (!USER || !MODE) { console.error("사용법: node bbe120-diag.mjs --user <email> --mode sales-rows|contract-row|meeting-row|sales-crosscheck|formula-check"); process.exit(1); }
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
  } else if (MODE === "sales-crosscheck") {
    // 현재 시트 원본(01 영업관리 E10:H349, backfill 과 동일 좌표식)을 현재 O1 기준으로
    // (date,channel) row_key 집합으로 재구성 → DB sales row_key 집합과 직접 대조.
    // DB 에만 있는 row_key = 지금 시트 어느 셀로도 매핑 안 되는 "고아" 행(중복적재/구시대 O1 흔적 후보).
    const o1 = (await grid(sid, "'01 영업관리'!O1"))[0]?.[0];
    const startISO = serialToISO(o1);
    if (!startISO) { console.error("O1 파싱 실패"); process.exit(1); }
    console.log(`현재 O1(수강시작일)=${startISO}`);
    const start = new Date(startISO + "T00:00:00Z");
    const block = await grid(sid, "'01 영업관리'!E10:H349");
    const sheetVals = new Map(); // row_key -> {production,inflow,contactProgress,meetingReservation}
    for (let w = 1; w <= 10; w++) {
      for (let d = 0; d < 7; d++) {
        for (let c = 0; c < 4; c++) {
          const sheetRow = 10 + (w - 1) * 34 + d * 4 + c;
          const r = block[sheetRow - 10] ?? [];
          const [E, F, G, H] = [r[0], r[1], r[2], r[3]].map((v) => String(v ?? "").trim());
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
    const sheetKeys = new Set(sheetVals.keys());
    console.log(`현재 시트 비어있지 않은 셀 수(=기대 row_key 수): ${sheetKeys.size}`);
    const res = await pool.query(
      `select row_key, payload from sheet_rows where spreadsheet_id=$1 and tab='sales'
       and coalesce((payload->>'_cleared')::boolean,false)=false`,
      [sid],
    );
    const dbKeys = new Set(res.rows.map((r) => r.row_key));
    console.log(`DB row_key 수: ${dbKeys.size}`);
    const orphanInDb = [...dbKeys].filter((k) => !sheetKeys.has(k));
    const missingInDb = [...sheetKeys].filter((k) => !dbKeys.has(k));
    console.log(`DB 에만 있음(현재 시트 어느 셀과도 매핑 안 됨 — 중복적재/구 O1 흔적 후보): ${orphanInDb.length}건`);
    for (const k of orphanInDb) {
      const row = res.rows.find((r) => r.row_key === k);
      console.log(`  ${k} :: ${JSON.stringify(redact(row.payload))}`);
    }
    console.log(`시트에만 있음(DB 미기록 후보): ${missingInDb.length}건`);
    for (const k of missingInDb) console.log(`  ${k}`);

    // 값 대조 — row_key 는 일치해도 payload 의 값 자체가 지금 시트 셀과 다를 수 있다
    // (예: backfill 이후 시트가 수동으로 수정됐는데 DB 가 재동기화 안 된 stale 값 후보).
    const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : Number.isFinite(Number(v)) ? Number(v) : 0);
    const FIELDS = ["production", "inflow", "contactProgress", "meetingReservation"];
    let valueMismatches = 0;
    for (const r of res.rows) {
      const sv = sheetVals.get(r.row_key);
      if (!sv) continue; // orphan — 이미 위에서 다룸
      for (const f of FIELDS) {
        const sheetV = num(sv[f]);
        const dbV = num(r.payload[f]);
        if (sheetV !== dbV) {
          valueMismatches++;
          console.log(`  값 불일치 ${r.row_key}.${f}: 시트=${sheetV} db=${dbV} (db payload _backfill=${r.payload._backfill ?? false})`);
        }
      }
    }
    console.log(`값 불일치(row_key 는 같은데 필드값이 다름): ${valueMismatches}건`);
  } else if (MODE === "formula-check") {
    // R1:U6(채널 매트릭스)·C33:H40(주차활동)·B21(누적수임비) 의 실제 수식 텍스트를 그대로 출력.
    // 값이 아니라 "무엇을 더하는지" 자체를 봐서, inSheetWindow(MAX_SHEET_WEEK=10) 가정이
    // 실제 수식의 합산 범위와 맞는지(예: E10+E14+...+E272 처럼 8주까지만인지) 직접 확인한다.
    const ranges = ["'01 영업관리'!R1:U6", "'대시보드(자동작성)'!C33:H40", "'대시보드(자동작성)'!B21"];
    for (const range of ranges) {
      const rows = await gridFormula(sid, range);
      console.log(`--- ${range} ---`);
      rows.forEach((r, i) => console.log(`  행${i}: ${JSON.stringify(r)}`));
    }
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
