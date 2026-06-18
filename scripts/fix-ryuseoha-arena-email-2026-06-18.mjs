/**
 * 1회용 — 류서하 A1-2 아레나 prep 행 email 채우기 (2026-06-18).
 *  배경: ondream0501@gmail.com 은 T(트레이너) 행만 있고, A1-2 류서하(심나영) 아레나
 *  prep 행은 email 빈칸 → P14 토글이 ownArenaSheetId(이름매칭)를 못 잡아 아레나 일지
 *  진입 불가. prep 행 A열에 email 채우면 토글 진입 가능(트레이너 랜딩은 그대로).
 *
 *  식별: sheetId(D열) = ARENA_SHEET_ID 로 **정확 식별**(동명 가드). 멱등(이미 채워졌으면 skip).
 *  다른 열·트레이너 행은 그대로. 항상 백업, A열 1셀만(§2.5). SA 인증(기존 정정 스크립트 동일).
 *
 * 실행: node scripts/fix-ryuseoha-arena-email-2026-06-18.mjs           # 드라이런
 *       node scripts/fix-ryuseoha-arena-email-2026-06-18.mjs --apply   # 실제(A열 1셀)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { google } from "googleapis";

const APPLY = process.argv.includes("--apply");
const ARENA_SHEET_ID = "1IFu6WoDCfjdpPPIvy5dS3DG3XdW9I4amMC7XWlhw5I8";
const TARGET_EMAIL = "ondream0501@gmail.com";

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
const fileEnv = loadEnvFile();
const env = (k) => process.env[k] || fileEnv[k] || "";
const REGISTRY_ID = env("SHEETS_REGISTRY_ID");
const TAB = env("SHEETS_REGISTRY_TAB") || "users";
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const SA_KEY = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
if (!REGISTRY_ID || !SA_EMAIL || !SA_KEY) {
  console.error("자격(SHEETS_REGISTRY_ID / SA)을 찾지 못했습니다.");
  process.exit(1);
}

const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, [
  "https://www.googleapis.com/auth/spreadsheets",
]);
const sheets = google.sheets({ version: "v4", auth });
const norm = (s) => String(s ?? "").trim().toLowerCase();

const res = await sheets.spreadsheets.values.get({
  spreadsheetId: REGISTRY_ID,
  range: `'${TAB}'!A2:R`,
});
const rows = res.data.values ?? [];
const backup = `scripts/_backup-users-${env("BACKUP_STAMP") || "manual"}.json`;
writeFileSync(backup, JSON.stringify(rows, null, 2));
console.log(`백업 저장: ${backup} (${rows.length}행)\n`);

let idx = -1;
rows.forEach((r, i) => {
  if (String(r[3] ?? "").trim() === ARENA_SHEET_ID) idx = i;
});
if (idx < 0) {
  console.log(`[⚠] sheetId ${ARENA_SHEET_ID.slice(0, 10)}… 행을 못 찾음 — 수동 확인.`);
  process.exit(1);
}
const r = rows[idx];
const rowNum = idx + 2;
console.log(`=== 대상 row${rowNum} ===`);
console.log(
  `  cohort=${String(r[1] ?? "").trim()} · name=${String(r[2] ?? "").trim()} · ` +
    `role=${String(r[4] ?? "").trim()} · email=${r[0] || "(빈칸)"} · sheet=${ARENA_SHEET_ID.slice(0, 10)}…`,
);

if (norm(r[0]) === norm(TARGET_EMAIL)) {
  console.log(`\n(이미 ${TARGET_EMAIL} — skip, 멱등)`);
  process.exit(0);
}
if (String(r[0] ?? "").trim() !== "") {
  console.log(`\n[⚠] 이미 다른 email(${r[0]}) 점유 — 덮어쓰지 않음(수동 확인).`);
  process.exit(1);
}
console.log(`\n계획: A${rowNum} email "" → ${TARGET_EMAIL}`);

if (!APPLY) {
  console.log(`\n*** 드라이런 — 쓰기 없음. 실제: --apply ***`);
  process.exit(0);
}

await sheets.spreadsheets.values.update({
  spreadsheetId: REGISTRY_ID,
  range: `'${TAB}'!A${rowNum}`,
  valueInputOption: "RAW",
  requestBody: { values: [[TARGET_EMAIL]] },
});
console.log(`\n✓ A${rowNum} → ${TARGET_EMAIL} 적용 완료. 레지스트리 캐시 60s TTL 자동 반영.`);
console.log(`ondream0501 로그인 → 트레이너 페이지 + '내 아레나 일지(A1-2)' 토글 진입 가능.`);
