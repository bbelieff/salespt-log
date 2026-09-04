/**
 * 기수 라벨 감사 — 읽기 전용(쓰기 0건).
 *
 * 왜: 11기 수강생이 「11 + 이름」으로 클레임했는데 8기로 보인다(2026-09-04 belie).
 * 기수는 한 군데가 아니다:
 *   ① registry B열 cohort        … deprecated
 *   ② registry I열 cohortLabel   … 시트 B3 의 캐시
 *   ③ 수강생 시트 B3 셀           … ★정본
 * 셋을 나란히 찍어 어디가 8기인지 가린다.
 *
 * 실행(레포 루트에서):
 *   node scripts/ops/cohort-label-audit.mjs --cohort 11
 *   node scripts/ops/cohort-label-audit.mjs --name 이진호,이효순
 * ★비밀값 미출력 — 이메일 앞 3자, 시트ID 끝 6자리만.
 */
import { existsSync, readFileSync } from "node:fs";
import { google } from "googleapis";

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
const argOf = (n) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? (process.argv[i + 1] ?? "") : "";
};

const WANT_COHORTS = argOf("--cohort").split(",").map((s) => s.replace(/기\s*$/, "").trim()).filter(Boolean);
const WANT_NAMES = argOf("--name").split(",").map((s) => s.trim()).filter(Boolean);

const REGISTRY_ID = env("SHEETS_REGISTRY_ID");
const REGISTRY_TAB = env("SHEETS_REGISTRY_TAB") || "users";
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const SA_KEY = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
if (!REGISTRY_ID || !SA_EMAIL || !SA_KEY) {
  console.error("env 누락 — 레포 루트(.env.local 보유)에서 실행하세요.");
  process.exit(2);
}

const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
]);
const sheets = google.sheets({ version: "v4", auth });

const maskEmail = (e) => {
  const [l, d] = String(e).split("@");
  if (!d) return e ? "(형식이상)" : "(빈값)";
  return `${l.slice(0, 3)}...@${d}`;
};
const maskId = (id) => (id ? `...${String(id).slice(-6)}` : "(없음)");
const norm = (s) => String(s ?? "").replace(/기\s*$/, "").trim();
const pad = (s, n) => String(s).padEnd(n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: REGISTRY_ID,
    range: `${REGISTRY_TAB}!A2:T`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const rows = res.data.values ?? [];

  const picked = [];
  rows.forEach((r, i) => {
    const email = String(r[0] ?? "").trim();
    const cohortB = norm(r[1]);
    const name = String(r[2] ?? "").trim();
    const ssId = String(r[3] ?? "").trim();
    const role = String(r[4] ?? "").trim() || "trainee";
    const status = String(r[5] ?? "").trim() || "active";
    const cohortI = norm(r[8]);
    const nameJ = String(r[9] ?? "").trim();
    const hit =
      (WANT_COHORTS.length > 0 && (WANT_COHORTS.includes(cohortB) || WANT_COHORTS.includes(cohortI))) ||
      (WANT_NAMES.length > 0 && WANT_NAMES.some((n) => name === n || nameJ === n));
    if (hit) picked.push({ row: i + 2, email, cohortB, name, ssId, role, status, cohortI, nameJ });
  });

  if (picked.length === 0) { console.log("해당 행 없음."); return; }

  console.log(`\n[레지스트리 행 ${picked.length}개]\n`);
  console.log(pad("행", 6) + pad("B기수", 7) + pad("I캐시", 7) + pad("이름", 10) + pad("상태", 10) + pad("역할", 9) + pad("시트", 12) + "이메일");
  console.log("-".repeat(95));
  for (const p of picked) {
    console.log(pad(p.row, 6) + pad(p.cohortB || "-", 7) + pad(p.cohortI || "-", 7) + pad(p.name, 10) +
      pad(p.status, 10) + pad(p.role, 9) + pad(maskId(p.ssId), 12) + maskEmail(p.email));
  }

  const uniqueSheets = [...new Set(picked.map((p) => p.ssId).filter(Boolean))];
  console.log(`\n[시트 B3/C3 실측 = 정본] ${uniqueSheets.length}개\n`);
  console.log(pad("시트", 12) + pad("B3(기수)", 11) + pad("C3(이름)", 11) + "레지스트리 이름");
  console.log("-".repeat(72));
  const b3ById = new Map();
  for (const id of uniqueSheets) {
    try {
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: id,
        range: "'01 영업관리'!B3:C3",
        valueRenderOption: "UNFORMATTED_VALUE",
      });
      const v = r.data.values?.[0] ?? [];
      const b3 = String(v[0] ?? "").trim();
      const c3 = String(v[1] ?? "").trim();
      b3ById.set(id, { b3, c3 });
      const who = picked.filter((p) => p.ssId === id).map((p) => p.name).join(",");
      console.log(pad(maskId(id), 12) + pad(b3 || "(빈값)", 11) + pad(c3 || "(빈값)", 11) + who);
    } catch (e) {
      b3ById.set(id, { error: e?.message || String(e) });
      console.log(pad(maskId(id), 12) + "읽기 실패: " + (e?.message || e));
    }
    await sleep(1100);
  }

  console.log("\n[어긋난 곳]\n");
  let bad = 0;
  for (const p of picked) {
    const s = b3ById.get(p.ssId) ?? {};
    if (s.error) continue;
    const b3 = norm(s.b3);
    const parts = [];
    if (p.cohortB && b3 && p.cohortB !== b3) parts.push(`B열 ${p.cohortB} != 시트B3 ${b3}`);
    if (p.cohortI && b3 && p.cohortI !== b3) parts.push(`I캐시 ${p.cohortI} != 시트B3 ${b3}`);
    if (p.cohortB && p.cohortI && p.cohortB !== p.cohortI) parts.push(`B열 ${p.cohortB} != I캐시 ${p.cohortI}`);
    if (parts.length) { bad++; console.log(`  ! 행${p.row} ${p.name} — ${parts.join(" / ")}`); }
  }
  if (bad === 0) console.log("  없음 — 세 곳 모두 일치.");
  console.log(`\n총 ${picked.length}행 중 ${bad}행 어긋남.\n`);
}

main().catch((e) => { console.error("실패:", e?.message || e); process.exit(1); });
