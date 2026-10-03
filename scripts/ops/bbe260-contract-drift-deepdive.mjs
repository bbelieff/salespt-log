#!/usr/bin/env node
/**
 * BBE-260 전용 — 읽기 전용. 6기 전원·7기 절반 「DB 에만 있는 계약」(B21 지문 차집합
 * onlyInDb) 이 (a) DB 중복적재인지 (b) 시트 삭제 미반영인지 건별로 판정한다.
 * 실데이터 변경 0(DB 쓰기 0·시트 쓰기 0). 개인정보(업체명 등)는 해시·마스킹만 출력.
 *
 * 판정 로직 (경계 밖 — 정리 집행은 이 스크립트가 하지 않음):
 *   1. dashboard-parity 와 동일한 지문(계약일+수임비+구분)으로 sheet vs DB 차집합을 구한다
 *      (dashboard-parity-lib.mjs 재사용 — 로직 이중구현 금지).
 *   2. onlyInDb 로 나온 지문마다, 그 지문을 가진 실제 DB row_key(들)를 원문에서 역추적한다.
 *   3. 같은 지문을 가진 DB row_key 가 **2개 이상**이면 → (a) 중복적재 확정
 *      (같은 내용이 다른 row_key 로 두 번 적재됐다는 것 자체가 증거 — 시트 상태 무관).
 *   4. row_key 1개면 그 row_key 가 backfill(payload._backfill) 로 왔는지, 마지막 갱신
 *      (updated_at, ★created_at 컬럼 없음 — 최초 적재 시각이 아니라 최종 접촉 시각) 이
 *      언제인지 확인하고, **현재 시트의 그 위치(같은 행 번호)** 에 무엇이 있는지 대조한다.
 *      onlyInDb 는 이미 "이 지문이 시트 전체 어디에도 없다"는 뜻(지문 매칭이라 위치 무관) —
 *      따라서 1건짜리는 (b) 시트 삭제·DB 미반영으로 잠정 판정(BBE-258 확정 사실 재현:
 *      시트 직접 편집/삭제는 mirrorSheetRow 를 안 타 DB 가 못 따라간다).
 *
 * 실행(VPS, 읽기 전용): node scripts/ops/bbe260-contract-drift-deepdive.mjs [--cohort "6,7"]
 */
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { google } from "googleapis";
import { Pool } from "pg";
import {
  normalizeDbContract, normalizeSheetContractRow,
  contractFingerprint, diffContractFingerprints,
} from "./dashboard-parity-lib.mjs";

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

const arg = (name, def = "") => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? String(process.argv[i + 1] ?? "").trim() : def;
};
const COHORTS = arg("--cohort", "6,7").split(",").map((s) => s.trim().replace(/기\s*$/, "")).filter(Boolean);

const REGISTRY_ID = env("SHEETS_REGISTRY_ID");
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const SA_KEY = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
const DB_URL = env("DATABASE_URL");
if (!REGISTRY_ID || !SA_EMAIL || !SA_KEY || !DB_URL) {
  console.error("bbe260: env 누락(SHEETS_REGISTRY_ID·SA·DATABASE_URL) — VPS 에서 실행하세요.");
  process.exit(1);
}

const anon = (spreadsheetId) => `sid-${createHash("sha256").update(String(spreadsheetId || "")).digest("hex").slice(0, 8)}`;
const s = (r, i) => String(r?.[i] ?? "").trim();

let sheets, pool;
function initClients() {
  const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, ["https://www.googleapis.com/auth/spreadsheets.readonly"]);
  sheets = google.sheets({ version: "v4", auth });
  pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false }, max: 3 });
}

async function grid(sid, range) {
  const res = await sheets.spreadsheets.values
    .get({ spreadsheetId: sid, range, valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "SERIAL_NUMBER" })
    .catch((e) => ({ __err: String(e?.message ?? e).slice(0, 100) }));
  if (res?.__err) return { err: res.__err };
  return { rows: res.data.values ?? [] };
}

async function readRegistryUsers() {
  const res = await grid(REGISTRY_ID, "'users'!A2:R");
  if (res.err) throw new Error(`레지스트리 읽기 실패: ${res.err}`);
  return res.rows
    .map((r) => ({ email: s(r, 0).toLowerCase(), cohort: s(r, 1), spreadsheetId: s(r, 3), role: s(r, 4) || "trainee" }))
    .filter((u) => u.spreadsheetId && u.role === "trainee");
}

/** 02 계약 탭 alias — lib/repo/contract-payment.ts TAB_ALIASES 와 동일(신형→6기 legacy 순).
 * ★2026-08-20 실측: dashboard-parity.mjs sheetRawContractRows 는 이 alias 를 안 타 6기
 * 전원(0/6)이 "Unable to parse range: '02 계약수납관리'!A6:AK" 로 조용히 빈 배열([])을
 * 반환받고, 실재하는 DB 계약이 전부 "DB에만 있음"(가짜 신호)으로 잘못 잡혔다(BBE-260 1차
 * 실행에서 6기 6/6 전원 같은 에러로 재현·확정). 앱 본체(resolveLayout)는 이 alias 를 이미
 * 쓰고 있어 실사용 화면은 정상 — 진단 도구만 뒤처진 상태였다. */
