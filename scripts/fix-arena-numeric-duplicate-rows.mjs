/**
 * 1회용 — 아레나 시트의 숫자 기수 중복 행 정리 (arena-numeric-duplicate-claim-guard).
 *
 * 대상(이메일 기준, sheetId 재확인 후 정확히 그 행만):
 *  - zzzddz01@gmail.com  : 숫자(3,정유영) 행 삭제 — A1-3 정유영(조성도) 이 이미 보유.
 *  - onjuncenter@gmail.com: 숫자(1,이재영) 행 삭제 — A1-1 이재영 이 이미 보유.
 *  - goubletgt@gmail.com  : A1-5 김효준 prep(빈 이메일) 행에 채우고 숫자(5,김효준) 행 삭제.
 * 멱등(이미 정리됐으면 skip), 항상 백업, 변경 셀만(§2.5).
 *
 * 실행: node scripts/fix-arena-numeric-duplicate-rows.mjs           # 드라이런
 *       node scripts/fix-arena-numeric-duplicate-rows.mjs --apply   # 실제
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { google } from "googleapis";

const APPLY = process.argv.includes("--apply");
const TARGETS = [
  { email: "zzzddz01@gmail.com", name: "정유영", fillArena: false },
  { email: "onjuncenter@gmail.com", name: "이재영", fillArena: false },
  { email: "goubletgt@gmail.com", name: "김효준", fillArena: true },
];

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
const isArena = (c) => /^A\d+-/.test(String(c ?? "").trim());
const isNumeric = (c) => /^\d/.test(String(c ?? "").trim());

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

// 인덱스: rowNum(1-based 시트행) = i+2
const get = (i) => {
  const r = rows[i] ?? [];
  return {
    rowNum: i + 2,
    email: String(r[0] ?? ""),
    cohort: String(r[1] ?? "").trim(),
    name: String(r[2] ?? "").trim(),
    sheetId: String(r[3] ?? "").trim(),
  };
};

const edits = []; // {rowNum, col:'A', after}
const deletes = []; // rowNum
console.log("=== 계획 ===");
for (const t of TARGETS) {
  // 숫자 기수 + 해당 이메일 행
  let numeric = null;
  for (let i = 0; i < rows.length; i++) {
    const g = get(i);
    if (norm(g.email) === norm(t.email) && isNumeric(g.cohort)) { numeric = g; break; }
  }
  if (!numeric) {
    console.log(`  [skip] ${t.email}: 숫자 기수 중복 행 없음(이미 정리됨)`);
    continue;
  }
  // 같은 sheetId 의 아레나 행
  let arena = null;
  for (let i = 0; i < rows.length; i++) {
    const g = get(i);
    if (g.sheetId === numeric.sheetId && isArena(g.cohort)) { arena = g; break; }
  }
  if (!arena) {
    console.log(`  [⚠ 보류] ${t.email}: sheetId=${numeric.sheetId} 의 아레나 행을 못 찾음 → 안전상 건너뜀(수동 확인)`);
    continue;
  }
  console.log(`  ${t.name}(${t.email}):`);
  console.log(`     숫자행 row${numeric.rowNum} [${numeric.cohort}·${numeric.name}·sheet ${numeric.sheetId.slice(0,8)}…] → 삭제`);
  console.log(`     아레나행 row${arena.rowNum} [${arena.cohort}·${arena.name}·email=${arena.email||"(빈칸)"}]`);
  if (t.fillArena) {
    if (!arena.email) {
      edits.push({ rowNum: arena.rowNum, after: t.email });
      console.log(`        → 아레나행 A열 email 채움: ${t.email}`);
    } else if (norm(arena.email) === norm(t.email)) {
      console.log(`        (아레나행에 이미 동일 이메일 — email 채움 skip)`);
    } else {
      console.log(`        (아레나행 email=${arena.email} ≠ 대상 — 채우지 않음, 숫자행만 삭제)`);
    }
  } else if (norm(arena.email) !== norm(t.email)) {
    console.log(`        (확인: 아레나행 email=${arena.email||"(빈칸)"} — 대상과 불일치하나 명세상 삭제 진행)`);
  }
  deletes.push(numeric.rowNum);
}

if (edits.length === 0 && deletes.length === 0) {
  console.log("\n변경 없음(멱등 — 이미 정리됨).");
  process.exit(0);
}
if (!APPLY) {
  console.log(`\n*** 드라이런 — 쓰기 없음. 삭제 ${deletes.length} · email채움 ${edits.length}. 실제: --apply ***`);
  process.exit(0);
}

// 적용: (1) email 채움 update → (2) 행 삭제 desc(인덱스 안정)
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
const delDesc = [...new Set(deletes)].sort((a, b) => b - a);
if (delDesc.length) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: REGISTRY_ID,
    requestBody: {
      requests: delDesc.map((rowNum) => ({
        deleteDimension: {
          range: { sheetId: tabGid, dimension: "ROWS", startIndex: rowNum - 1, endIndex: rowNum },
        },
      })),
    },
  });
  console.log(`숫자 기수 중복 행 삭제: row ${delDesc.join(", ")} (${delDesc.length}건).`);
}
console.log("\n완료. 레지스트리 캐시 60s TTL 자동 반영.");
