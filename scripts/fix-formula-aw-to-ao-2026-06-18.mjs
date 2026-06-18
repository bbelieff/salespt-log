/**
 * 시트 #VALUE! 근본수정 (2026-06-18) — 01 영업관리 수식의 그리드 밖 이월 guard 참조
 * `'04 …'!AW:AW`(컬럼49, 45컬럼 그리드 밖) → `…!AO:AO`(이월 정본 컬럼)로 **표면 치환**.
 *
 * 왜 치환인가: 코드(setup-formulas)는 AO:AO 정상. 라이브만 과거 컬럼삽입으로 AO→AW
 * 시프트된 stale. installFormulas 재설치가 정석이나(admin/tsx 불가), 깨진 부분만
 * 최소·가역 수정 = `AW:AW`→`AO:AO` 치환(다른 수식·값·구조 무변경). §2.5: 수식 셀만 손댐.
 *
 * 안전: 변경 전 원본 수식 백업(JSON). AW 는 그리드 밖이라 정상 수식이 참조할 일 없음.
 * 멱등(AW 없으면 변경 0).
 *
 * 실행: node scripts/fix-formula-aw-to-ao-2026-06-18.mjs --name=강구수          # 단건 드라이런
 *       node scripts/fix-formula-aw-to-ao-2026-06-18.mjs --name=강구수 --apply  # 단건 적용
 *       node scripts/fix-formula-aw-to-ao-2026-06-18.mjs --all                  # 전 trainee 드라이런
 *       node scripts/fix-formula-aw-to-ao-2026-06-18.mjs --all --apply          # 전 trainee 적용
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { google } from "googleapis";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const ALL = args.includes("--all");
const nameArg = (args.find((a) => a.startsWith("--name=")) || "").split("=")[1];

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
const env = (() => {
  const fe = loadEnvFile();
  return (k) => process.env[k] || fe[k] || "";
})();
const REGISTRY_ID = env("SHEETS_REGISTRY_ID");
const TAB = env("SHEETS_REGISTRY_TAB") || "users";
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const SA_KEY = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
if (!REGISTRY_ID || !SA_EMAIL || !SA_KEY) {
  console.error("자격(REGISTRY / SA) 누락.");
  process.exit(1);
}
const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, [
  "https://www.googleapis.com/auth/spreadsheets",
]);
const sheets = google.sheets({ version: "v4", auth });

const SALES = "'01 영업관리'";
const RANGE = `${SALES}!A1:Z310`; // 펀넬·일별 블록(~276행+) 포함
const colName = (i) => {
  let n = "", x = i;
  do { n = String.fromCharCode(65 + (x % 26)) + n; x = Math.floor(x / 26) - 1; } while (x >= 0);
  return n;
};

// 대상 시트 목록
const reg = await sheets.spreadsheets.values.get({
  spreadsheetId: REGISTRY_ID,
  range: `'${TAB}'!A2:F`,
});
const rows = reg.data.values ?? [];
let targets = [];
if (ALL) {
  const seen = new Set();
  for (const r of rows) {
    const sid = String(r[3] ?? "").trim();
    const role = String(r[4] ?? "").trim();
    if (role === "trainee" && sid && !seen.has(sid)) {
      seen.add(sid);
      targets.push({ name: String(r[2] ?? "").trim(), cohort: String(r[1] ?? "").trim(), sid });
    }
  }
} else if (nameArg) {
  const hit = rows.find((r) => String(r[2] ?? "").includes(nameArg) && String(r[3] ?? "").trim());
  if (!hit) { console.error(`이름 '${nameArg}' 시트 못 찾음.`); process.exit(1); }
  targets = [{ name: String(hit[2]).trim(), cohort: String(hit[1] ?? "").trim(), sid: String(hit[3]).trim() }];
} else {
  console.error("--name=<이름> 또는 --all 필요.");
  process.exit(1);
}

console.log(`대상 ${targets.length}개 시트 · ${APPLY ? "APPLY" : "DRYRUN"}\n`);
const backupAll = {};
let totalCells = 0, totalSheetsChanged = 0;

for (const t of targets) {
  let res;
  try {
    res = await sheets.spreadsheets.values.get({
      spreadsheetId: t.sid, range: RANGE, valueRenderOption: "FORMULA",
    });
  } catch (e) {
    console.log(`  [skip] ${t.name}(${t.cohort}) read 실패: ${e.message}`);
    continue;
  }
  const grid = res.data.values ?? [];
  const updates = [];
  const bak = [];
  grid.forEach((row, ri) => {
    (row ?? []).forEach((cell, ci) => {
      if (typeof cell !== "string" || !cell.includes("AW:AW")) return;
      const fixed = cell.split("AW:AW").join("AO:AO");
      if (fixed === cell) return;
      const a1 = `${SALES}!${colName(ci)}${ri + 1}`;
      updates.push({ range: a1, values: [[fixed]] });
      bak.push({ a1, before: cell });
    });
  });
  if (updates.length === 0) {
    console.log(`  ${t.name}(${t.cohort}) ${t.sid.slice(0,8)}… : AW 없음 — skip`);
    continue;
  }
  totalSheetsChanged++;
  totalCells += updates.length;
  backupAll[t.sid] = { name: t.name, cells: bak };
  console.log(`  ${t.name}(${t.cohort}) ${t.sid.slice(0,8)}… : AW:AW→AO:AO ${updates.length}셀${APPLY ? " 적용" : ""}`);
  if (APPLY) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: t.sid,
      requestBody: { valueInputOption: "USER_ENTERED", data: updates },
    });
    await new Promise((r) => setTimeout(r, 400)); // 쿼터 throttle
  }
}

const stamp = env("BACKUP_STAMP") || (APPLY ? "applied" : "dryrun");
const bf = `scripts/_backup-formula-aw-${stamp}.json`;
writeFileSync(bf, JSON.stringify(backupAll, null, 2));
console.log(`\n백업(원본 수식): ${bf}`);
console.log(`요약: 시트 ${totalSheetsChanged}개 · ${totalCells}셀 ${APPLY ? "적용 완료" : "(드라이런)"}`);
if (!APPLY) console.log("실제 적용: --apply");
