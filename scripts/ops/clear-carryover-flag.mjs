/**
 * 잘못 붙은 **이월 깃발 한 건**을 지운다 — 시트 + DB 양쪽 (2026-09-01 belie 지시).
 *
 *   node scripts/ops/clear-carryover-flag.mjs --sheet <id> --company "김해 결미담" --date 2026-08-29
 *   node scripts/ops/clear-carryover-flag.mjs ... --execute
 *
 * ## 왜 (belie 신고 · 김현민 님 A2-8기)
 * 결미담 2026-08-29 ₩500,000 은 시즌 중(개막 8/7) 계약인데 **이월**로 표시돼 아레나
 * 점수·매출에서 빠졌다. 감사로 확인한 실제 값:
 *   `A2-8기 | r6 | 2026-08-29 | 김해 결미담 | 시트 이월 | DB 이월`
 * 즉 「구분」 칸에 진짜로 "이월"이 들어 있다(날짜 규칙도, DB 단독 오염도 아니었다).
 *
 * **계약(02)만 지우면 안 된다.** 계약의 이월은 출발 미팅(04)의 깃발을 상속한 것이고
 * (`contract-payment-add.ts:addFromContract` — `m?.구분 === "이월"`), 계약을 다시 저장하면
 * 그 미팅에서 다시 물려받는다. 그래서 **04 미팅의 AO/AP 도 같이 지운다.**
 *
 * ## 안전 장치
 *   - **기본 dry-run.** `--execute` 없으면 무엇을 지울지만 출력하고 쓰기 0.
 *   - **정확히 일치할 때만 지운다** — (계약일·업체명)이 맞고 현재 값이 **"이월"** 인 행만.
 *     값이 이미 비어 있으면 건드리지 않는다(멱등 — 두 번 돌려도 안전).
 *   - 여러 행이 맞으면 **아무것도 안 하고 중단**한다(엉뚱한 행을 지우느니 사람이 본다).
 *   - 되돌리는 법: 지운 셀에 다시 `이월` 을 넣으면 끝이다. 지우기 전 값을 전부 출력한다.
 *   - 계약·미팅의 **다른 칸은 건드리지 않는다** — AI/AJ(계약), AO/AP(미팅)만.
 */
import { existsSync, readFileSync } from "node:fs";
import { google } from "googleapis";
import { Pool } from "pg";

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

