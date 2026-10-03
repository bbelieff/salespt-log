/**
 * 수강생 **한 명의 수강시작일·종강일**을 고친다 — 시트 O1/O2 + registry K/L (2026-09-01).
 *
 *   node scripts/ops/set-course-dates.mjs --cohort 11 --name 이정우 --graduation 2026-10-02
 *   node scripts/ops/set-course-dates.mjs ... --execute
 *   (--start 도 함께 줄 수 있다. 생략하면 시작일은 건드리지 않는다)
 *
 * ## 왜 필요한가 (belie 지시, 2026-09-01)
 * 11기 이정우 님은 **4주 과정**이다. 앱은 「종강일」 한 칸(01 영업관리 O2)으로 디데이까지
 * 계산하므로, 4주 디데이를 주려면 O2 를 시작일+28 로 바꿔야 한다.
 * 기수 생성 API 는 종강일을 **시작일+50 으로 계산**해서 쓰기 때문에(ADR-0005) 개별 예외를
 * 넣을 수 없다 — 그래서 단건 수정 도구가 따로 필요하다.
 *
 * registry K/L(캐시 컬럼)도 같이 고친다. 여기가 어긋나면 화면이 시트를 다시 읽거나
 * 옛 날짜를 그대로 보여준다(`me.ts:enrichUsersWithDates` 의 cachedComplete 분기).
 *
 * ## 안전 장치
 *   - **기본 dry-run.** `--execute` 없으면 현재값과 바꿀 값만 출력하고 쓰기 0.
 *   - (기수,이름)이 **정확히 1명**일 때만 진행 — 여러 명이면 중단한다.
 *   - 바꾸기 전 값을 전부 출력한다(되돌리려면 그 값을 다시 넣으면 된다).
 *   - O1/O2 와 registry K/L **그 네 칸만** 건드린다.
 *   - 날짜는 ISO(YYYY-MM-DD)만 받는다. USER_ENTERED 로 써서 시트가 날짜 셀로 인식하게 한다
 *     (RAW 로 쓰면 문자열로 남아 수식이 계산을 못 한다 — 기수 생성 경로와 같은 규칙).
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
const arg = (n, fb = "") => {
  const i = process.argv.indexOf(n);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fb;
};
const EXECUTE = process.argv.includes("--execute");

const COHORT = arg("--cohort");
const NAME = arg("--name");
const START = arg("--start");
const GRAD = arg("--graduation");
const ISO = /^\d{4}-\d{2}-\d{2}$/;

if (!COHORT || !NAME || (!START && !GRAD)) {
  console.error("사용법: --cohort <기수> --name <이름> [--start YYYY-MM-DD] [--graduation YYYY-MM-DD] [--execute]");
  process.exit(2);
}
for (const [k, v] of [["--start", START], ["--graduation", GRAD]]) {
  if (v && !ISO.test(v)) { console.error(`${k} 는 YYYY-MM-DD 형식이어야 합니다: ${v}`); process.exit(2); }
}

function normalizePem(raw) {
  const s = String(raw || "");
  return s.includes("\\n") ? s.replace(/\\n/g, "\n") : s;
}
const sheets = google.sheets({
  version: "v4",
  auth: new google.auth.JWT({
    email: env("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    key: normalizePem(env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY")),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  }),
});

const REG = env("SHEETS_REGISTRY_ID");
const REG_TAB = env("SHEETS_REGISTRY_TAB") || "users";
const SALES_TAB = "01 영업관리"; // = SHEET_RANGES.sales.tab
const str = (v) => String(v ?? "").trim();
const normCohort = (v) => str(v).replace(/기\s*$/, "");

async function main() {
  if (!REG) throw new Error("SHEETS_REGISTRY_ID 미설정");
  console.log(`대상: ${COHORT}기 ${NAME}`);
  console.log(EXECUTE ? "모드: **실행**\n" : "모드: dry-run (쓰기 0)\n");

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: REG,
    range: `${REG_TAB}!A2:L`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const rows = res.data.values ?? [];
  const hits = [];
  rows.forEach((r, i) => {
    if (normCohort(r[1]) === normCohort(COHORT) && str(r[2]) === NAME.trim()) {
      hits.push({ row: i + 2, sid: str(r[3]), K: str(r[10]), L: str(r[11]) });
    }
  });
  if (hits.length !== 1) {
    console.log(`❌ ${hits.length}명 일치 — 1명이 아니면 중단합니다.`);
    hits.forEach((h) => console.log(`   registry r${h.row} 시작=${h.K} 종강=${h.L}`));
    process.exit(1);
  }
  const u = hits[0];
  if (!u.sid) { console.log("❌ 시트가 연결되지 않은 행입니다."); process.exit(1); }

  const cur = await sheets.spreadsheets.values.get({
    spreadsheetId: u.sid,
    range: `'${SALES_TAB}'!O1:O2`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const o = cur.data.values ?? [];
  const curO1 = str(o[0]?.[0]);
  const curO2 = str(o[1]?.[0]);
  console.log(`현재  시트 O1=${curO1 || "(빈값)"}  O2=${curO2 || "(빈값)"}`);
  console.log(`현재  registry r${u.row} K=${u.K || "(빈값)"}  L=${u.L || "(빈값)"}`);
  console.log("");
  if (START) console.log(`바꿀 값  시작일 → ${START}`);
  if (GRAD) console.log(`바꿀 값  종강일 → ${GRAD}`);

  if (!EXECUTE) {
    console.log("\n(dry-run — 쓰기 0. 실제 실행은 --execute)");
    return;
  }

  // 시트 O1/O2 — USER_ENTERED 로 써야 날짜 셀이 되어 수식이 계산한다.
  const sheetData = [];
  if (START) sheetData.push({ range: `'${SALES_TAB}'!O1`, values: [[START]] });
  if (GRAD) sheetData.push({ range: `'${SALES_TAB}'!O2`, values: [[GRAD]] });
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: u.sid,
    requestBody: { valueInputOption: "USER_ENTERED", data: sheetData },
  });
  console.log("시트 O1/O2 반영 완료");

  // registry K/L — RAW(ISO 문자열 그대로. 시리얼 자동변환 방지 — 기존 규칙과 동일).
  const regData = [];
  if (START) regData.push({ range: `${REG_TAB}!K${u.row}`, values: [[START]] });
  if (GRAD) regData.push({ range: `${REG_TAB}!L${u.row}`, values: [[GRAD]] });
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: REG,
    requestBody: { valueInputOption: "RAW", data: regData },
  });
  console.log(`registry r${u.row} K/L 반영 완료`);
  console.log("\n완료. 되돌리려면 위 '현재' 값을 다시 넣으면 됩니다.");
}

main().catch((e) => {
  console.error("실패:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
