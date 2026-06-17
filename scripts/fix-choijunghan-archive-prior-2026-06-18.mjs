/**
 * 1회용 — 최정한(onjung0401) 6기 행 status → archived 정정 (2026-06-18).
 *  배경: A1-6 아레나 행을 raw 스크립트로 수동 등록(claimAccount 우회)해
 *  6기 행이 active 로 잔류 → 활성행 2개 → 아레나/이월 판정 오작동.
 *  정상 재참가자는 6기=archived. 같은 상태로 맞춘다(A1-6·T 행은 그대로).
 *
 *  식별: email=onjung0401@gmail.com + cohort(정규화)=6 + name=최정한.
 *  안전: sheetId 가 A1-6(아레나) 가 아님(=숫자 6기 행)도 검사. 멱등(이미 archived skip).
 *  항상 백업, 변경 셀(F열)만(§2.5). SA 인증(registry edit 권한 — 기존 정정 스크립트 동일).
 *
 * 실행: node scripts/fix-choijunghan-archive-prior-2026-06-18.mjs           # 드라이런(읽기만)
 *       node scripts/fix-choijunghan-archive-prior-2026-06-18.mjs --apply   # 실제(F열 1셀)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { google } from "googleapis";

const APPLY = process.argv.includes("--apply");
const TARGET_EMAIL = "onjung0401@gmail.com";
const TARGET_NAME = "최정한";
const TARGET_COHORT = "6"; // 정규화(후행 "기" 제거) 후 비교

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
const normCohort = (c) => String(c ?? "").replace(/기\s*$/, "").trim();

const res = await sheets.spreadsheets.values.get({
  spreadsheetId: REGISTRY_ID,
  range: `'${TAB}'!A2:R`,
});
const rows = res.data.values ?? [];
const backup = `scripts/_backup-users-${env("BACKUP_STAMP") || "manual"}.json`;
writeFileSync(backup, JSON.stringify(rows, null, 2));
console.log(`백업 저장: ${backup} (${rows.length}행)\n`);

// onjung0401 의 모든 행 출력 (눈으로 확정)
console.log(`=== ${TARGET_EMAIL} 의 모든 레지스트리 행 ===`);
const mine = [];
rows.forEach((r, i) => {
  if (norm(r[0]) !== norm(TARGET_EMAIL)) return;
  const rowNum = i + 2;
  mine.push({ i, rowNum });
  console.log(
    `  row${rowNum}: cohort=${String(r[1] ?? "").trim()} · name=${String(r[2] ?? "").trim()} · ` +
      `role=${String(r[4] ?? "").trim()} · status=${String(r[5] ?? "").trim() || "(빈=active)"} · ` +
      `sheet=${String(r[3] ?? "").trim().slice(0, 10)}… · captain(R)=${String(r[17] ?? "").trim() || "-"}`,
  );
});
if (mine.length === 0) {
  console.log("  (행 없음 — email 확인 필요)");
  process.exit(1);
}

// 행 식별: 6기(숫자) 행 + A1-6(아레나) 행
console.log(`\n=== 정정 계획 ===`);
const COL_R = 17; // captain_of (A=0 … R=17)
let sixIdx = -1;
let arenaIdx = -1;
rows.forEach((r, i) => {
  if (norm(r[0]) !== norm(TARGET_EMAIL)) return;
  const c = normCohort(r[1]);
  const isArena = /^A\d+-\d+$/.test(c);
  if (c === TARGET_COHORT && !isArena && norm(r[2]) === norm(TARGET_NAME)) sixIdx = i;
  if (isArena && norm(r[2]) === norm(TARGET_NAME)) arenaIdx = i;
});
if (sixIdx < 0) {
  console.log(`  [⚠] 6기 숫자 행(cohort=6, ${TARGET_NAME})을 못 찾음 — 수동 확인 필요.`);
  process.exit(1);
}

const writes = []; // { range, value, label }

// ① 6기 status → archived (멱등)
{
  const r = rows[sixIdx];
  const rowNum = sixIdx + 2;
  const cur = String(r[5] ?? "").trim();
  if (cur === "archived") {
    console.log(`  ① row${rowNum} status: 이미 archived — skip(멱등)`);
  } else {
    writes.push({ range: `F${rowNum}`, value: "archived", label: `① F${rowNum} status "${cur || "(빈)"}" → archived` });
  }
}

// ② captain_of 이동: 6기 행(R)에서 제거 → A1-6 행(R)에 부여 (멱등)
//    회장은 아레나 행에 있어야 me/captain 이 읽는다(§B). 현재 6기 행에 잘못 박혀 있음.
{
  const sixCap = String(rows[sixIdx][COL_R] ?? "").trim();
  if (arenaIdx < 0) {
    console.log(`  [⚠] A1-6 아레나 행을 못 찾음 — captain_of 이동 보류(수동 확인).`);
  } else {
    const arenaCap = String(rows[arenaIdx][COL_R] ?? "").trim();
    const desired = sixCap || arenaCap; // 6기 행에 있던 값 우선, 없으면 아레나 행 기존값
    const six = sixIdx + 2;
    const ar = arenaIdx + 2;
    if (sixCap && /^A\d+-\d+$/.test(normCohort(sixCap))) {
      writes.push({ range: `R${six}`, value: "", label: `② R${six} captain_of "${sixCap}" → "" (6기 행에서 제거)` });
    } else if (sixCap) {
      console.log(`  ② R${six} captain_of="${sixCap}" — 아레나 라벨 아님, 건드리지 않음(수동 확인).`);
    }
    if (desired && /^A\d+-\d+$/.test(normCohort(desired)) && arenaCap !== normCohort(desired)) {
      writes.push({ range: `R${ar}`, value: normCohort(desired), label: `② R${ar} captain_of "${arenaCap || "(빈)"}" → "${normCohort(desired)}" (아레나 행에 부여)` });
    } else if (arenaCap) {
      console.log(`  ② R${ar} captain_of 이미 "${arenaCap}" — skip(멱등)`);
    }
  }
}

if (writes.length === 0) {
  console.log("\n변경 없음(멱등).");
  process.exit(0);
}
writes.forEach((w) => console.log(`  ${w.label}`));

if (!APPLY) {
  console.log(`\n*** 드라이런 — 쓰기 없음. 실제 적용: --apply ***`);
  process.exit(0);
}

await sheets.spreadsheets.values.batchUpdate({
  spreadsheetId: REGISTRY_ID,
  requestBody: {
    valueInputOption: "RAW",
    data: writes.map((w) => ({ range: `'${TAB}'!${w.range}`, values: [[w.value]] })),
  },
});
console.log(`\n✓ ${writes.length}셀 적용 완료. 레지스트리 캐시 60s TTL 자동 반영.`);
console.log(`이후: admin '이월 실행'(arena-carryover, 코드 배포 후) 으로 6기 파이프라인 복사.`);
