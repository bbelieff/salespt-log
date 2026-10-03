#!/usr/bin/env node
/**
 * BBE-56 게이트 ON 실측 대조 — 레지스트리(users·cohorts) 시트 vs DB 값 전수 비교.
 *
 * belie 지시(2026-08-09): "게이트를 켠 뒤 admin 전 화면을 실측 검증해라. /admin/users 목록·
 * 수강생 상세·클레임 흐름이 시트 시절과 같은 값인지 대조표로 남겨라. 다르면 게이트 즉시 OFF."
 *
 * 이 스크립트는 그 대조표의 **데이터 계층**을 만든다. `lib/repo/db/registry-read.ts` 가
 * DB 를 시트와 똑같은 열 순서 배열로 돌려주는 어댑터 설계라서, 화면 레벨 스모크(로그인·
 * /admin/users·클레임)와 이 데이터 대조 둘 다 필요하다 — 화면은 "렌더가 안 깨졌는가",
 * 이 스크립트는 "값 자체가 셀 단위로 같은가"를 본다.
 *
 * 비교 대상:
 *   ① 시트 = `scripts/ops/backfill-registry.mjs` 와 동일한 read(같은 render option — BBE-91).
 *   ② DB   = `lib/repo/db/registry-read.ts` 의 USER_SELECT/COHORT_SELECT 와 동일 쿼리
 *            (자립 스크립트라 import 불가 — 두 파일이 갈리면 이 스크립트도 같이 고칠 것).
 *   자연키 = `normalizeUserKey`(lib/repo/db/registry.ts) 규칙 그대로 email 소문자+trim.
 *
 * BBE-66/63 diff 원인 자동분류(2026-08-10, belie 최우선 지시) — missingInDb 는 정의상 "시차",
 * fieldMismatches 는 parity-classify.mjs 로 렌더옵션/진짜불일치 판정. 순수 로직은
 * registry-parity-lib.mjs 로 분리(테스트 가능하게 — 이 파일은 I/O 전용).
 *
 * 실행(VPS, 읽기 전용 — 시트·DB 쓰기 없음):
 *   node scripts/ops/registry-parity.mjs
 *
 * 판정: 불일치 0건 = 게이트 ON 유지 근거. 1건이라도 있으면 게이트 즉시 OFF(env 한 줄 제거) —
 * 표는 STDOUT 그대로 이 카드/PR 에 첨부해 대조표로 남긴다.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { google } from "googleapis";
import { Pool } from "pg";
import { summarizeClassification } from "./parity-classify.mjs";
import {
  classifyFieldMismatches,
  diffByKey,
  missingInDbAsClassified,
  normalizeCohortType,
  normalizeSortOrder,
} from "./registry-parity-lib.mjs";

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
const COHORTS_TAB = env("SHEETS_COHORTS_TAB") || "cohorts";
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const SA_KEY = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
const DB_URL = env("DATABASE_URL");

let sheets, pool;
function initClients() {
  const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
  ]);
  sheets = google.sheets({ version: "v4", auth });
  pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false }, max: 3 });
}

const s = (r, i) => String(r?.[i] ?? "").trim();

/** users 시트 행(A~T) → 비교용 객체. backfill-registry.mjs:userFromRow 와 동일 컬럼 순서. */
const USER_COLS = [
  "email", "cohort", "name", "spreadsheet_id", "role", "status", "assigned_trainer", "team",
  "cohort_label", "name_label", "course_start_iso", "graduation_iso", "sort_order",
  "drive_parent_path", "feedback_folder_id", "drive_link_status", "memo", "captain_of",
  "gcal_token", "gcal_settings",
];
const COHORT_COLS = [
  "label", "status", "note", "type", "template_sheet_id", "root_folder_id",
  "roster_sheet_id", "sheets_folder_id", "company_parent_folder_id", "season_start_iso",
];

function normalizeUserKey(email, cohort, name) {
  return { email: email.trim().toLowerCase(), cohort: cohort.trim(), name: name.trim() };
}

async function readSheetRange(range) {
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: REGISTRY_ID,
    range,
    // ★ 앱(lib/repo/sheets-client.ts)·백필과 동일 — BBE-91 로 이미 정렬(다르면 3번째 출처가
    //   또 갈린다). 여기가 바뀌면 그 두 곳도 확인할 것.
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  return r.data.values ?? [];
}

function sheetUsers() {
  return readSheetRange(`${USERS_TAB}!A2:T`).then((rows) =>
    rows
      .map((r) => {
        const email = s(r, 0), cohort = s(r, 1), name = s(r, 2);
        if (!email && !cohort && !name) return null;
        const key = normalizeUserKey(email, cohort, name);
        const rec = { email: key.email, cohort: key.cohort, name: key.name };
        USER_COLS.slice(3).forEach((c, i) => (rec[c] = s(r, i + 3)));
        return rec;
      })
      .filter(Boolean),
  );
}
function sheetCohorts() {
  return readSheetRange(`${COHORTS_TAB}!A2:J`).then((rows) =>
    rows
      .map((r) => {
        const label = s(r, 0);
        if (!label) return null;
        const rec = { label };
        COHORT_COLS.slice(1).forEach((c, i) => (rec[c] = s(r, i + 1)));
        return rec;
      })
      .filter(Boolean),
  );
}

