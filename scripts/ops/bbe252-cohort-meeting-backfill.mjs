#!/usr/bin/env node
/**
 * BBE-252 계보 — 기수 전원 대상 sheet-only 미팅(04 업체관리 id 공란 행) 백필.
 * `bbe252-10gi-meeting-backfill.mjs`(10기 1명 단발 교정, 대상 하드코딩)의 일반화 버전 —
 * belie 집행 배차: "6기 meetings 백필(시트독립 마지막 블로커)", 대상을 그 기수 등록자
 * 전원으로 확장한다. 10기 스크립트는 "단발성 개별 교정 — 범용 백필 아님" 문서화 그대로
 * 유지·건드리지 않는다(이미 완료 보고·전용 workflow 존재) — 이 파일이 범용 버전이다.
 *
 * 대상 정의(10기 조사에서 확정된 원칙 그대로 재사용): 그 기수 각 사용자의 04 업체관리 탭에서
 * **A열(id) 이 공란인 행 전부**. 근거: `rowToMeeting()`(meetings-rows.ts) 은
 * `if (!idStr) return null` 로 id 공란 행 파싱을 포기하고, `appendMeeting`(시트에 미팅을
 * 쓰는 유일한 repo 함수) 의 유일한 호출부(meetings-write.ts, createMeetingRecord) 는 그 앞에서
 * 무조건 `Meeting.parse()`(id 포함 필수 스키마 검증)를 거친다 — id 공란 행은 앱 저장 경로를
 * 거쳐 시트에 들어갈 수 없다(수학적으로 불가능). → **시트 직접입력 확정**, 미러 대상 아님.
 *
 * 공란 처리 규칙: dashboard-parity 의 시트측/DB측 리더가 둘 다 원본 컬럼 인덱스를 그대로
 * 읽어 공란 셀을 동일 연산으로 빈 문자열화한다 — 시트의 공란은 DB payload 에서 **키 자체를
 * 생략**하면(backfill-sheet-rows.mjs rowObj 관례) parity 지문이 자동 일치한다.
 *
 * 계약여부(K) 체크박스 서식 함정(10기 dry-run #1 에서 발견·수정): 데이터가 없는 완전 빈 행도
 * UNFORMATTED_VALUE 로 K 열에 리터럴 `false` 를 반환한다(체크박스 서식 자체의 특성) — K 는
 * true/TRUE 일 때만 "데이터 있음"으로 센다. 아래 findCandidateRows 에 이미 반영.
 *
 * row_key: 자연키(id) 부재 시 시트상의 물리적 위치 `r{행}` 합성키(contracts/db 탭 관례 재사용).
 * id 공란이 유지되므로 백필 후에도 `rowToMeeting()` 은 이 행들을 계속 null 처리(무시)한다 —
 * 파일럿 전환 후에도 앱 화면(미팅 목록 등)에는 안 보인다. 목적은 "실제 미팅 노출"이 아니라
 * dashboard-parity 정합이므로 안전하다.
 *
 * id 有 충돌 건(10기 08-17 현수막 유형 — id 이미 존재, 시트/DB 둘 다 값 있는데 상태 불일치):
 * 이 스크립트의 대상이 아니다(구조적으로 처리 불가 — "추가"가 아니라 "어느 쪽이 정본인지"
 * 판단이 필요한 실데이터 이슈, §0.7 화이트리스트 ①). ③단계(dashboard-parity 재검증)에서
 * 발견되면 그 건만 개별 "미확정 — belie 확인"으로 문서화하고 넘어간다(belie 배차 지시).
 *
 * 실행(VPS): node scripts/ops/bbe252-cohort-meeting-backfill.mjs --cohort "6" [--execute]
 * 기본 dry-run(적재 0건). --execute 시 실제 upsert. 여러 기수는 쉼표 구분(--cohort "6,7").
 * revert(추가 적재만 하므로 단순 삭제로 원복): 아래 출력의 (spreadsheetId, row_key) 목록으로
 *   `delete from sheet_rows where spreadsheet_id='<sid>' and tab='meetings' and row_key = any($1)`
 */
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
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
const EXECUTE = process.argv.includes("--execute");

const arg = (name, def = "") => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? String(process.argv[i + 1] ?? "").trim() : def;
};
const COHORTS = arg("--cohort", "").split(",").map((s) => s.trim().replace(/기\s*$/, "")).filter(Boolean);