const CONTRACT_TAB_ALIASES = [
  { tab: "02 계약수납관리", firstDataRow: 6 },
  { tab: "02 계약관리", firstDataRow: 5 }, // 6기 legacy
];
async function readSheetContractsWithRow(sid) {
  let res = await grid(sid, `'${CONTRACT_TAB_ALIASES[0].tab}'!A${CONTRACT_TAB_ALIASES[0].firstDataRow}:AK`);
  let firstDataRow = CONTRACT_TAB_ALIASES[0].firstDataRow;
  let usedAlias = CONTRACT_TAB_ALIASES[0].tab;
  if (res.err && /Unable to parse range/.test(res.err)) {
    const alt = CONTRACT_TAB_ALIASES[1];
    res = await grid(sid, `'${alt.tab}'!A${alt.firstDataRow}:AK`);
    firstDataRow = alt.firstDataRow;
    usedAlias = alt.tab;
  }
  if (res.err) return { err: res.err, byRow: new Map(), rows: [], usedAlias };
  const byRow = new Map();
  const rows = [];
  res.rows.forEach((r, i) => {
    const sheetRow = i + firstDataRow;
    const norm = normalizeSheetContractRow(r);
    if (!norm.계약일) return; // 빈 행
    byRow.set(sheetRow, { ...norm, 업체명: s(r, 3) }); // D=업체명(A=idx0 배열 기준 idx3)
    rows.push(norm);
  });
  return { byRow, rows, usedAlias };
}

async function readDbContracts(sid) {
  const res = await pool.query(
    `select row_key, payload, updated_at from sheet_rows where spreadsheet_id=$1 and tab='contracts'
     and coalesce((payload->>'_cleared')::boolean,false)=false`,
    [sid],
  );
  return res.rows.map((r) => ({
    rowKey: r.row_key,
    updatedAt: r.updated_at,
    isBackfill: r.payload._backfill === true || r.payload._backfill === "true",
    norm: normalizeDbContract(r.payload),
    payload: r.payload,
  }));
}

const PII_KEYS = /^(업체명|담당자|연락처|이름|email|메모|memo|주소|이메일|D)$/i;
function redact(payload) {
  const out = {};
  for (const [k, v] of Object.entries(payload ?? {})) out[k] = PII_KEYS.test(k) ? "[REDACTED]" : v;
  return out;
}

