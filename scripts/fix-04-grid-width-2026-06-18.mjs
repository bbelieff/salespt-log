/**
 * 시트 #VALUE! 근본수정 ② (2026-06-18) — 04 업체관리 탭 그리드 폭 확장.
 *
 * 다수 시트의 04 탭이 37컬럼(A~AK)뿐이라 이월 컬럼 AO(41)가 그리드 밖 → 01 영업관리의
 * `'04 …'!AO:AO,"<>이월"` COUNTIFS/SUMIFS 가 "Array arguments different size" → #VALUE!.
 * 04 그리드를 45컬럼(A~AS, 스키마 정본: T~AN 업체정보 + AO~AP 이월 + AQ~AS 확장)으로
 * 확장하면 AO~AS 가 유효해져 수식 정상화. **빈 컬럼만 추가 — 데이터 무손실·가역.** 멱등(≥45 skip).
 *
 * 실행: node scripts/fix-04-grid-width-2026-06-18.mjs --name=정유영          # 단건 드라이런
 *       node scripts/fix-04-grid-width-2026-06-18.mjs --name=정유영 --apply  # 단건 적용
 *       node scripts/fix-04-grid-width-2026-06-18.mjs --all                  # 전 trainee 드라이런
 *       node scripts/fix-04-grid-width-2026-06-18.mjs --all --apply          # 전 trainee 적용
 */
import { existsSync, readFileSync } from "node:fs";
import { google } from "googleapis";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const ALL = args.includes("--all");
const nameArg = (args.find((a) => a.startsWith("--name=")) || "").split("=")[1];
const TARGET_COLS = 45; // A~AS (이월 AO~AP + 확장 AQ~AS 포함)

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
const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, ["https://www.googleapis.com/auth/spreadsheets"]);
const sheets = google.sheets({ version: "v4", auth });

const reg = await sheets.spreadsheets.values.get({ spreadsheetId: REGISTRY_ID, range: `'${TAB}'!A2:F` });
const rows = reg.data.values ?? [];
let targets = [];
if (ALL) {
  const seen = new Set();
  for (const r of rows) {
    const sid = String(r[3] ?? "").trim();
    if (String(r[4] ?? "").trim() !== "trainee" || !sid || seen.has(sid)) continue;
    seen.add(sid);
    targets.push({ name: String(r[2] ?? "").trim(), cohort: String(r[1] ?? "").trim(), sid });
  }
} else if (nameArg) {
  const hit = rows.find((r) => String(r[2] ?? "").includes(nameArg) && String(r[3] ?? "").trim());
  if (!hit) { console.error(`'${nameArg}' 못 찾음.`); process.exit(1); }
  targets = [{ name: String(hit[2]).trim(), cohort: String(hit[1] ?? "").trim(), sid: String(hit[3]).trim() }];
} else { console.error("--name=<이름> 또는 --all 필요."); process.exit(1); }

console.log(`대상 ${targets.length}개 · 목표 ${TARGET_COLS}컬럼 · ${APPLY ? "APPLY" : "DRYRUN"}\n`);
let changed = 0;
for (const t of targets) {
  let meta;
  try {
    meta = await sheets.spreadsheets.get({ spreadsheetId: t.sid, fields: "sheets(properties(sheetId,title,gridProperties(columnCount)))" });
  } catch (e) { console.log(`  [skip] ${t.name}: meta 실패 ${e.message}`); continue; }
  const p04 = (meta.data.sheets ?? []).map((s) => s.properties).find((p) => p.title.startsWith("04 업체관리"));
  if (!p04) { console.log(`  [skip] ${t.name}: 04 탭 없음`); continue; }
  const cc = p04.gridProperties?.columnCount ?? 0;
  if (cc >= TARGET_COLS) { console.log(`  ${t.name}(${t.cohort}) ${cc}컬럼 — 충분, skip`); continue; }
  changed++;
  console.log(`  ${t.name}(${t.cohort}) ${t.sid.slice(0,8)}… : 04 ${cc}→${TARGET_COLS}컬럼${APPLY ? " 적용" : ""}`);
  if (APPLY) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: t.sid,
      requestBody: {
        requests: [{
          updateSheetProperties: {
            properties: { sheetId: p04.sheetId, gridProperties: { columnCount: TARGET_COLS } },
            fields: "gridProperties.columnCount",
          },
        }],
      },
    });
    await new Promise((r) => setTimeout(r, 350));
  }
}
console.log(`\n요약: ${changed}개 시트 ${APPLY ? "확장 완료" : "(드라이런)"}`);
if (!APPLY) console.log("실제 적용: --apply");
