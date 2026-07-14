/**
 * 02 계약 이월 flag(구분='이월') DB 복구 — #558 이전에 클로버된 행 (2026-07-15, DevD ① 판정).
 *
 * ⚠️ **왜 backfill 로는 안 고쳐지는가** (이게 이 스크립트가 따로 필요한 이유):
 *   `backfill-sheet-rows.mjs` 는 시트를 **열문자 키**(AI)로 적재한다. 그런데 읽기측
 *   `contractFromDbPayload` 는 ①열문자 복원 → ②**필드명 키 overlay** 순이라, jsonb 에 잔류한
 *   `구분: ''`(빈 문자열도 `!== undefined` 라 덮어씀)가 backfill 의 `AI:'이월'` 을 **항상 이긴다**.
 *   → 유효한 복구 = **필드명 키 `구분:'이월'` 을 upsert**(또는 payload 에서 '구분' 키 제거).
 *
 * 동작: 시트 02 의 AI='이월' 행을 정본으로 삼아, DB 의 같은 행에 **필드명 키**
 *   `{"구분":"이월","이월원본행id":<AJ>}` 를 jsonb 병합. 시트가 정본이라 안전·멱등.
 *   역방향(DB=이월 / 시트≠이월)은 **보고만** 하고 손대지 않는다(사람 판단).
 *
 * 실행 위치: **VPS** (.env 에 SA·DATABASE_URL 보유). 기본 dry-run.
 *   node scripts/ops/repair-carryover-flag.mjs [--execute]
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
  console.error("repair: SA/DATABASE_URL env 누락");
  process.exit(1);
}

const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
]);
const sheets = google.sheets({ version: "v4", auth });
const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
});

/** 02 탭 제목 — lib/repo/contract-payment.ts TAB_ALIASES 와 동일. */
async function tabOf(sid) {
  const meta = await sheets.spreadsheets
    .get({ spreadsheetId: sid, fields: "sheets(properties(title))" })
    .catch(() => null);
  if (!meta) return null;
  const titles = new Set(
    (meta.data.sheets ?? []).map((s) => s.properties?.title ?? ""),
  );
  if (titles.has("02 계약수납관리")) return "02 계약수납관리";
  if (titles.has("02 계약관리")) return "02 계약관리";
  return null;
}

/** 시트 AI:AJ → { rowNum: {구분, 원본행id} } (정본). */
async function sheetCarryover(sid, tab) {
  const res = await sheets.spreadsheets.values
    .get({
      spreadsheetId: sid,
      range: `'${tab}'!AI1:AJ`,
      valueRenderOption: "UNFORMATTED_VALUE",
    })
    .catch(() => null);
  const map = new Map();
  const values = res?.data?.values ?? [];
  for (let i = 0; i < values.length; i++) {
    const 구분 = String(values[i]?.[0] ?? "").trim();
    if (구분 !== "이월") continue;
    map.set(i + 1, { 원본행id: String(values[i]?.[1] ?? "").trim() });
  }
  return map;
}

// DB 의 contracts 행 — 현재 필드명 키 '구분' 상태.
const rows = (
  await pool.query(
    `select spreadsheet_id, cohort, email, row_key,
            substr(row_key, 2)::int as rn,
            coalesce(payload->>'구분','') as gubun,
            coalesce(payload->>'_cleared','') as cleared
       from sheet_rows
      where tab = 'contracts' and row_key ~ '^r[0-9]+$'
      order by cohort, email, rn`,
  )
).rows;

const bySheet = new Map();
for (const r of rows) {
  if (!bySheet.has(r.spreadsheet_id)) bySheet.set(r.spreadsheet_id, []);
  bySheet.get(r.spreadsheet_id).push(r);
}
console.log(
  `${EXECUTE ? "[EXECUTE]" : "[DRY-RUN]"} contracts ${rows.length}행 / ${bySheet.size}시트 점검`,
);

let fixed = 0,
  ok = 0,
  reverse = 0,
  skipSheet = 0;
for (const [sid, list] of bySheet) {
  const tab = await tabOf(sid);
  if (!tab) {
    skipSheet += list.length;
    continue;
  }
  const truth = await sheetCarryover(sid, tab);
  for (const r of list) {
    if (r.cleared === "true") continue; // 삭제된 행 — 대상 아님
    const sheetIsCarry = truth.has(r.rn);
    const dbIsCarry = r.gubun === "이월";
    if (sheetIsCarry && dbIsCarry) {
      ok++;
      continue;
    }
    if (!sheetIsCarry && dbIsCarry) {
      // 역방향(DB만 이월) — 손대지 않고 보고만.
      reverse++;
      console.log(
        `  ⚠역방향 ${r.cohort}/${r.email || "(무)"} ${r.row_key} — DB=이월 / 시트≠이월 (사람 판단)`,
      );
      continue;
    }
    if (!sheetIsCarry) continue; // 둘 다 아님 = 정상
    // 시트=이월, DB≠이월 → 클로버/미기록. 필드명 키로 복구.
    fixed++;
    const 원본행id = truth.get(r.rn).원본행id;
    console.log(
      `  ${EXECUTE ? "✓복구" : "→대상"} ${r.cohort}/${r.email || "(무)"} ${r.row_key} (구분='${r.gubun}' → '이월')`,
    );
    if (EXECUTE) {
      await pool.query(
        `update sheet_rows
            set payload = payload || jsonb_build_object('구분','이월','이월원본행id',$3::text),
                updated_at = now()
          where spreadsheet_id = $1 and tab = 'contracts' and row_key = $2`,
        [sid, r.row_key, 원본행id],
      );
    }
  }
}

console.log(
  `\n결과: ${EXECUTE ? "복구" : "복구대상"} ${fixed} · 이미정상 ${ok} · 역방향(보고만) ${reverse} · 02탭미확인 ${skipSheet}`,
);
if (!EXECUTE && fixed > 0) {
  console.log("→ 실제 반영: node scripts/ops/repair-carryover-flag.mjs --execute");
}
await pool.end();
