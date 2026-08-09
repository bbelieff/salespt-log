/**
 * 9기 등록 마무리 (fix/cohort9-finalize) — 레지스트리 오염행 보정 + 시트 프로필/날짜.
 *
 * 실행: PC 로컬(.env.local 의 SA). **dry-run 기본**, --execute 시 실제 기록. 멱등.
 *   node scripts/ops/finalize-cohort9.mjs [--execute] [--verify]
 *
 * 담당 범위(이 스크립트): ① "a9/a유민영" 행 B·C in-place 보정 ② 5개 시트 B3/C3/O1/O2.
 * 나머지는 기존 로직 재사용(로컬 dev + admin API): prep upsert(D+I~L 캐시) =
 * /api/admin/add-trainee-prep · 수식 = /api/admin/install-formulas-by-id (§2.5 가드).
 * --verify: 레지스트리 9기 행 표 + 각 시트 B3/O1/O2 실측 출력만.
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

const EXECUTE = process.argv.includes("--execute");
const VERIFY_ONLY = process.argv.includes("--verify");

const REGISTRY_ID = env("SHEETS_REGISTRY_ID");
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const SA_KEY = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
if (!REGISTRY_ID || !SA_EMAIL || !SA_KEY) {
  console.error("SA/레지스트리 env 누락 (.env.local 확인)");
  process.exit(1);
}
const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, [
  "https://www.googleapis.com/auth/spreadsheets",
]);
const sheets = google.sheets({ version: "v4", auth });

// ── 확정 명세 (핸드오프 2026-07-07) ──────────────────────────────
const COHORT = "9";
const START_ISO = "2026-07-10";
const GRAD_ISO = "2026-08-29"; // 시작+50일 (ADR-0005 7기+, O2 직접값)
const MEMBERS = [
  { name: "구상희", sid: "1yPHJDw5K5NBMix4N6uCXrSgk_7h2NOAdKYa7zJXEsQs" },
  { name: "유민영", sid: "1hG0C5evL2PFGsvVgM9NqqEuL8l8E2BpcRiBM7vh4Qxo" },
  { name: "박진우(조다영)", sid: "1o8ogmm_s6U02LyRdcfmm0XIpN_x-yoXjtPQPuWCLXwA" },
  { name: "오이슬", sid: "1PqfgZ9_s5iKhsDz23jmFoIcXNH4ljKMB2XYUIsNi15M" },
  { name: "전수민", sid: "1Yz8Ap0dvdD0-7b7LOTykCv3ytoSEN8ESqA_tWrpClF0" },
];

async function get(range, sid = REGISTRY_ID, opts = {}) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sid,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
    ...opts,
  });
  return res.data.values ?? [];
}

async function registryRows() {
  return get("'users'!A2:L");
}

function fmt(rows) {
  console.log("행# | cohort | name | sheetId(끝8) | I(라벨) | K(시작) | L(종강)");
  rows.forEach(({ i, r }) =>
    console.log(
      `${i + 2} | ${r[1] ?? ""} | ${r[2] ?? ""} | …${String(r[3] ?? "").slice(-8)} | ${r[8] ?? ""} | ${r[10] ?? ""} | ${r[11] ?? ""}`,
    ),
  );
}

async function verify() {
  const rows = await registryRows();
  const nine = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => String(r[1] ?? "").replace(/기\s*$/, "").trim() === COHORT);
  console.log(`\n── 레지스트리 9기 행 (${nine.length}행) ──`);
  fmt(nine);
  const sids = nine.map(({ r }) => String(r[3] ?? "").trim()).filter(Boolean);
  const dup = sids.length !== new Set(sids).size;
  console.log(`시트ID 중복: ${dup ? "❌ 있음" : "0 ✅"} · 목표 5행: ${nine.length === 5 ? "✅" : "❌"}`);
  console.log("\n── 시트 실측 (B3 | C3 | O1 | O2) ──");
  for (const m of MEMBERS) {
    const v = await get("'01 영업관리'!B3:C3", m.sid).catch(() => []);
    const o = await get("'01 영업관리'!O1:O2", m.sid).catch(() => []);
    console.log(
      `${m.name}: B3=${v[0]?.[0] ?? "?"} | C3=${v[0]?.[1] ?? "?"} | O1=${o[0]?.[0] ?? "?"} | O2=${o[1]?.[0] ?? "?"}`,
    );
  }
}

/** --repair: prep API 호출 시 Windows 콘솔 CP949 로 한글이 깨져 append 된 4행 보정
 * (2026-07-07 실측 사고 — 교훈: 레지스트리 쓰기는 curl 아니라 UTF-8 스크립트로).
 * 89·91·92 = C/J 이름 보정 · 90 = 유민영 중복행 클리어(행 삭제 아님) · 87·88 = I~L 재스탬프. */
