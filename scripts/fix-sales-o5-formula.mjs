/**
 * 01 영업관리!O5(수수료총합) 을 **그 시트 02 탭의 수납총액 셀**로 교정 (ADR-0026 후속).
 *
 * 매출 = 수임료 + 수납액. O5 가 승인총액을 참조하면 매출 부풀림(승인 leak).
 * 시트 세대별 02 탭 구조가 달라 탭 인식형으로 교정:
 *   - 신형 `02 계약수납관리`: 승인=D2, **수납=D3** → O5 = '02 계약수납관리'!D3
 *   - 구형 `02 계약관리`    : 승인=D1, **수납=D2** → O5 = '02 계약관리'!D2
 * §2.5 가드: O5 가 raw 값(사용자 수동)이면 보존(skip). 수식·빈셀만 교체. dry-run 기본.
 *
 * 실행: node scripts/fix-sales-o5-formula.mjs --name=이장현          # 단건 dry-run
 *       node scripts/fix-sales-o5-formula.mjs --name=이장현 --apply  # 단건 적용
 *       node scripts/fix-sales-o5-formula.mjs --all                  # 전 trainee dry-run
 *       node scripts/fix-sales-o5-formula.mjs --all --apply          # 전 trainee 적용
 */
import { existsSync, readFileSync } from "node:fs";
import { google } from "googleapis";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const ALL = args.includes("--all");
const nameArg = (args.find((a) => a.startsWith("--name=")) || "").split("=")[1];
const SALES_TAB = "01 영업관리";

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    if (!existsSync(f)) continue;
    const o = {};
    for (const ln of readFileSync(f, "utf8").replace(/\r/g, "").split("\n")) {
      const m = ln.match(/^([A-Z0-9_]+)=(.*)$/); if (!m) continue;
      let v = m[2].trim(); if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1); o[m[1]] = v;
    } return o;
  } return {};
}
const fe = loadEnv(); const env = (k) => process.env[k] || fe[k] || "";
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const SA_KEY = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
const REG = env("SHEETS_REGISTRY_ID"); const TAB = env("SHEETS_REGISTRY_TAB") || "users";
if (!SA_EMAIL || !SA_KEY || !REG) { console.error("자격 누락 (.env)."); process.exit(1); }
const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, ["https://www.googleapis.com/auth/spreadsheets"]);
const sheets = google.sheets({ version: "v4", auth });

const isSafe = (v) => v === undefined || v === null || v === "" || (typeof v === "string" && v.startsWith("="));

/** 시트의 02 탭 구조 판정 → {tab, cell}. 02 탭 없으면 null. */
async function detect02(sid) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sid, fields: "sheets.properties.title" });
  const titles = (meta.data.sheets ?? []).map((s) => s.properties.title);
  if (titles.includes("02 계약수납관리")) return { tab: "02 계약수납관리", cell: "D3" }; // 신형: 수납=D3
  if (titles.includes("02 계약관리")) return { tab: "02 계약관리", cell: "D2" };       // 구형: 수납=D2
  return null;
}

async function fixOne(name, sid) {
  let target;
  try {
    const d = await detect02(sid);
    if (!d) { console.log(`  · ${name}: 02 탭 없음 — skip`); return; }
    target = `='${d.tab}'!${d.cell}`;
  } catch (e) { console.log(`  ✘ ${name}: 02 탭 판정 실패 — ${e.message.slice(0, 50)}`); return; }

  const got = await sheets.spreadsheets.values.get({ spreadsheetId: sid, range: `'${SALES_TAB}'!O5`, valueRenderOption: "FORMULA" });
  const cur = got.data.values?.[0]?.[0];
  if (!isSafe(cur)) { console.log(`  · ${name}: O5 raw 값(${cur}) 보존 — skip`); return; }
  if (String(cur ?? "") === target) { console.log(`  ✔ ${name}: 이미 정상 (${target})`); return; }

  console.log(`  ${APPLY ? "→ 교체" : "Δ 교체 예정"} ${name}: O5  "${cur ?? "(빈셀)"}"  →  "${target}"`);
  if (APPLY) {
    await sheets.spreadsheets.values.update({ spreadsheetId: sid, range: `'${SALES_TAB}'!O5`, valueInputOption: "USER_ENTERED", requestBody: { values: [[target]] } });
  }
}

const reg = await sheets.spreadsheets.values.get({ spreadsheetId: REG, range: `'${TAB}'!A2:F` });
const rows = reg.data.values ?? [];
let targets = [];
if (ALL) {
  const seen = new Set();
  for (const r of rows) {
    const sid = String(r[3] ?? "").trim();
    if (String(r[4] ?? "").trim() !== "trainee" || !sid || seen.has(sid)) continue;
    seen.add(sid); targets.push({ name: String(r[2] ?? "").trim() || sid, sid });
  }
} else if (nameArg) {
  for (const r of rows) {
    if (String(r[2] ?? "").trim() === nameArg && String(r[3] ?? "").trim()) { targets.push({ name: nameArg, sid: String(r[3]).trim() }); break; }
  }
  if (!targets.length) { console.error(`이름 '${nameArg}' 시트 못 찾음.`); process.exit(1); }
} else { console.error("--name=<이름> 또는 --all 필요 (dry-run 기본, --apply 로 적용)."); process.exit(1); }

console.log(`${APPLY ? "[APPLY]" : "[DRY-RUN]"} 영업관리 O5 → 02 수납총액 교정 — 대상 ${targets.length}개\n`);
for (const t of targets) {
  // quota 보호: 시트당 2~3 read → 직렬, 짧은 간격.
  try { await fixOne(t.name, t.sid); } catch (e) { console.log(`  ✘ ${t.name}: ${e.message.slice(0, 60)}`); }
  await new Promise((r) => setTimeout(r, 1200)); // SA 읽기 quota(분당) 보호 — 천천히.
}
console.log(`\n${APPLY ? "적용" : "드라이런"} 완료.`);
