#!/usr/bin/env node
/**
 * BBE-252 계보 — 10기 `13f5c9c271fb`(spreadsheetId 해시) sheet-only 미팅 개별 교정 백필.
 * belie 「이번 라운드 내 종결」 확정(실데이터 변경 승인 완료).
 *
 * 대상 정의: 그 학생의 04 업체관리 탭에서 **A열(id) 이 공란인 행 전부**.
 *   근거(BBE-252 10기 개별조사 코멘트, read-only pass): `rowToMeeting()`(meetings-rows.ts:203)
 *   은 `if (!idStr) return null` 로 id 공란 행을 애초에 파싱 자체를 포기한다. `appendMeeting`
 *   (시트에 미팅을 쓰는 유일한 repo 함수)의 유일한 호출부(meetings-write.ts:151)는 그 앞에서
 *   무조건 `Meeting.parse()`(id 포함 필수 스키마 검증)를 거친다 — 즉 id 공란 행은 앱 저장
 *   경로를 거쳐 시트에 들어갈 수 없다(수학적으로 불가능). → **시트 직접입력 확정.**
 *
 * 공란 처리 규칙(dispatch 지시 "공란 유지 가능하면 유지"): dashboard-parity 의 시트측
 * 리더(`normalizeSheetMeetingRow`)와 DB측 리더(`normalizeDbMeeting` → `fieldOrCol`)는 **둘 다
 * 원본 컬럼 인덱스를 그대로** 읽는다 — 공란 셀은 양쪽 다 `String(undefined ?? "").slice(0,10)`
 * 같은 동일 연산으로 빈 문자열이 된다. 즉 시트의 공란을 DB payload 에서도 그냥 **키 자체를
 * 생략**(비어있지 않은 셀만 payload 에 넣는 기존 backfill-sheet-rows.mjs rowObj 관례 재사용)
 * 하면 parity 지문이 자동으로 일치한다 — "최소 기본값" 대체가 필요 없다(실측 확인, 아래
 * normalizeDbMeeting/normalizeSheetMeetingRow 대칭 참고).
 *
 * row_key: meetings 의 통상 키는 A열 id 이나, 이 행들은 정의상 id 가 없다. contracts/db 탭의
 * "행번호 합성키"(r{행}) 관례를 meetings 에 예외 적용한다(자연키 부재 시 유일하게 안정적인
 * 대체 키 = 시트상의 물리적 위치). id 공란이 유지되므로 백필 후에도 `rowToMeeting()` 은 이
 * 행들을 계속 null 처리(무시)한다 — 파일럿 전환 후에도 앱 화면(미팅 목록 등)에는 안 보인다.
 * "실제 미팅으로 노출"이 아니라 **parity 정합**이 목적이므로 이건 안전하다(오늘 시트에서
 * 안 보이는 것과 동일한 상태를 DB 에서도 유지할 뿐).
 *
 * 실행(VPS): node scripts/ops/bbe252-10gi-meeting-backfill.mjs [--execute]
 * 기본 dry-run(적재 0건). --execute 시 실제 upsert.
 * revert(추가 적재만 하므로 단순 삭제로 원복): 아래 출력의 row_key 목록으로
 *   `delete from sheet_rows where spreadsheet_id='<sid>' and tab='meetings' and row_key = any($1)`
 */
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { google } from "googleapis";
import { Pool } from "pg";

const TARGET_HASH = "13f5c9c271fb"; // BBE-252 read-only 조사에서 확정된 대상(dashboard-parity 해시)

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

const REGISTRY_ID = env("SHEETS_REGISTRY_ID");
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const SA_KEY = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
const DB_URL = env("DATABASE_URL");
if (!REGISTRY_ID || !SA_EMAIL || !SA_KEY || !DB_URL) {
  console.error("bbe252-10gi: env 누락(SHEETS_REGISTRY_ID·SA·DATABASE_URL) — VPS 에서 실행하세요.");
  process.exit(1);
}

