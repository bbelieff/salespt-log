/**
 * 파일럿 기수 02 계약 — 시트 vs DB 드리프트 **읽기 전용 계수** (결정함 9번 1단계 · BBE-50 후속).
 *
 * 실행 위치: **VPS** (.env/.env.local 에 SA·SHEETS_REGISTRY_ID·DATABASE_URL 보유)
 *   — GitHub Actions "DB Contract Drift Audit" 워크플로가 SSH 로 실행.
 *   node scripts/ops/db-contract-drift-audit.mjs [--cohort <라벨,라벨,...>]
 *   생략 시 **파일럿 전 기수 자동 탐지**(daily-source.ts isDbReadPilot 과 동일 판정: 8·9·연습·아레나 A{n}-{m}).
 *
 * ★NOT_RUN 엄수: 이 파일은 어떤 write API 도 호출하지 않는다(Sheets values.get·pg SELECT 만).
 *   시트 수정·DB INSERT/UPDATE·2단계(실수정) 착수 전부 금지 — 위반 없는지 리뷰로 확인 가능하게
 *   파일 전체에 values.update/append/batchUpdate·INSERT/UPDATE/DELETE 문자열이 없다.
 *
 * ## 무엇을 세는가 (02 계약수납 — R3-3 dual-sync 갭이 남길 수 있는 4종류)
 *   ① 유령 계약 — DB 엔 살아있는데(not _cleared) 시트 해당 행은 이미 비어 있음
 *   ② 계약일·업체명 불일치 — 둘 다 있는데 값이 다름
 *   ③ _cleared 플래그 불일치 — DB 는 지워짐 표시인데 시트엔 데이터가 있음(역방향)
 *   ④ 해지 반영 불일치(퍼널 계약수 영향) — 시트 해지일 유무와 DB 해지일 유무가 다름.
 *      `terminatedByChannel`/`terminatedByWeek`(dashboard.ts)가 DB 값으로 계산되므로,
 *      이 드리프트가 있으면 파일럿 화면의 **퍼널 계약수가 실제보다 많이(또는 적게) 표시**된다.
 *
 * 파싱은 `lib/repo/db/read-daily.ts contractFromDbPayload` 와 **동일 규칙**(열문자 우선 →
 * 필드명 오버레이)을 손으로 재현한다 — 실제 앱이 그 계약을 어떻게 읽는지와 정확히 같아야
 * "드리프트"가 사용자 체감과 일치한다. ★비밀값·email 원문 미출력(마스킹).
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
const mask = (e) => (e ? e.replace(/^(.{2}).*(@.*)$/, "$1***$2") : "");

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? String(process.argv[i + 1] ?? "").trim() : "";
};
const COHORT_FILTER = arg("--cohort")
  .split(",").map((s) => s.trim().replace(/기\s*$/, "")).filter(Boolean);

const REGISTRY_ID = env("SHEETS_REGISTRY_ID");
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const SA_KEY = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
const DB_URL = env("DATABASE_URL");
if (!REGISTRY_ID || !SA_EMAIL || !SA_KEY || !DB_URL) {
  console.error("❌ env 누락(SHEETS_REGISTRY_ID·SA·DATABASE_URL) — VPS 에서 실행하세요.");
  process.exit(2);
}

const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
]);
const sheets = google.sheets({ version: "v4", auth });

// ── daily-source.ts isDbReadPilot 과 동일 판정(하드코딩 재현 — 이 스크립트는 TS import 없음) ──
const DB_READ_COHORTS = new Set(["8", "9", "연습"]);
const isArenaLabel = (c) => /^A\d+-\d+/.test(String(c).trim());
function isPilotCohort(cohortRaw) {
  const norm = String(cohortRaw ?? "").replace(/기\s*$/, "").trim();
  if (COHORT_FILTER.length) return COHORT_FILTER.includes(norm);
  return DB_READ_COHORTS.has(norm) || isArenaLabel(norm);
}

async function grid(sid, range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sid, range, valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  }).catch(() => null);
  return res?.data.values ?? [];
}
const str = (v) => String(v ?? "").trim();
/** 날짜 셀(serial 또는 문자열) → ISO. 아니면 원문 trim. */
function dateish(v) {
  const s = str(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const n = Number(v);
  if (Number.isFinite(n) && n >= 20000) return new Date((n - 25569) * 86400000).toISOString().slice(0, 10);
  return s;
}

/** 02 탭에서 계약일/업체명/해지일 만 뽑는다(감사 목적 — 전량 파싱 불필요). C 기준 상대 idx. */
async function readSheetContracts(sid) {
  for (const [tabName, firstDataRow] of [["02 계약수납관리", 6], ["02 계약관리", 5]]) {
    const rows = await grid(sid, `'${tabName}'!C1:AO`);
    if (rows.length === 0) continue;
    const out = new Map();
    rows.forEach((r, i) => {
      const sheetRow = i + 1;
      if (sheetRow < firstDataRow) return;
      const 계약일 = dateish(r[0]); // C
      if (!계약일 || /계약일/.test(계약일)) return; // 헤더/예시 방어(backfill 과 동일 필터)
      out.set(`r${sheetRow}`, {
        계약일, 업체명: str(r[1]), // D
        해지일: dateish(r[35]), // AL (rel idx = 37-2)
      });
    });
    return out;
  }
  return new Map();
}

/** backfill 문자열 값 → 시트 UNFORMATTED 원형 복원 — read-daily.ts coerce() 와 동일. */
function coerce(v) {
  if (typeof v !== "string") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}
/** DB payload → {계약일,업체명,해지일,_cleared} — contractFromDbPayload 와 동일 우선순위
 * (열문자 backfill 값 → 필드명 dual-write 값이 오버라이드). 열문자 값은 coerce 로 원복한
 * 뒤 dateish 로 serial→ISO 변환한다 — 실제 rowToCP(serialToISODate) 와 동일 규칙이어야
 * "158건 불일치"류 오탐(날짜 표현형 차이일 뿐인데 값이 다르다고 잘못 세는 것)을 안 만든다. */
function fromDbPayload(p) {
  let 계약일 = dateish(coerce(p.C)), 업체명 = str(coerce(p.D)), 해지일 = dateish(coerce(p.AL));
  if (p.계약일 !== undefined && p.계약일 !== null) 계약일 = dateish(p.계약일);
  if (p.업체명 !== undefined && p.업체명 !== null) 업체명 = str(p.업체명);
  if (p.해지일 !== undefined && p.해지일 !== null) 해지일 = dateish(p.해지일);
  const _cleared = p._cleared === true || p._cleared === "true";
  return { 계약일, 업체명, 해지일, _cleared };
}

async function main() {
  console.log("\n🔎 02 계약 시트↔DB 드리프트 감사 (읽기 전용 · 데이터 변경 0건)\n");
  const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false }, max: 3 });

  const reg = await grid(REGISTRY_ID, "'users'!A2:R");
  const targets = reg
    .map((r) => ({
      email: str(r[0]).toLowerCase(), cohort: str(r[1]), sid: str(r[3]),
      role: str(r[4]) || "trainee",
    }))
    .filter((u) => u.sid && u.role === "trainee" && isPilotCohort(u.cohort));
  console.log(`대상: ${COHORT_FILTER.length ? `지정 기수(${COHORT_FILTER.join(",")})` : "파일럿 전 기수(8·9·연습·아레나)"} — 시트 ${targets.length}개\n`);

  let ghost = 0, mismatch = 0, clearedFlagMismatch = 0, termMismatch = 0;
  const perPerson = [];

  for (const u of targets) {
    const [sheetMap, dbRes] = await Promise.all([
      readSheetContracts(u.sid),
      pool.query(`select row_key, payload from sheet_rows where spreadsheet_id=$1 and tab='contracts'`, [u.sid]),
    ]);
    let pGhost = 0, pMismatch = 0, pCleared = 0, pTerm = 0;
    const rowKeys = new Set([...sheetMap.keys(), ...dbRes.rows.map((r) => r.row_key)]);
    const dbByKey = new Map(dbRes.rows.map((r) => [r.row_key, fromDbPayload(r.payload)]));

    for (const key of rowKeys) {
      if (!/^r\d+$/.test(key)) continue; // contracts row_key 만(다른 형식 방어)
      const s = sheetMap.get(key); // undefined = 시트에 데이터 없음(빈 행)
      const d = dbByKey.get(key);  // undefined = DB에 이 행 없음
      if (!d) continue; // DB에 없으면 감사 대상 아님(시트만 있는 미백필 행 — 별건)
      if (!s) {
        if (!d._cleared) { ghost++; pGhost++; }
        continue;
      }
      if (d._cleared) { clearedFlagMismatch++; pCleared++; continue; }
      if (s.계약일 !== d.계약일 || s.업체명 !== d.업체명) { mismatch++; pMismatch++; }
      if ((s.해지일 !== "") !== (d.해지일 !== "")) { termMismatch++; pTerm++; }
    }
    if (pGhost + pMismatch + pCleared + pTerm > 0) {
      perPerson.push({ email: mask(u.email), cohort: u.cohort, pGhost, pMismatch, pCleared, pTerm });
    }
  }
  await pool.end();

  console.log("── 결과 (전 파일럿 합계) ──");
  console.log(`시트 대상            : ${targets.length}개`);
  console.log(`① 유령 계약          : ${ghost}건`);
  console.log(`② 계약일/업체명 불일치 : ${mismatch}건`);
  console.log(`③ _cleared 플래그 불일치: ${clearedFlagMismatch}건`);
  console.log(`④ 해지 반영 불일치(퍼널): ${termMismatch}건`);
  const total = ghost + mismatch + clearedFlagMismatch + termMismatch;
  console.log(`\n합계: ${total}건${total === 0 ? " — 0건, 이 항목 자동 종결 대상" : ""}`);

  if (perPerson.length) {
    console.log("\n── 사람별 내역(영향 있는 사람만, email 마스킹) ──");
    console.log("email | cohort | 유령 | 불일치 | cleared불일치 | 해지불일치");
    for (const p of perPerson) {
      console.log(`${p.email} | ${p.cohort} | ${p.pGhost} | ${p.pMismatch} | ${p.pCleared} | ${p.pTerm}`);
    }
  }
  console.log("\n(데이터 변경 0건 — 이 스크립트는 SELECT/values.get 만 호출했습니다)\n");
}

main().catch((e) => {
  const msg = (e instanceof Error ? e.message : String(e)).replace(/postgres(ql)?:\/\/\S+/gi, "[DATABASE_URL]");
  console.error("감사 실패:", msg);
  process.exit(1);
});
