/**
 * DevF 선행 dry-run (2026-07-14) — 콜·지·기·소 유입 자동화(유입=생산 파생)의 blast radius 실측. READ-ONLY.
 *
 * 왜: 콜지기소 유입을 "생산과 동일" 파생으로 바꾸면, 과거에 사용자가 유입≠생산으로 수동 입력한
 * 기록이 있는 경우 그 주차의 유입 통계(퍼널·컨택성공률 등) 숫자가 바뀐다. 전환 전에 어긋남 건수·
 * 크기를 전 시트에서 실측해 "0~미미면 자율 진행 / 유의미면 belie 결정" 을 판정한다(디스패치 게이트).
 *
 * 좌표(01 영업관리): row = 10 + (week-1)*34 + dayIdx*4 + channelIdx · 콜·지·기·소 = channelIdx 3.
 *   metricCols: E=생산 F=유입 G=컨택진행 H=미팅예약 (lib/config SHEET_RANGES.sales)
 *
 * 쓰기 절대 없음 — spreadsheets.readonly scope + values.get 만.
 * 실행: node scripts/census-lead-inflow-2026-07-14.mjs   (repo root 를 cwd 로 — .env.local 상대참조)
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
const REG_TAB = env("SHEETS_REGISTRY_TAB") || "users";
if (!SA_EMAIL || !SA_KEY || !REGISTRY_ID) { console.error("자격 누락."); process.exit(1); }

const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, ["https://www.googleapis.com/auth/spreadsheets.readonly"]);
const sheets = google.sheets({ version: "v4", auth });

const BLOCK_START = 10, STRIDE = 34, LEAD_IDX = 3, WEEKS = 10, DAYS = 7;
const LAST_ROW = BLOCK_START + (WEEKS - 1) * STRIDE + (DAYS - 1) * 4 + LEAD_IDX; // 343
const num = (v) => (typeof v === "number" ? v : Number(String(v ?? "").replace(/[,\s]/g, "")) || 0);

const reg = await sheets.spreadsheets.values.get({ spreadsheetId: REGISTRY_ID, range: `'${REG_TAB}'!A2:F` });
const seen = new Set();
const targets = [];
for (const r of reg.data.values ?? []) {
  const sid = String(r[3] ?? "").trim();
  if (String(r[4] ?? "").trim() !== "trainee" || !sid || seen.has(sid)) continue;
  seen.add(sid);
  targets.push({ name: String(r[2] ?? "").trim(), cohort: String(r[1] ?? "").trim(), sid });
}

console.log(`콜·지·기·소 유입≠생산 어긋남 전수조사 — ${targets.length} 시트(trainee·유니크) · READ-ONLY\n`);

const per = [];
let totCells = 0, totMismatch = 0, totAbsDiff = 0, errCount = 0;
for (const t of targets) {
  let values;
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: t.sid,
      range: `'01 영업관리'!E${BLOCK_START}:H${LAST_ROW}`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    values = res.data.values ?? [];
  } catch (e) {
    per.push({ ...t, err: (e.message ?? "").slice(0, 50) });
    errCount++;
    continue;
  }
  let cells = 0, mism = 0, absDiff = 0;
  const samples = [];
  for (let w = 1; w <= WEEKS; w++) {
    for (let d = 0; d < DAYS; d++) {
      const idx = (w - 1) * STRIDE + d * 4 + LEAD_IDX; // 범위가 row10 시작이라 그대로 offset
      const row = values[idx] ?? [];
      const prod = num(row[0]); // E 생산
      const inf = num(row[1]);  // F 유입
      if (prod === 0 && inf === 0) continue; // 기록 없음
      cells++;
      if (prod !== inf) {
        mism++;
        absDiff += Math.abs(prod - inf);
        if (samples.length < 3) samples.push(`w${w}d${d} 생산${prod}/유입${inf}`);
      }
    }
  }
  totCells += cells; totMismatch += mism; totAbsDiff += absDiff;
  per.push({ ...t, cells, mism, absDiff, samples });
  await new Promise((r) => setTimeout(r, 120));
}

per.sort((a, b) => (b.mism ?? -1) - (a.mism ?? -1));
const pad = (s, n) => String(s).padEnd(n);
console.log(pad("이름", 12) + pad("기수", 6) + pad("기록셀", 8) + pad("어긋남", 8) + pad("Σ|차|", 8) + "샘플/에러");
console.log("-".repeat(78));
for (const r of per) {
  if (r.err) { console.log(pad(r.name || "?", 12) + pad(r.cohort || "-", 6) + pad("-", 8) + pad("-", 8) + pad("-", 8) + `ERR:${r.err}`); continue; }
  console.log(
    pad(r.name || "?", 12) + pad(r.cohort || "-", 6) + pad(r.cells, 8) +
    pad(r.mism, 8) + pad(r.absDiff, 8) + (r.samples.length ? r.samples.join(", ") : ""),
  );
}
console.log("-".repeat(78));
const affected = per.filter((r) => !r.err && r.mism > 0).length;
console.log(`\n요약`);
console.log(`  대상 시트: ${targets.length} (읽기실패 ${errCount})`);
console.log(`  콜지기소 기록 있는 셀(생산 or 유입 ≠0): ${totCells}`);
console.log(`  유입≠생산 어긋남 셀: ${totMismatch}  (${totCells ? ((totMismatch / totCells) * 100).toFixed(1) : 0}%)`);
console.log(`  어긋난 시트 수: ${affected} / ${targets.length - errCount}`);
console.log(`  Σ|생산-유입| (파생 전환 시 유입 총합 변동폭): ${totAbsDiff}`);
console.log(`\n판정 기준(디스패치): 0~미미 → 자율 진행 · 유의미 → 📥 belie 결정함 등재 후 보류`);