const hash12 = (spreadsheetId) => createHash("sha256").update(String(spreadsheetId)).digest("hex").slice(0, 12);
const s = (r, i) => String(r?.[i] ?? "").trim();
const colName = (i) => (i < 26 ? String.fromCharCode(65 + i) : "A" + String.fromCharCode(65 + i - 26));

// meetings-rows.ts COL(id·미팅날짜·상태 등) 과 동일 — .mjs 는 TS import 불가라 사본(SSOT-COPY, G8 관례).
const COL = { id: 0, 예약일: 1, 예약시각: 2, 미팅날짜: 3, 미팅시간: 4, channel: 5, 업체명: 6, 장소: 7, 예약비고: 8, 상태: 9, 계약여부: 10, 수임비: 11, 미팅사유: 12, 계약조건: 15, previousMeetingId: 17 };
const PII_COL_IDX = new Set([COL.업체명, COL.장소, COL.예약비고, COL.미팅사유, COL.계약조건, COL.previousMeetingId]);

let sheets, pool;
function initClients() {
  const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, ["https://www.googleapis.com/auth/spreadsheets.readonly"]);
  sheets = google.sheets({ version: "v4", auth });
  if (EXECUTE) pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false }, max: 3 });
}

async function grid(sid, range) {
  const res = await sheets.spreadsheets.values
    .get({ spreadsheetId: sid, range, valueRenderOption: "UNFORMATTED_VALUE" })
    .catch((e) => ({ __err: String(e?.message ?? e).slice(0, 150) }));
  if (res?.__err) return { err: res.__err };
  return { rows: res.data.values ?? [] };
}

async function findTargetUser() {
  const res = await grid(REGISTRY_ID, "'users'!A2:R");
  if (res.err) throw new Error(`레지스트리 읽기 실패: ${res.err}`);
  const cohort10 = res.rows
    .map((r) => ({ email: s(r, 0).toLowerCase(), cohort: s(r, 1), spreadsheetId: s(r, 3), role: s(r, 4) || "trainee" }))
    .filter((u) => u.spreadsheetId && u.role === "trainee" && u.cohort.replace(/기\s*$/, "") === "10");
  for (const u of cohort10) {
    if (hash12(u.spreadsheetId) === TARGET_HASH) return u;
  }
  throw new Error(`10기 등록자 ${cohort10.length}명 중 해시 ${TARGET_HASH} 일치자 없음 — registry 변경 의심, 재확인 필요`);
}

/** 대상 행: A열(id) 공란 + 행 전체가 완전공란은 아님(진짜 빈 행 제외).
 * ★실측 발견(dry-run #1, 2026-08-21): 계약여부(K, idx10) 컬럼은 체크박스 서식이 걸려있어
 * 데이터가 전혀 없는 "진짜 빈 행"도 UNFORMATTED_VALUE 로 리터럴 `false` 를 반환한다(전체
 * 계약여부 열 전체에 체크박스 서식이 깔려 있는 탓 — 시트 자체의 서식 특성, 코드 버그 아님).
 * 그 결과 최초 필터는 id 없는 아래쪽 빈 행 152건까지 "후보"로 오판(dry-run #1: 후보 160건,
 * 그중 152건이 K=false 외엔 전부 공란). K 는 계약 성사 여부라는 "있으면 의미있는" 값이라,
 * true/TRUE 일 때만 "데이터 있음"으로 센다(공란 판정에서 제외) — 나머지 컬럼은 그대로 유지. */
async function findCandidateRows(sid) {
  const res = await grid(sid, "'04 업체관리(앱자동작성용)'!A2:AP");
  if (res.err) throw new Error(`04 미팅 탭 읽기 실패: ${res.err}`);
  const out = [];
  res.rows.forEach((r, i) => {
    const id = s(r, COL.id);
    if (id) return; // 정상 id 보유 행 — 이미 앱 경로로 미러됐거나 될 수 있는 행, 손대지 않음
    const nonEmpty = r.some((v, idx) => {
      if (idx === COL.계약여부) return v === true || v === "TRUE";
      return String(v ?? "").trim() !== "";
    });
    if (!nonEmpty) return; // 완전 빈 행(계약여부 체크박스 기본값 false 는 무시)
    out.push({ row: i + 2, raw: r });
  });
  return out;
}

