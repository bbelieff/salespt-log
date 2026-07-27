/**
 * 현수막 게시로그(03 DB관리 AF:AI) → 01 영업관리 E(현수막) 1회 이관 (ADR-0025).
 *
 * 배경: ADR-0025 로 현수막 게시=생산은 컨택 게시 스테퍼가 영업관리 E 소유.
 *   기존 E(현수막)은 구 syncProduction 이 이미 게시일별 Σ게시수로 채워둠 → 보통 일치(no-op).
 *   이 스크립트는 (1) AF:AI Σ게시수 vs 현재 E 를 감사하고(드라이런),
 *   (2) --apply 시 불일치 날짜의 E 를 Σ게시수로 ensure 후 AF:AI 를 비운다.
 *   ⚠️ 라이브 시트 쓰기 — belie 확인 후에만 --apply. 드라이런으로 먼저 검토.
 *
 * 실행: node scripts/migrate-banner-posts-to-sales-E.mjs --name=정유영          # 단건 드라이런
 *       node scripts/migrate-banner-posts-to-sales-E.mjs --name=정유영 --apply  # 단건 적용
 *       node scripts/migrate-banner-posts-to-sales-E.mjs --all                  # 전 trainee 드라이런
 *       node scripts/migrate-banner-posts-to-sales-E.mjs --all --apply          # 전 trainee 적용
 */
import { existsSync, readFileSync } from "node:fs";
import { google } from "googleapis";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const ALL = args.includes("--all");
const nameArg = (args.find((a) => a.startsWith("--name=")) || "").split("=")[1];

const SALES_TAB = "01 영업관리";
const DB_TAB = "03 DB관리";
const BLOCK_START = 10;
const BLOCK_STRIDE = 34;
const BANNER_CHANNEL_IDX = 2; // 매입DB0·직접생산1·현수막2·콜3

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
if (!SA_EMAIL || !SA_KEY || !REGISTRY_ID) { console.error("자격 누락 (.env)."); process.exit(1); }
const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, ["https://www.googleapis.com/auth/spreadsheets"]);
const sheets = google.sheets({ version: "v4", auth });

// ── 날짜·좌표 헬퍼 (lib/repo/sales.ts 동일 로직) ───────────────
function parseISO(s) { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); }
function isISO(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s)); }
function diffDays(a, b) { return Math.round((a.getTime() - b.getTime()) / 86_400_000); }
function serialOrStringToDate(raw) {
  if (typeof raw === "number") return new Date((raw - 25569) * 86_400_000);
  const d = new Date(String(raw)); return Number.isNaN(d.getTime()) ? null : d;
}
function salesRowForBanner(dateISO, courseStart) {
  const date = parseISO(dateISO);
  const diff = diffDays(date, courseStart);
  if (diff < 0) return null;
  // WEEK-INDEX-SSOT-COPY: lib/util/week.ts weekIndexOf(시작일 앵커) 사본 — .mjs 는 TS import 불가. 수정 시 정본과 동기 (G8)
  const week = Math.floor(diff / 7) + 1;
  if (week < 1 || week > 10) return null;
  const weekStart = new Date(courseStart); weekStart.setDate(weekStart.getDate() + (week - 1) * 7);
  const dayIdx = diffDays(date, weekStart);
  return BLOCK_START + (week - 1) * BLOCK_STRIDE + dayIdx * 4 + BANNER_CHANNEL_IDX;
}

async function getVals(sid, range, opts = {}) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sid, range, ...opts });
  return res.data.values ?? [];
}

async function migrateOne(name, sid) {
  // 1) AF:AI 게시로그 read → 게시일별 Σ게시수.
  let postRows;
  try { postRows = await getVals(sid, `'${DB_TAB}'!AF4:AI100`, { valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "SERIAL_NUMBER" }); }
  catch (e) { console.log(`  · ${name}: AF:AI read 실패 — skip (${e.message})`); return; }
  const byDate = new Map();
  for (const r of postRows) {
    const d = serialOrStringToDate(r?.[2]); // AH=게시일
    const n = Number(r?.[3] ?? 0) || 0; // AI=게시수
    if (!d || n <= 0) continue;
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    byDate.set(iso, (byDate.get(iso) ?? 0) + n);
  }
  if (byDate.size === 0) { console.log(`  · ${name}: AF:AI 게시 없음 — 비울 것 없음`); return; }

  // 2) courseStart(O1) → 각 게시일 E(현수막) 좌표·현재값.
  const o1 = await getVals(sid, `'${SALES_TAB}'!O1`, { valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "SERIAL_NUMBER" });
  const courseStart = serialOrStringToDate(o1?.[0]?.[0]);
  if (!courseStart) { console.log(`  · ${name}: O1(수강시작일) 파싱 실패 — skip`); return; }

  const updates = [];
  for (const [iso, sum] of [...byDate].sort()) {
    if (!isISO(iso)) continue;
    const row = salesRowForBanner(iso, courseStart);
    if (!row) { console.log(`    ${iso}: Σ게시 ${sum} — 편집기간(1~10주) 밖, E 미대상`); continue; }
    const cur = Number((await getVals(sid, `'${SALES_TAB}'!E${row}`, { valueRenderOption: "UNFORMATTED_VALUE" }))?.[0]?.[0] ?? 0) || 0;
    const flag = cur === sum ? "= 일치" : `≠ 현재 E=${cur}`;
    console.log(`    ${iso}: Σ게시 ${sum} (E${row}) ${flag}`);
    if (cur !== sum) updates.push({ range: `'${SALES_TAB}'!E${row}`, values: [[sum]] });
  }

  if (!APPLY) { console.log(`  · ${name}: 드라이런 — ${updates.length} 셀 갱신 예정, AF:AI clear 예정 (--apply 로 실행)`); return; }
  // 3) 적용: 불일치 E ensure + AF:AI clear.
  if (updates.length) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: sid, requestBody: { valueInputOption: "USER_ENTERED", data: updates } });
  await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: `'${DB_TAB}'!AF4:AI100` });
  console.log(`  ✔ ${name}: E ${updates.length} 셀 갱신 + AF:AI clear 완료`);
}

// ── 대상 선정 ─────────────────────────────────────────────────
const reg = await sheets.spreadsheets.values.get({ spreadsheetId: REGISTRY_ID, range: `'${TAB}'!A2:F` });
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
  if (!targets.length) { console.error(`이름 '${nameArg}' 의 시트를 찾지 못함.`); process.exit(1); }
} else {
  console.error("--name=<이름> 또는 --all 필요. (드라이런 기본, --apply 로 적용)"); process.exit(1);
}

console.log(`${APPLY ? "[APPLY]" : "[DRY-RUN]"} 현수막 게시로그 → 영업관리 E 이관 — 대상 ${targets.length}개\n`);
for (const t of targets) {
  console.log(`▶ ${t.name} (${t.sid})`);
  try { await migrateOne(t.name, t.sid); } catch (e) { console.log(`  ✘ ${t.name}: 실패 — ${e.message}`); }
}
console.log(`\n${APPLY ? "적용" : "드라이런"} 완료.`);
