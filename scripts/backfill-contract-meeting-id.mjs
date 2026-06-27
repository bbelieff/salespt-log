/**
 * 02 계약수납관리 AK(연결 미팅 id) 백필 — 기존 행을 04 업체관리 미팅 id 로 1회 연결.
 *
 * 배경: 02↔04 매칭이 (계약일+업체명) 조합이라 업체명 개명 시 링크가 조용히 끊긴다.
 * 매칭 키를 미팅 id(04 A)로 전환(개명·계약일변경 안전). 신규 계약은 append 시 AK 기록되지만,
 * 기존 행은 AK 가 비어 있어 이 스크립트로 backfill.
 *
 * 매칭: AK 빈 02 행 → 04 미팅 중 (미팅날짜==계약일 && 업체명==업체명 && 상태=="계약") 정확히 1건이면 id 기록.
 *   0건(이미 개명된 고아·이전계약) / 2건+(모호) → **추정 금지**, 리포트만 하고 skip.
 * 멱등: AK 이미 있으면 skip. §2.5: AK 빈 셀에만 쓰므로 사용자값 덮어쓰기 없음(설계상 안전).
 *
 * 실행: node scripts/backfill-contract-meeting-id.mjs --name=이용호          # 단건 dry-run
 *       node scripts/backfill-contract-meeting-id.mjs --name=이용호 --apply  # 단건 적용
 *       node scripts/backfill-contract-meeting-id.mjs --all                  # 전 trainee dry-run
 *       node scripts/backfill-contract-meeting-id.mjs --all --apply          # 전 trainee 적용
 */
import { existsSync, readFileSync } from "node:fs";
import { google } from "googleapis";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const ALL = args.includes("--all");
const nameArg = (args.find((a) => a.startsWith("--name=")) || "").split("=")[1];
const MEETINGS_TAB = "04 업체관리(앱자동작성용)";

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

const toStr = (v) => (v === null || v === undefined ? "" : String(v));
function toISODate(v) {
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const d = new Date(v); return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  }
  if (typeof v === "number") {
    const d = new Date(Math.round(v - 25569) * 86_400_000);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  }
  return "";
}

/** AK(col 37) 쓰기 전 그리드 컬럼 보장 — 기존 02 시트는 A:AJ(36열)뿐. */
async function ensureCols(sid, tabTitle, minCols) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sid, fields: "sheets(properties(sheetId,title,gridProperties(columnCount)))" });
  const sheet = (meta.data.sheets ?? []).find((s) => s.properties.title === tabTitle);
  if (!sheet) return;
  const cur = sheet.properties.gridProperties?.columnCount ?? 0;
  if (cur >= minCols) return;
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: sid, requestBody: { requests: [{ appendDimension: { sheetId: sheet.properties.sheetId, dimension: "COLUMNS", length: minCols - cur } }] } });
}

/** 02 탭 구조 판정 → {tab, firstDataRow}. 없으면 null. */
async function detect02(sid) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sid, fields: "sheets.properties.title" });
  const titles = (meta.data.sheets ?? []).map((s) => s.properties.title);
  if (titles.includes("02 계약수납관리")) return { tab: "02 계약수납관리", firstDataRow: 6 }; // 신형
  if (titles.includes("02 계약관리")) return { tab: "02 계약관리", firstDataRow: 5 };       // 구형
  return null;
}

const totals = { planned: 0, applied: 0, orphan: 0, ambiguous: 0, skipped: 0 };

