/**
 * company-info-email 배포 전 census (READ-ONLY) — 04 업체관리 CE 열 · 06 업체정보 BM 열이 비어 있는지.
 *
 * 왜: 확장5(이메일)는 04 CE · 06 BM 에 새로 쓴다. 수강생이 그 열에 직접 적어 둔 값이 있으면 첫 저장 때
 * 덮인다(§2.5 사용자 작성값 보존). 배포 전에 한 번 세어 0 인지 확인한다.
 * 쓰기 없음 — spreadsheets.readonly 스코프. 출력은 숫자만(이름·시트 id·셀 값은 찍지 않는다).
 *
 * 실행(레포 루트, .env.local 의 서비스계정 자격 사용): node scripts/ops/census-email-columns.mjs
 * 판정: "CE 값 있음"·"BM 값 있음" 합계가 0 이면 배포 가능. 1 이상이면 배포를 멈추고 belie 에게 올린다.
 */
import { existsSync, readFileSync } from "node:fs";
import { google } from "googleapis";

function loadEnvFile() {
  for (const f of [".env.local", ".env"]) {
    if (!existsSync(f)) continue;
    const out = {};
    for (const line of readFileSync(f, "utf8").replace(/\r/g, "").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      out[m[1]] = v;
    }
    return out;
  }
  return {};
}
const fileEnv = loadEnvFile();
const env = (k) => process.env[k] || fileEnv[k] || "";
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const SA_KEY = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
const REGISTRY_ID = env("SHEETS_REGISTRY_ID");
const REGISTRY_TAB = env("SHEETS_REGISTRY_TAB") || "users";
if (!SA_EMAIL || !SA_KEY || !REGISTRY_ID) {
  console.error("자격 누락(.env.local).");
  process.exit(1);
}

const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, ["https://www.googleapis.com/auth/spreadsheets.readonly"]);
const sheets = google.sheets({ version: "v4", auth });

const COLUMNS = [
  { name: "04 CE", range: "'04 업체관리(앱자동작성용)'!CE2:CE" },
  { name: "06 BM", range: "'06 업체정보'!BM2:BM" },
];

/** 비어 있지 않은 셀 수 — 열·탭이 없으면(범위 초과·탭 없음) null. */
async function countFilled(spreadsheetId, range) {
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range, valueRenderOption: "FORMULA" });
    return (res.data.values ?? []).filter((r) => String(r[0] ?? "").trim() !== "").length;
  } catch (e) {
    const msg = String(e?.message ?? "");
    if (/exceeds grid limits|Unable to parse range/i.test(msg)) return null;
    throw e;
  }
}

const reg = await sheets.spreadsheets.values.get({ spreadsheetId: REGISTRY_ID, range: `'${REGISTRY_TAB}'!A2:F` });
const seen = new Set();
const targets = [];
for (const r of reg.data.values ?? []) {
  const sid = String(r[3] ?? "").trim();
  if (String(r[4] ?? "").trim() !== "trainee" || !sid || seen.has(sid)) continue;
  seen.add(sid);
  targets.push({ cohort: String(r[1] ?? "").trim() || "-", sid });
}

console.log(`census 대상 ${targets.length} 시트 (trainee·유니크) · READ-ONLY · 숫자만 출력\n`);
const totals = Object.fromEntries(COLUMNS.map((c) => [c.name, { filledSheets: 0, filledCells: 0, noColumn: 0 }]));
let errors = 0;
for (const [i, t] of targets.entries()) {
  const row = [];
  for (const c of COLUMNS) {
    try {
      const n = await countFilled(t.sid, c.range);
      if (n === null) totals[c.name].noColumn++;
      else if (n > 0) {
        totals[c.name].filledSheets++;
        totals[c.name].filledCells += n;
      }
      row.push(`${c.name}=${n === null ? "열없음" : n}`);
    } catch {
      errors++;
      row.push(`${c.name}=오류`);
    }
  }
  // 이름·시트 id 대신 순번과 기수만 — 값이 있는 시트는 관리자가 레지스트리 순번으로 찾아 본다.
  if (row.some((s) => /=[1-9]|=오류/.test(s))) console.log(`#${i + 1} (기수 ${t.cohort}) ${row.join(" · ")}`);
  await new Promise((r) => setTimeout(r, 150));
}

console.log("\n요약");
for (const c of COLUMNS) {
  const s = totals[c.name];
  console.log(`  ${c.name}: 값 있는 시트 ${s.filledSheets} · 값 있는 셀 ${s.filledCells} · 열/탭 없음 ${s.noColumn}`);
}
console.log(`  읽기 오류 ${errors}`);
const blocked = COLUMNS.some((c) => totals[c.name].filledCells > 0) || errors > 0;
console.log(blocked ? "\n판정: 배포 보류 — 값 있는 열/오류를 belie 에게 올린다." : "\n판정: CE·BM 모두 비어 있음 — 배포 가능.");
process.exit(blocked ? 2 : 0);