const REGISTRY_ID = env("SHEETS_REGISTRY_ID");
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const SA_KEY = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
const DB_URL = env("DATABASE_URL");
if (!REGISTRY_ID || !SA_EMAIL || !SA_KEY || !DB_URL) {
  console.error("bbe252-cohort-meeting-backfill: env 누락(SHEETS_REGISTRY_ID·SA·DATABASE_URL) — VPS 에서 실행하세요.");
  process.exit(1);
}
if (COHORTS.length === 0) {
  console.error("bbe252-cohort-meeting-backfill: --cohort 필수(예: --cohort \"6\")");
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

async function findCohortUsers(cohortLabel) {
  const res = await grid(REGISTRY_ID, "'users'!A2:R");
  if (res.err) throw new Error(`레지스트리 읽기 실패: ${res.err}`);
  return res.rows
    .map((r) => ({ email: s(r, 0).toLowerCase(), cohort: s(r, 1), spreadsheetId: s(r, 3), role: s(r, 4) || "trainee" }))
    .filter((u) => u.spreadsheetId && u.role === "trainee" && u.cohort.replace(/기\s*$/, "") === cohortLabel);
}

/** 대상 행: A열(id) 공란 + 행 전체가 완전공란은 아님(진짜 빈 행 제외). 계약여부(K) 는
 * true/TRUE 일 때만 "데이터 있음"으로 센다(체크박스 서식 기본값 false 오탐 방지, 10기 실측). */
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

async function processUser(u) {
  const label = `user-${hash12(u.spreadsheetId)}`;
  const candidates = await findCandidateRows(u.spreadsheetId);
  if (candidates.length === 0) {
    console.log(`  ${label}: 대상 행 0건`);
    return { label, candidates: 0, inserted: 0, skippedExisting: 0 };
  }

  const rowKeys = candidates.map((c) => `r${c.row}`);
  const already = await existingDbRowKeys(u.spreadsheetId, rowKeys);

  console.log(`  ${label}: 후보 ${candidates.length}건`);
  for (const c of candidates) {
    const rowKey = `r${c.row}`;
    const dup = already.has(rowKey) ? " ⚠️이미 DB 존재(스킵)" : "";
    console.log(`    행${c.row}(row_key=${rowKey})${dup}: ${redactedPreview(c.raw)}`);
  }

  const toInsert = candidates.filter((c) => !already.has(`r${c.row}`));
  if (!EXECUTE) {
    return { label, candidates: candidates.length, inserted: 0, skippedExisting: candidates.length - toInsert.length, plannedInsert: toInsert.length };
  }

  let upserted = 0;
  const insertedRowKeys = [];
  for (const c of toInsert) {
    const rowKey = `r${c.row}`;
    const payload = buildPayload(c.raw);
    await pool.query(
      `insert into sheet_rows (cohort, email, spreadsheet_id, tab, row_key, payload, updated_at)
       values ($1,$2,$3,'meetings',$4,$5::jsonb, now())
       on conflict (spreadsheet_id, tab, row_key)
       do update set payload = sheet_rows.payload || excluded.payload, updated_at = now()`,
      [u.cohort, u.email, u.spreadsheetId, rowKey, JSON.stringify(payload)],
    );
    upserted++;
    insertedRowKeys.push(rowKey);
  }
  if (upserted > 0) {
    console.log(`    → upsert ${upserted}건. revert: delete from sheet_rows where spreadsheet_id='${u.spreadsheetId}' and tab='meetings' and row_key = any(array[${insertedRowKeys.map((k) => `'${k}'`).join(",")}]);`);
  }
  return { label, candidates: candidates.length, inserted: upserted, skippedExisting: candidates.length - toInsert.length };
}

async function main() {
  initClients();
  console.log(`=== BBE-252 계보 — 기수 meetings 백필 (mode=${EXECUTE ? "EXECUTE" : "DRY-RUN"}) ===`);
  console.log(`대상 기수: ${COHORTS.join(",")}`);

  const summary = [];
  for (const cohort of COHORTS) {
    const users = await findCohortUsers(cohort);
    console.log(`\n### ${cohort}기 — 등록 trainee ${users.length}명`);
    if (users.length === 0) {
      console.log("  등록자 0명 — 스킵");
      summary.push({ cohort, users: 0, candidates: 0, inserted: 0, skippedExisting: 0 });
      continue;
    }
    const agg = { cohort, users: users.length, candidates: 0, inserted: 0, skippedExisting: 0 };
    for (const u of users) {
      const r = await processUser(u);
      agg.candidates += r.candidates;
      agg.inserted += r.inserted;
      agg.skippedExisting += r.skippedExisting;
    }
    summary.push(agg);
  }

  console.log("\n=== 기수별 요약 ===");
  for (const a of summary) {
    console.log(
      `${a.cohort}기: 등록 ${a.users}명 · 후보(id 공란) ${a.candidates}건 · ` +
      (EXECUTE ? `upsert ${a.inserted}건 · 이미존재(스킵) ${a.skippedExisting}건` : `(DRY-RUN — DB 변경 없음. --execute 로 실제 적재)`),
    );
  }
  console.log("\n(데이터 변경 = insert 건수뿐. 시트 쓰기 0건.)");
}

main()
  .catch((e) => {
    const msg = (e instanceof Error ? e.message : String(e)).replace(/postgres(ql)?:\/\/\S+/gi, "[DATABASE_URL]");
    console.error(`bbe252-cohort-meeting-backfill 실패: ${msg}`);
    process.exitCode = 1;
  })
  .finally(() => pool?.end().catch(() => {}));