async function backfillOne(name, sid) {
  const d = await detect02(sid);
  if (!d) { console.log(`  · ${name}: 02 탭 없음 — skip`); return; }
  const q = (t) => (/[\s()]/.test(t) ? `'${t}'` : t);

  // 04 미팅 인덱스: (미팅날짜|업체명) → [{ id, 상태 }]
  const mRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sid, range: `${q(MEETINGS_TAB)}!A2:J`,
    valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const idx = new Map();
  for (const r of mRes.data.values ?? []) {
    const id = toStr(r[0]).trim();
    if (!id) continue;
    const key = `${toISODate(r[3])}|${toStr(r[6]).trim()}`; // D 미팅날짜 | G 업체명
    if (!idx.has(key)) idx.set(key, []);
    idx.get(key).push({ id, status: toStr(r[9]).trim() }); // J 상태
  }

  // 02 행: C..AK 읽기 (AK offset = 34)
  const cRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sid, range: `${q(d.tab)}!C${d.firstDataRow}:AK`,
    valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const rows = cRes.data.values ?? [];
  const writes = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const sheetRow = d.firstDataRow + i;
    const 계약일 = toISODate(r[0]); const 업체명 = toStr(r[1]).trim(); const ak = toStr(r[34]).trim();
    if (ak) { totals.skipped++; continue; }            // 이미 연결 — 멱등 skip
    if (!계약일 && !업체명) continue;                   // 빈 행
    const cands = (idx.get(`${계약일}|${업체명}`) ?? []).filter((m) => m.status === "계약");
    if (cands.length === 1) {
      writes.push({ range: `${q(d.tab)}!AK${sheetRow}`, values: [[`'${cands[0].id}`]] });
      console.log(`  ${APPLY ? "→ 기록" : "Δ 기록예정"} ${name} row${sheetRow}: ${계약일} / ${업체명}  → id ${cands[0].id}`);
      totals.planned++;
    } else if (cands.length === 0) {
      console.log(`  ⚠ ${name} row${sheetRow}: 계약 미팅 매칭 0건 (${계약일} / ${업체명}) — 고아, id 빈 채 둠`);
      totals.orphan++;
    } else {
      console.log(`  ⚠ ${name} row${sheetRow}: 매칭 ${cands.length}건 모호 (${계약일} / ${업체명}) — skip`);
      totals.ambiguous++;
    }
  }
  if (APPLY && writes.length) {
    await ensureCols(sid, d.tab, 37); // AK 그리드 보장
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sid, requestBody: { valueInputOption: "USER_ENTERED", data: writes },
    });
    totals.applied += writes.length;
  }
}

const reg = await sheets.spreadsheets.values.get({ spreadsheetId: REG, range: `'${TAB}'!A2:F` });
const regRows = reg.data.values ?? [];
let targets = [];
if (ALL) {
  const seen = new Set();
  for (const r of regRows) {
    const sid = String(r[3] ?? "").trim();
    if (String(r[4] ?? "").trim() !== "trainee" || !sid || seen.has(sid)) continue;
    seen.add(sid); targets.push({ name: String(r[2] ?? "").trim() || sid, sid });
  }
} else if (nameArg) {
  for (const r of regRows) {
    if (String(r[2] ?? "").trim() === nameArg && String(r[3] ?? "").trim()) { targets.push({ name: nameArg, sid: String(r[3]).trim() }); break; }
  }
  if (!targets.length) { console.error(`이름 '${nameArg}' 시트 못 찾음.`); process.exit(1); }
} else { console.error("--name=<이름> 또는 --all 필요 (dry-run 기본, --apply 로 적용)."); process.exit(1); }

console.log(`${APPLY ? "[APPLY]" : "[DRY-RUN]"} 02 AK(연결 미팅 id) backfill — 대상 ${targets.length}개 시트\n`);
for (const t of targets) {
  try { await backfillOne(t.name, t.sid); } catch (e) { console.log(`  ✘ ${t.name}: ${e.message.slice(0, 80)}`); }
  await new Promise((r) => setTimeout(r, 1200)); // SA quota 보호
}
console.log(`\n${APPLY ? "적용" : "드라이런"} 완료 — 연결 ${APPLY ? totals.applied : totals.planned} · 고아 ${totals.orphan} · 모호 ${totals.ambiguous} · 이미연결 ${totals.skipped}`);