async function existingDbRowKeys(sid, rowKeys) {
  if (!EXECUTE || rowKeys.length === 0) return new Set();
  const res = await pool.query(
    `select row_key from sheet_rows where spreadsheet_id=$1 and tab='meetings' and row_key = any($2)`,
    [sid, rowKeys],
  );
  return new Set(res.rows.map((r) => r.row_key));
}

function buildPayload(raw) {
  const o = { _backfill: true, _manualSheetEntry: true }; // 표식 — 다른 코드는 안 읽음, 추적 전용
  raw.forEach((v, i) => {
    const str = String(v ?? "").trim();
    if (str !== "") o[colName(i)] = str;
  });
  return o;
}

function redactedPreview(raw) {
  return raw
    .map((v, i) => {
      const str = String(v ?? "").trim();
      if (str === "") return null;
      return `${colName(i)}=${PII_COL_IDX.has(i) ? "[REDACTED]" : str}`;
    })
    .filter(Boolean)
    .join("|");
}

async function main() {
  initClients();
  const user = await findTargetUser();
  if (hash12(user.spreadsheetId) !== TARGET_HASH) throw new Error("해시 재확인 실패(내부 오류)");

  console.log(`=== BBE-252 10기 개별교정 백필 (mode=${EXECUTE ? "EXECUTE" : "DRY-RUN"}) ===`);
  console.log(`대상: user-${TARGET_HASH}(10기) — 04 업체관리 탭, id 공란 행`);

  const candidates = await findCandidateRows(user.spreadsheetId);
  if (candidates.length === 0) {
    console.log("대상 행 0건 — 이미 정리됐거나 조건에 안 맞음. 아무것도 안 함.");
    return;
  }

  const rowKeys = candidates.map((c) => `r${c.row}`);
  const already = await existingDbRowKeys(user.spreadsheetId, rowKeys);

  console.log(`\n후보 ${candidates.length}건:`);
  for (const c of candidates) {
    const rowKey = `r${c.row}`;
    const dup = already.has(rowKey) ? " ⚠️이미 DB 존재(스킵)" : "";
    console.log(`  행${c.row}(row_key=${rowKey})${dup}: ${redactedPreview(c.raw)}`);
  }

  const toInsert = candidates.filter((c) => !already.has(`r${c.row}`));
  console.log(`\n적재 대상(신규): ${toInsert.length}건 / 이미 존재(스킵): ${candidates.length - toInsert.length}건`);

  if (!EXECUTE) {
    console.log("\n(DRY-RUN — DB 변경 없음. --execute 로 실제 적재)");
    return;
  }

  let upserted = 0;
  for (const c of toInsert) {
    const rowKey = `r${c.row}`;
    const payload = buildPayload(c.raw);
    await pool.query(
      `insert into sheet_rows (cohort, email, spreadsheet_id, tab, row_key, payload, updated_at)
       values ($1,$2,$3,'meetings',$4,$5::jsonb, now())
       on conflict (spreadsheet_id, tab, row_key)
       do update set payload = sheet_rows.payload || excluded.payload, updated_at = now()`,
      [user.cohort, user.email, user.spreadsheetId, rowKey, JSON.stringify(payload)],
    );
    upserted++;
  }
  console.log(`\nDB upsert 완료: ${upserted}건`);
  console.log(`revert(원복) 필요 시 row_key 목록: ${toInsert.map((c) => `r${c.row}`).join(", ")}`);
  console.log(`(데이터 변경 = insert ${upserted}건뿐. 시트 쓰기 0건.)`);
}

main()
  .catch((e) => {
    const msg = (e instanceof Error ? e.message : String(e)).replace(/postgres(ql)?:\/\/\S+/gi, "[DATABASE_URL]");
    console.error(`bbe252-10gi-meeting-backfill 실패: ${msg}`);
    process.exitCode = 1;
  })
  .finally(() => pool?.end().catch(() => {}));
