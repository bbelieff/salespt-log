/**
 * 1회용 — 레지스트리 정정 2건 (2026-06-16).
 *  ① 최정한 A1-6 아레나 prep 행(sheetId 1IHhUq…)의 A열 email = onjung0401@gmail.com.
 *     ※ sheetId 로 식별(동명 6기 행 1XPPJ… 와 혼동 금지). 멱등(이미 채워졌으면 skip).
 *  ② 검증용 더미 트레이너 행(email=fieldgrid-verify@example.com) 삭제. 멱등(없으면 skip).
 * 항상 백업, 변경 셀만(§2.5). SA 인증(backfill 패턴).
 *
 * 실행: node scripts/registry-fixups-2026-06-16.mjs           # 드라이런
 *       node scripts/registry-fixups-2026-06-16.mjs --apply   # 실제
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { google } from "googleapis";

const APPLY = process.argv.includes("--apply");
const ARENA_SHEET_ID = "1IHhUqvVw73XVjivbcuiPVV9WH3nCryWQqXStbyjWIm0";
const ARENA_EMAIL = "onjung0401@gmail.com";
const DELETE_EMAIL = "fieldgrid-verify@example.com";

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

const meta = await sheets.spreadsheets.get({
  spreadsheetId: REGISTRY_ID,
  fields: "sheets(properties(sheetId,title))",
});
const tabGid = (meta.data.sheets ?? []).find((s) => s.properties?.title === TAB)
  ?.properties?.sheetId;
if (tabGid === undefined) {
  console.error(`'${TAB}' 탭을 찾지 못했습니다.`);
  process.exit(1);
}

const res = await sheets.spreadsheets.values.get({
  spreadsheetId: REGISTRY_ID,
  range: `'${TAB}'!A2:R`,
});
const rows = res.data.values ?? [];
const backup = `scripts/_backup-users-${env("BACKUP_STAMP") || "manual"}.json`;
writeFileSync(backup, JSON.stringify(rows, null, 2));
console.log(`백업 저장: ${backup} (${rows.length}행)\n`);

const edits = [];
let deleteRow = null;
console.log("=== 계획 ===");

// ① 최정한 A1-6 prep 행 email 채움 (sheetId 로 식별)
let arenaRowIdx = -1;
rows.forEach((r, i) => {
  if (String(r[3] ?? "").trim() === ARENA_SHEET_ID) arenaRowIdx = i;
});
if (arenaRowIdx < 0) {
  console.log(`  [⚠] A1-6 prep 행(sheet ${ARENA_SHEET_ID.slice(0, 8)}…)을 못 찾음 — 수동 확인`);
} else {
  const r = rows[arenaRowIdx];
  const rowNum = arenaRowIdx + 2;
  console.log(`  ① row${rowNum}: [${String(r[1] ?? "").trim()}·${String(r[2] ?? "").trim()}·email=${r[0] || "(빈칸)"}·sheet ${ARENA_SHEET_ID.slice(0, 8)}…]`);
  if (norm(r[0]) === norm(ARENA_EMAIL)) {
    console.log(`     (이미 ${ARENA_EMAIL} — skip)`);
  } else if (String(r[0] ?? "").trim() === "") {
    edits.push({ rowNum, after: ARENA_EMAIL });
    console.log(`     → A열 email 채움: ${ARENA_EMAIL}`);
  } else {
    console.log(`     [⚠] 이미 다른 email(${r[0]}) — 덮어쓰지 않음(수동 확인)`);
  }
}

// ② 더미 트레이너 행 삭제
let dummyIdx = -1;
rows.forEach((r, i) => {
  if (norm(r[0]) === norm(DELETE_EMAIL)) dummyIdx = i;
});
if (dummyIdx < 0) {
  console.log(`  ② ${DELETE_EMAIL}: 없음 — skip(멱등)`);
} else {
  deleteRow = dummyIdx + 2;
  const r = rows[dummyIdx];
  console.log(`  ② row${deleteRow}: [${String(r[1] ?? "").trim()}·${String(r[2] ?? "").trim()}·${String(r[4] ?? "").trim()}·${DELETE_EMAIL}] → 삭제`);
}

if (edits.length === 0 && deleteRow === null) {
  console.log("\n변경 없음(멱등).");
  process.exit(0);
}
if (!APPLY) {
  console.log(`\n*** 드라이런 — 쓰기 없음. email채움 ${edits.length} · 삭제 ${deleteRow ? 1 : 0}. 실제: --apply ***`);
  process.exit(0);
}

// 적용: email 채움(update) → 행 삭제(맨 마지막, 단일)
if (edits.length) {
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: REGISTRY_ID,
    requestBody: {
      valueInputOption: "RAW",
      data: edits.map((e) => ({ range: `'${TAB}'!A${e.rowNum}`, values: [[e.after]] })),
    },
  });
  console.log(`\nemail 채움 ${edits.length}건 적용.`);
}
if (deleteRow !== null) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: REGISTRY_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: { sheetId: tabGid, dimension: "ROWS", startIndex: deleteRow - 1, endIndex: deleteRow },
          },
        },
      ],
    },
  });
  console.log(`더미 트레이너 행(row${deleteRow}) 삭제 완료.`);
}
console.log("\n완료. 레지스트리 캐시 60s TTL 자동 반영.");