async function repair() {
  const data = [
    { range: "'users'!C89", values: [["전수민"]] },
    { range: "'users'!C91", values: [["박진우(조다영)"]] },
    { range: "'users'!C92", values: [["오이슬"]] },
    { range: "'users'!J89", values: [["전수민"]] },
    { range: "'users'!J91", values: [["박진우(조다영)"]] },
    { range: "'users'!J92", values: [["오이슬"]] },
    { range: "'users'!I87:L87", values: [["9", "구상희", "2026-07-10", "2026-08-29"]] },
    { range: "'users'!I88:L88", values: [["9", "유민영", "2026-07-10", "2026-08-29"]] },
  ];
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: REGISTRY_ID,
    requestBody: { valueInputOption: "RAW", data },
  });
  console.log("보정 완료 (이름 3+3, I~L 스탬프 2)");
  await sheets.spreadsheets.values.clear({
    spreadsheetId: REGISTRY_ID,
    range: "'users'!A90:R90",
  });
  console.log("90행(깨진 유민영 중복) 클리어 완료");
  return verify();
}

/** cohorts 탭에 9기 활성 행 보장 — admin 화면 기수 박스는 이 탭 기준. 멱등. */
async function ensureCohortRow() {
  const rows = await get("'cohorts'!A2:I");
  rows.forEach((r, i) => console.log(`cohorts ${i + 2}행: ${(r ?? []).join(" | ")}`));
  const has9 = rows.some((r) => String(r?.[0] ?? "").trim() === COHORT);
  if (has9) return console.log("→ 9 행 이미 존재 (멱등 OK)");
  // BBE-97: values.append 는 Sheets 의 테이블 자동탐지에 의존해 열밀림 사고를 냈다
  // (2026-08-05, arena-season2-batch.mjs 헤더 참고) — 방금 읽은 rows 로 다음 빈 행을
  // 직접 계산해 values.update(명시 range)로 쓴다.
  const nextRow = rows.length + 2; // A2 부터 시작하는 데이터 영역
  await sheets.spreadsheets.values.update({
    spreadsheetId: REGISTRY_ID,
    range: `'cohorts'!A${nextRow}:I${nextRow}`,
    valueInputOption: "RAW",
    requestBody: { values: [[COHORT, "active", "", "cohort", "", "", "", "", ""]] },
  });
  console.log(`→ 9 행 생성 완료 (row${nextRow}, active)`);
}

async function main() {
  if (process.argv.includes("--cohort-row")) return ensureCohortRow();
  if (process.argv.includes("--repair")) return repair();
  if (VERIFY_ONLY) return verify();

  console.log(`mode = ${EXECUTE ? "EXECUTE" : "DRY-RUN"}`);
  const rows = await registryRows();

  // ── Phase A: "a9/a유민영" 오염 행 보정 (in-place, 행 삭제 금지) ──
  const yuminSid = MEMBERS[1].sid;
  const dirty = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => {
      const c = String(r[1] ?? "").trim();
      const n = String(r[2] ?? "").trim();
      const d = String(r[3] ?? "").trim();
      return (c === "a9" || n === "a유민영") || (d === yuminSid && c !== COHORT);
    });
  console.log(`\n[A] 오염 후보 행: ${dirty.length}건`);
  fmt(dirty);
  for (const { r, i } of dirty) {
    const sheetRow = i + 2;
    console.log(`  → ${sheetRow}행 B="${r[1]}"→"${COHORT}", C="${r[2]}"→"유민영"`);
    if (EXECUTE) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: REGISTRY_ID,
        requestBody: {
          valueInputOption: "RAW",
          data: [
            { range: `'users'!B${sheetRow}`, values: [[COHORT]] },
            { range: `'users'!C${sheetRow}`, values: [["유민영"]] },
          ],
        },
      });
    }
  }
  if (dirty.length === 0) console.log("  (없음 — 이미 보정됨, 멱등 OK)");

  // ── Phase B: 시트 5개 B3/C3/O1/O2 ──
  console.log("\n[B] 시트 프로필/날짜 세팅 (목표: B3=9 · C3=이름 · O1=2026-07-10 · O2=2026-08-29)");
  for (const m of MEMBERS) {
    const cur = await get("'01 영업관리'!B3:C3", m.sid).catch(() => []);
    const curO = await get("'01 영업관리'!O1:O2", m.sid).catch(() => []);
    console.log(
      `  ${m.name}: 현재 B3=${cur[0]?.[0] ?? "?"} C3=${cur[0]?.[1] ?? "?"} O1=${curO[0]?.[0] ?? "?"} O2=${curO[1]?.[0] ?? "?"}`,
    );
    if (EXECUTE) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: m.sid,
        requestBody: {
          valueInputOption: "USER_ENTERED", // O1/O2 를 실제 날짜 셀로(수식·주차 계산 의존)
          data: [
            { range: "'01 영업관리'!B3:C3", values: [[COHORT, m.name]] },
            { range: "'01 영업관리'!O1", values: [[START_ISO]] },
            { range: "'01 영업관리'!O2", values: [[GRAD_ISO]] },
          ],
        },
      });
      console.log("    ✔ 기록 완료");
    }
  }

  if (!EXECUTE) {
    console.log("\nDRY-RUN — 기록 없음. 검토 후 --execute.");
    console.log("후속(별도 실행): dev 서버에서 add-trainee-prep ×5 → install-formulas-by-id → --verify");
  } else {
    console.log("\nEXECUTE 완료 — 후속: prep API ×5 → 수식 설치 → --verify");
  }
}

main().catch((e) => {
  console.error("실패:", e instanceof Error ? e.message : e);
  process.exit(1);
});
