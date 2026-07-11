/**
 * 02 계약수납 헤더존 유령 행 수리 (contract-delete-ghost, 2026-07-12).
 *
 * 사고: backfill-sheet-rows.mjs 가 contracts 를 row>=3 부터 적재해 헤더·예시 구간
 * (신형 r3~r5: "수납총액" 안내행 + "00유통" 템플릿 예시행 / 구형 r3~r4)이 DB 에
 * 유령 계약으로 남음 — 실무/수납 화면(DB read)에 삭제 불가 카드로 표시(전 기수 94행).
 * 앱은 이 구간에 절대 쓰지 않음(findFirstEmptyRow·clearRow 헤더 보호) → 구조적으로
 * 데이터 행일 수 없어, 마킹해도 사용자 데이터 손실 불가.
 *
 * 동작: DB 에서 tab='contracts' AND row < 6 인 행을 모아, 시트별 탭 제목으로
 * 레이아웃(신형 firstDataRow=6 / 구형 5)을 확정한 뒤 row < firstDataRow 인 행만
 * `_cleared:true, _headerzone:true` jsonb 병합 마킹(payload 보존 — 감사·복구 가능).
 * 멱등. 행 삭제 아님(마킹 규칙 = mirror.ts clear 계열과 동일).
 *
 * 실행 위치: **VPS** (.env 에 SA·DATABASE_URL 보유). 기본 dry-run.
 *   node scripts/ops/repair-contracts-header-zone.mjs [--execute]
 * ★URL·비밀번호·SA 키 로그 미출력.
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
      let v = m[2];
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      out[m[1]] = v;
    }
  }
  return out;
}
const fileEnv = loadEnv();
const env = (k) => process.env[k] || fileEnv[k] || "";

const EXECUTE = process.argv.includes("--execute");
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const SA_KEY = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
const DB_URL = env("DATABASE_URL");
if (!SA_EMAIL || !SA_KEY || !DB_URL) {
  console.error("repair: SA/DATABASE_URL env 누락"); process.exit(1);
}

const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
]);
const sheets = google.sheets({ version: "v4", auth });
const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

/** 시트 탭 제목으로 02 레이아웃 확정 — lib/repo/contract-payment.ts TAB_ALIASES 와 동일. */
async function firstDataRowOf(sid) {
  const meta = await sheets.spreadsheets
    .get({ spreadsheetId: sid, fields: "sheets(properties(title))" })
    .catch(() => null);
  if (!meta) return null; // 메타 실패 시트는 건너뜀(보수적)
  const titles = new Set((meta.data.sheets ?? []).map((s) => s.properties?.title ?? ""));
  if (titles.has("02 계약수납관리")) return 6;
  if (titles.has("02 계약관리")) return 5;
  return null; // 02 탭 자체가 없으면 판단 보류
}

const rows = (
  await pool.query(
    `select spreadsheet_id, cohort, email, row_key,
            substr(row_key, 2)::int as rn,
            coalesce(payload->>'_cleared','') as cleared,
            coalesce(payload->>'계약일', payload->>'C') as c,
            coalesce(payload->>'업체명', payload->>'D') as d
       from sheet_rows
      where tab = 'contracts' and row_key ~ '^r[0-9]+$' and substr(row_key, 2)::int < 6
      order by cohort, email, rn`,
  )
).rows;

const bySheet = new Map();
for (const r of rows) {
  if (!bySheet.has(r.spreadsheet_id)) bySheet.set(r.spreadsheet_id, []);
  bySheet.get(r.spreadsheet_id).push(r);
}
console.log(`대상 후보: ${rows.length}행 / ${bySheet.size}시트 (row<6, contracts)`);

let mark = 0, skipAlready = 0, skipData = 0, skipUnknown = 0;
for (const [sid, list] of bySheet) {
  const fdr = await firstDataRowOf(sid);
  if (fdr === null) {
    skipUnknown += list.length;
    console.log(`  ? ${list[0].cohort}/${list[0].email || "(이메일없음)"} — 02 탭 미확인, ${list.length}행 보류`);
    continue;
  }
  for (const r of list) {
    if (r.rn >= fdr) { skipData++; continue; } // 구형(5) 시트의 r5 = 실데이터, 손대지 않음
    if (r.cleared === "true") { skipAlready++; continue; }
    mark++;
    console.log(
      `  ${EXECUTE ? "✗마킹" : "→대상"} ${r.cohort}/${r.email || "(이메일없음)"} ${r.row_key}` +
      ` [${String(r.c).slice(0, 10)}|${String(r.d).slice(0, 10)}] (fdr=${fdr})`,
    );
    if (EXECUTE) {
      await pool.query(
        `update sheet_rows
            set payload = payload || '{"_cleared": true, "_headerzone": true}'::jsonb,
                updated_at = now()
          where spreadsheet_id = $1 and tab = 'contracts' and row_key = $2`,
        [sid, r.row_key],
      );
    }
  }
}
console.log(
  `${EXECUTE ? "마킹 완료" : "DRY-RUN — DB 미기록. 실행하려면 --execute."} ` +
  `마킹=${mark} 이미정리=${skipAlready} 실데이터보호=${skipData} 판단보류=${skipUnknown}`,
);
await pool.end();