const SHEET = arg("--sheet");
const COMPANY = arg("--company");
const DATE = arg("--date");
if (!SHEET || !COMPANY || !DATE) {
  console.error("사용법: --sheet <id> --company <업체명> --date <YYYY-MM-DD> [--execute]");
  process.exit(2);
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

const str = (v) => String(v ?? "").trim();
const norm = (v) => str(v).replace(/\s+/g, "");
/** serial·"26/08/29"·"2026. 8. 29." → ISO. db-contract-drift-audit:dateish 와 같은 규칙. */
function dateish(v) {
  const s = str(v);
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const n = Number(s);
  if (Number.isFinite(n) && n >= 20000) {
    return new Date((n - 25569) * 86400000).toISOString().slice(0, 10);
  }
  let m = s.match(/^(\d{2})[./-](\d{1,2})[./-](\d{1,2})\.?$/);
  if (m) return `20${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{4})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{1,2})\.?$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return s;
}

/** 02 계약수납 — 탭 이름 두 가지(구버전 `02 계약관리`, 5행 시작)를 모두 시도. */
const CONTRACT_TABS = [
  { tab: "02 계약수납관리", firstRow: 6 },
  { tab: "02 계약관리", firstRow: 5 },
];
const MEETING_TAB = "04 업체관리(앱자동작성용)";

async function readTab(tab, range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET,
    range: `'${tab}'!${range}`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  return res.data.values ?? [];
}

async function main() {
  console.log(`대상 시트 ${SHEET.slice(0, 8)}… · 업체 "${COMPANY}" · 날짜 ${DATE}`);
  console.log(EXECUTE ? "모드: **실행**\n" : "모드: dry-run (쓰기 0)\n");

  // ── 02 계약 행 찾기 ─────────────────────────────────────────
  let cTab = null, cRows = [], cFirst = 0;
  for (const { tab, firstRow } of CONTRACT_TABS) {
    try {
      cRows = await readTab(tab, `A${firstRow}:AK`);
      cTab = tab; cFirst = firstRow; break;
    } catch { /* 다음 이름 시도 */ }
  }
  if (!cTab) throw new Error("02 계약수납 탭을 못 찾음");

  const cHits = [];
  cRows.forEach((r, i) => {
    if (dateish(r[2]) === DATE && norm(r[3]) === norm(COMPANY)) {
      cHits.push({ row: cFirst + i, 구분: str(r[34]), 원본행id: str(r[35]) });
    }
  });
  if (cHits.length !== 1) {
    console.log(`❌ 02 에서 ${cHits.length}건 일치 — 1건이 아니면 중단합니다.`);
    cHits.forEach((h) => console.log(`   r${h.row} 구분="${h.구분}"`));
    process.exit(1);
  }
  const c = cHits[0];
  console.log(`02 ${cTab} r${c.row} — 구분="${c.구분}" 이월원본행id="${c.원본행id}"`);

  // ── 04 미팅 행 찾기 ─────────────────────────────────────────
  const mRows = await readTab(MEETING_TAB, "A2:AS");
  const mHits = [];
  mRows.forEach((r, i) => {
    if (dateish(r[3]) === DATE && norm(r[6]) === norm(COMPANY)) {
      mHits.push({ row: i + 2, id: str(r[0]), 구분: str(r[40]), 원본행id: str(r[41]) });
    }
  });
  if (mHits.length > 1) {
    console.log(`❌ 04 에서 ${mHits.length}건 일치 — 중단합니다.`);
    process.exit(1);
  }
  const m = mHits[0] ?? null;
  console.log(
    m ? `04 r${m.row} (id ${m.id.slice(0, 8)}…) — 구분="${m.구분}" 이월원본행id="${m.원본행id}"`
      : "04 에서 해당 미팅을 못 찾음 (계약만 처리)",
  );

  const jobs = [];
  if (c.구분 === "이월") jobs.push({ what: "02 계약", tab: cTab, range: `AI${c.row}:AJ${c.row}` });
  else console.log("… 02 구분이 '이월' 이 아님 — 건드리지 않음");
  if (m && m.구분 === "이월") jobs.push({ what: "04 미팅", tab: MEETING_TAB, range: `AO${m.row}:AP${m.row}` });
  else if (m) console.log("… 04 구분이 '이월' 이 아님 — 건드리지 않음");

  if (jobs.length === 0) {
    console.log("\n지울 것이 없습니다(이미 비어 있음). 멱등 — 정상 종료.");
    return;
  }
  console.log("");
  for (const j of jobs) console.log(`${EXECUTE ? "CLEAR" : "PLAN "} ${j.what}  '${j.tab}'!${j.range} → 빈값`);

  if (!EXECUTE) {
    console.log("\n(dry-run — 쓰기 0. 실제 실행은 --execute)");
    return;
  }

  // ── 시트 쓰기 ───────────────────────────────────────────────
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET,
    requestBody: {
      valueInputOption: "RAW",
      data: jobs.map((j) => ({ range: `'${j.tab}'!${j.range}`, values: [["", ""]] })),
    },
  });
  console.log("시트 반영 완료");

  // ── DB 반영 ─────────────────────────────────────────────────
  // 화면(파일럿 기수)은 DB 를 읽는다. 시트만 지우면 화면은 그대로 이월이다.
  const url = env("DATABASE_URL");
  if (!url) {
    console.log("⚠ DATABASE_URL 미설정 — DB 반영 생략. 화면은 아직 이월로 보일 수 있다.");
    return;
  }
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 2 });
  const KEYS = ["AI", "AJ", "구분", "이월원본행id", "원본행id"];
  const strip = KEYS.map((k) => `- '${k}'`).join(" ");
  const r1 = await pool.query(
    `update sheet_rows set payload = payload ${strip}
      where spreadsheet_id = $1 and tab = 'contracts' and row_key = $2`,
    [SHEET, `r${c.row}`],
  );
  console.log(`DB contracts r${c.row} — ${r1.rowCount}행 갱신`);
  if (m && m.구분 === "이월") {
    const MKEYS = ["AO", "AP", "구분", "이월원본행id", "원본행id"];
    const mstrip = MKEYS.map((k) => `- '${k}'`).join(" ");
    const r2 = await pool.query(
      `update sheet_rows set payload = payload ${mstrip}
        where spreadsheet_id = $1 and tab = 'meetings' and row_key = $2`,
      [SHEET, m.id],
    );
    console.log(`DB meetings ${m.id.slice(0, 8)}… — ${r2.rowCount}행 갱신`);
  }
  await pool.end();
  console.log("\n완료. 되돌리려면 같은 칸에 '이월' 을 다시 넣으면 됩니다.");
}

main().catch((e) => {
  const msg = (e instanceof Error ? e.message : String(e)).replace(/postgres(ql)?:\/\/\S+/gi, "[DATABASE_URL]");
  console.error("실패:", msg);
  process.exit(1);
});