/** registry-read.ts 의 USER_SELECT/COHORT_SELECT 사본 — 정렬은 무관(키로 join 하므로). */
async function dbUsers() {
  const res = await pool.query(
    `select email, cohort, name, spreadsheet_id, role, status, assigned_trainer, team,
            cohort_label, name_label, course_start_iso, graduation_iso, sort_order,
            drive_parent_path, feedback_folder_id, drive_link_status, memo, captain_of,
            gcal_token, gcal_settings
     from users`,
  );
  return res.rows.map((r) => ({
    email: r.email, cohort: r.cohort, name: r.name,
    spreadsheet_id: r.spreadsheet_id, role: r.role, status: r.status,
    assigned_trainer: r.assigned_trainer, team: r.team, cohort_label: r.cohort_label,
    name_label: r.name_label, course_start_iso: r.course_start_iso,
    graduation_iso: r.graduation_iso, sort_order: String(r.sort_order ?? ""),
    drive_parent_path: r.drive_parent_path, feedback_folder_id: r.feedback_folder_id,
    drive_link_status: r.drive_link_status, memo: r.memo, captain_of: r.captain_of,
    gcal_token: r.gcal_token, gcal_settings: r.gcal_settings,
  }));
}
async function dbCohorts() {
  const res = await pool.query(
    `select label, status, note, type, template_sheet_id, root_folder_id,
            roster_sheet_id, sheets_folder_id, company_parent_folder_id, season_start_iso
     from cohorts`,
  );
  return res.rows;
}

function report(result, label) {
  console.log(`\n=== ${label} 대조 ===`);
  console.log(`시트 고유키 ${result.uniqueSheetKeys} · DB ${result.dbCount}`);
  console.log(`DB 에 없음(시트에만): ${result.missingInDb.length}${result.missingInDb.length ? " → " + result.missingInDb.slice(0, 50).join(", ") : ""}`);
  console.log(`시트에 없음(DB에만): ${result.missingInSheet.length}${result.missingInSheet.length ? " → " + result.missingInSheet.slice(0, 50).join(", ") : ""}`);
  console.log(`필드 불일치: ${result.fieldMismatches.length}건`);
  for (const m of result.fieldMismatches.slice(0, 30)) {
    console.log(`  [${m.key}] ${m.field}: 시트="${m.sheet}" ≠ DB="${m.db}"`);
  }
  if (result.fieldMismatches.length > 30) console.log(`  ... 이하 ${result.fieldMismatches.length - 30}건 생략(전체는 위 카운트로 판단)`);
}

async function main() {
  if (!REGISTRY_ID || !SA_EMAIL || !SA_KEY || !DB_URL) {
    console.error("registry-parity: env 누락(SA/레지스트리/DATABASE_URL)");
    process.exit(1);
  }
  initClients();

  const [su, sc, du, dc] = await Promise.all([sheetUsers(), sheetCohorts(), dbUsers(), dbCohorts()]);
  const uResult = diffByKey(su, du, (r) => `${r.email}|${r.cohort}|${r.name}`, USER_COLS.slice(3), {
    sort_order: normalizeSortOrder,
  });
  const cResult = diffByKey(sc, dc, (r) => r.label, COHORT_COLS.slice(1), { type: normalizeCohortType });
  report(uResult, "users");
  report(cResult, "cohorts");

  const classified = [
    ...missingInDbAsClassified(uResult.missingInDb, "users"),
    ...classifyFieldMismatches(uResult.fieldMismatches, "users"),
    ...missingInDbAsClassified(cResult.missingInDb, "cohorts"),
    ...classifyFieldMismatches(cResult.fieldMismatches, "cohorts"),
  ];
  if (classified.length > 0) console.log(summarizeClassification(classified).text);

  const total = uResult.missingInDb.length + uResult.missingInSheet.length + uResult.fieldMismatches.length
    + cResult.missingInDb.length + cResult.missingInSheet.length + cResult.fieldMismatches.length;
  console.log(`\n=== 판정 ===`);
  console.log(total === 0
    ? "✅ 불일치 0건 — 게이트 ON 유지 근거로 사용 가능"
    : `❌ 불일치 ${total}건 — 게이트 즉시 OFF 대상 (REGISTRY_DB_READ 제거)`);
  process.exitCode = total === 0 ? 0 : 1;
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  main()
    .catch((e) => {
      const msg = (e instanceof Error ? e.message : String(e)).replace(/postgres(ql)?:\/\/\S+/gi, "[DATABASE_URL]");
      console.error(`registry-parity 실패: ${msg}`);
      process.exitCode = 1;
    })
    .finally(() => pool?.end().catch(() => {}));
}