async function auditUser(u) {
  const label = anon(u.spreadsheetId);
  const sheetRes = await readSheetContractsWithRow(u.spreadsheetId);
  if (sheetRes.err) {
    console.log(`\n--- ${u.cohort}기 | ${label} --- 02 탭 읽기 실패: ${sheetRes.err}`);
    return null;
  }
  const dbRows = await readDbContracts(u.spreadsheetId);
  const fp = diffContractFingerprints(sheetRes.rows, dbRows.map((d) => d.norm));

  if (fp.onlyInDb.length === 0 && fp.countMismatch.length === 0) {
    console.log(`\n--- ${u.cohort}기 | ${label} (탭=${sheetRes.usedAlias}) --- diff 없음(onlyInDb 0, countMismatch 0)`);
    return { cohort: u.cohort, label, clean: true, findings: [] };
  }

  console.log(`\n--- ${u.cohort}기 | ${label} (탭=${sheetRes.usedAlias}) --- onlyInDb=${fp.onlyInDb.length}건 countMismatch=${fp.countMismatch.length}건`);
  const findings = [];

  // onlyInDb + countMismatch 양쪽 다 "DB 가 시트보다 많은 지문"이 있는 케이스 — 합쳐서 건별 해부.
  const targets = [
    ...fp.onlyInDb.map((e) => ({ ...e, kind: "onlyInDb" })),
    ...fp.countMismatch.filter((e) => e.dbCount > e.sheetCount).map((e) => ({ ...e, kind: "countMismatch(db>sheet)" })),
  ];

  for (const e of targets) {
    const fpKey = `${e.계약일}|${e.수임비}|${e.구분 === "이월" ? "이월" : "일반"}`;
    const matches = dbRows.filter((d) => contractFingerprint(d.norm) === fpKey);
    console.log(`  지문[${e.kind}] 계약일=${e.계약일} 수임비=${e.수임비} 구분=${e.구분 ?? "-"} sheet=${e.sheetCount ?? 0} db=${e.dbCount ?? matches.length}`);

    if (matches.length >= 2) {
      // (a) 중복적재 확정 — 같은 지문이 서로 다른 row_key 로 2건 이상.
      for (const m of matches) {
        const sheetAtRow = sheetRes.byRow.get(Number(m.rowKey.replace(/^r/, "")));
        console.log(
          `    row_key=${m.rowKey} updated_at=${m.updatedAt.toISOString()} _backfill=${m.isBackfill} ` +
          `현재시트같은행=${sheetAtRow ? `있음(계약일=${sheetAtRow.계약일})` : "없음(빈행 또는 범위밖)"} payload=${JSON.stringify(redact(m.payload))}`,
        );
      }
      findings.push({ ...e, verdict: "DUP_CONFIRMED", rowKeys: matches.map((m) => m.rowKey), evidence: `동일 지문 DB row_key ${matches.length}개` });
    } else if (matches.length === 1) {
      const m = matches[0];
      const rowNum = Number(m.rowKey.replace(/^r/, ""));
      const sheetAtRow = sheetRes.byRow.get(rowNum);
      const nowMs = Date.now();
      const ageDays = Math.round((nowMs - m.updatedAt.getTime()) / 86400000);
      console.log(
        `    row_key=${m.rowKey} updated_at=${m.updatedAt.toISOString()}(${ageDays}일 전) _backfill=${m.isBackfill} ` +
        `현재시트같은행=${sheetAtRow ? `다른내용 있음(계약일=${sheetAtRow.계약일}, 자리재사용)` : "없음(빈행)"} payload=${JSON.stringify(redact(m.payload))}`,
      );
      // onlyInDb 는 지문 기준 차집합이라 "시트 전체 어디에도 이 지문 없음" 이 이미 확정.
      // 남은 것은 (b) 판정의 정황 근거(적재 경로·최근성)뿐 — 단정 대신 정황을 그대로 남긴다.
      findings.push({
        ...e, verdict: "DELETE_NOT_MIRRORED_CANDIDATE", rowKeys: [m.rowKey],
        evidence: `지문 일치 row_key 1개, 시트 전체에 이 지문 없음(diffContractFingerprints 확정) — ` +
          `${m.isBackfill ? "backfill 적재(그 시점엔 시트에 실재)" : "backfill 표식 없음(live mirror 적재 추정, 쓰기 당시 시트에 실재해야 함 — mirrorSheetRow 는 시트쓰기 성공 후에만 호출)"}, ` +
          `최종 갱신 ${ageDays}일 전(★created_at 컬럼 없어 최초 적재 시각과 다를 수 있음)`,
      });
    } else {
      console.log(`    ⚠ 지문 역추적 실패(matches=0) — normalizeDbContract 재계산 불일치 의심, 원본 재확인 필요`);
      findings.push({ ...e, verdict: "UNRESOLVED", rowKeys: [], evidence: "지문 역추적 0건 — 정규화 로직 재확인 필요" });
    }
  }
  return { cohort: u.cohort, label, clean: false, findings };
}

async function main() {
  initClients();
  const users = await readRegistryUsers();
  const byCohort = new Map();
  for (const u of users) {
    if (!COHORTS.includes(u.cohort.replace(/기\s*$/, ""))) continue;
    const list = byCohort.get(u.cohort) ?? [];
    list.push(u);
    byCohort.set(u.cohort, list);
  }

  console.log("=== BBE-260 계약 드리프트 심층해부 (DB-extra 계약 건별 판정) ===");
  console.log(`대상 기수: ${COHORTS.join(",")}`);

  const summary = new Map(); // cohort -> {users, dirty, dup, delCand, unresolved}
  for (const cohort of COHORTS) {
    const list = byCohort.get(cohort) ?? [];
    console.log(`\n### ${cohort}기 — 등록 ${list.length}명`);
    const agg = { users: list.length, dirty: 0, dup: 0, delCand: 0, unresolved: 0 };
    for (const u of list) {
      const r = await auditUser(u);
      if (!r) continue;
      if (!r.clean) agg.dirty++;
      for (const f of r.findings) {
        if (f.verdict === "DUP_CONFIRMED") agg.dup++;
        else if (f.verdict === "DELETE_NOT_MIRRORED_CANDIDATE") agg.delCand++;
        else agg.unresolved++;
      }
    }
    summary.set(cohort, agg);
  }

  console.log("\n\n=== 기수별 요약 ===");
  for (const [cohort, agg] of summary) {
    console.log(
      `${cohort}기: 등록 ${agg.users}명 · diff있는사람 ${agg.dirty}명 · ` +
      `(a)중복적재확정 ${agg.dup}건 · (b)삭제미반영후보 ${agg.delCand}건 · 미해결 ${agg.unresolved}건`,
    );
  }
  console.log("\n(데이터 변경 0건 — 이 스크립트는 SELECT/values.get 만 호출했습니다)");
}

main()
  .catch((e) => {
    const msg = (e instanceof Error ? e.message : String(e)).replace(/postgres(ql)?:\/\/\S+/gi, "[DATABASE_URL]");
    console.error(`bbe260-contract-drift-deepdive 실패: ${msg}`);
    process.exitCode = 1;
  })
  .finally(() => pool?.end().catch(() => {}));
