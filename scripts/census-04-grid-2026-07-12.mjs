/**
 * DevF 진단 (2026-07-12) — 실사용 시트 04/05 탭 그리드 열수 전수조사 (READ-ONLY).
 *
 * 목적: gcal 읽기 경로 grid-limits 가드(#522) 배포 후, 아직 AT(46)·O(15) 미생성이라
 * 그 가드에 의존하는 시트가 몇 개인지 실측. 쓰기 절대 없음 — spreadsheets.get 만.
 *
 * gcal 임계: 04 미팅 AT=46번째 컬럼 / 05 투두 O=15번째 컬럼.
 * 수식 임계(참고): 04 이월수식 AS=45.
 *
 * 실행: node <scratchpad>/census-04-grid.mjs   (repo root 를 cwd 로 — .env.local 상대참조)
 */
import { existsSync, readFileSync } from "node:fs";
import { google } from "googleapis";

function loadEnvFile() {
  for (const f of [".env.local", ".env"]) {
    if (!existsSync(f)) continue;
    const txt = readFileSync(f, "utf8").replace(/\r/g, "");
    const out = {};
    for (const line of txt.split("\n")) {
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
const env = (() => { const fe = loadEnvFile(); return (k) => process.env[k] || fe[k] || ""; })();
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const SA_KEY = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
const REGISTRY_ID = env("SHEETS_REGISTRY_ID");
const TAB = env("SHEETS_REGISTRY_TAB") || "users";
if (!SA_EMAIL || !SA_KEY || !REGISTRY_ID) { console.error("자격 누락."); process.exit(1); }

// READ-ONLY scope — 쓰기 물리 불가.
const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, ["https://www.googleapis.com/auth/spreadsheets.readonly"]);
const sheets = google.sheets({ version: "v4", auth });

const reg = await sheets.spreadsheets.values.get({ spreadsheetId: REGISTRY_ID, range: `'${TAB}'!A2:F` });
const rows = reg.data.values ?? [];

// trainee 역할 + 유니크 spreadsheetId 만
const seen = new Set();
const targets = [];
for (const r of rows) {
  const sid = String(r[3] ?? "").trim();
  if (String(r[4] ?? "").trim() !== "trainee" || !sid || seen.has(sid)) continue;
  seen.add(sid);
  targets.push({ name: String(r[2] ?? "").trim(), cohort: String(r[1] ?? "").trim(), sid });
}

console.log(`전수조사 대상 ${targets.length} 시트 (trainee·유니크) · READ-ONLY\n`);
const results = [];
for (const t of targets) {
  let meta;
  try {
    meta = await sheets.spreadsheets.get({ spreadsheetId: t.sid, fields: "sheets(properties(title,gridProperties(columnCount)))" });
  } catch (e) { results.push({ ...t, c04: null, c05: null, err: e.message?.slice(0, 60) }); continue; }
  const props = (meta.data.sheets ?? []).map((s) => s.properties);
  const p04 = props.find((p) => p.title.startsWith("04 업체관리"));
  const p05 = props.find((p) => p.title.startsWith("05 실무투두"));
  results.push({
    ...t,
    c04: p04 ? (p04.gridProperties?.columnCount ?? 0) : null,
    c05: p05 ? (p05.gridProperties?.columnCount ?? 0) : null,
  });
  await new Promise((r) => setTimeout(r, 120));
}

// 정렬: 04 열수 오름차순(취약한 것 위로)
results.sort((a, b) => (a.c04 ?? 999) - (b.c04 ?? 999));

const pad = (s, n) => String(s).padEnd(n);
console.log(pad("이름", 12) + pad("기수", 6) + pad("04열", 6) + pad("gcal(AT≥46)", 13) + pad("05열", 6) + pad("gcal(O≥15)", 12) + "비고");
console.log("-".repeat(70));
let vuln04 = 0, vuln05 = 0, no04 = 0;
for (const r of results) {
  const g04 = r.c04 == null ? "탭없음" : (r.c04 >= 46 ? "OK" : "취약(가드의존)");
  const g05 = r.c05 == null ? "탭없음" : (r.c05 >= 15 ? "OK" : "취약(가드의존)");
  if (r.c04 == null) no04++; else if (r.c04 < 46) vuln04++;
  if (r.c05 != null && r.c05 < 15) vuln05++;
  console.log(
    pad(r.name || "?", 12) + pad(r.cohort || "-", 6) +
    pad(r.c04 ?? "-", 6) + pad(g04, 13) +
    pad(r.c05 ?? "-", 6) + pad(g05, 12) + (r.err ? `ERR:${r.err}` : "")
  );
}
console.log("-".repeat(70));
console.log(`\n요약: 총 ${results.length} 시트`);
console.log(`  04 AT(46) 미생성=가드 의존: ${vuln04} · 04 탭 없음: ${no04} · 04 OK: ${results.length - vuln04 - no04}`);
console.log(`  05 O(15) 미생성=가드 의존: ${vuln05}`);
console.log(`\nJSON:`);
console.log(JSON.stringify(results.map(({ name, cohort, c04, c05, err }) => ({ name, cohort, c04, c05, ...(err ? { err } : {}) })), null, 0));
