#!/usr/bin/env node
/**
 * BBE-252 후속 — 읽기 전용. 6·7기 B21(누적수임비)·N(주차계약)·H(주차활동) 재계산 드리프트의
 * 근인을 시트 실제 수식(FORMULA 렌더)과 대조해 확정한다.
 *
 * BBE-260 이 계약 "레코드" 단위 오탐(탭alias)을 해소한 뒤에도 남은 잔여 — 지문(계약일+
 * 수임비+구분)은 시트·DB 완전 일치인데 B21 "합계"·N/H "주차버킷" 은 여전히 다르다
 * (dashboard-parity run 32403716371, 6기 5/6명·7기 3/8명). 지문 대조가 이미 개별 계약
 * 레코드가 같다는 걸 확정했으므로, 남은 원인은 (i) 시트 자체 수식이 우리 JS 재구현
 * (isCarryoverContract/computeAggregates)과 다른 규칙으로 계산되거나 (ii) courseStart
 * (O1) 값 자체가 sheet 수식이 참조하는 값과 DB 재계산이 쓰는 값이 다르거나(경계 케이스) —
 * 둘 중 하나다. 이 스크립트는 그 두 후보를 직접 증거(수식 원문·O1/O2 원문)로 가른다.
 *
 * 실행(VPS, 읽기 전용): node scripts/ops/bbe252-b21-formula-audit.mjs [--cohort "6,7"]
 */
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { google } from "googleapis";
import { Pool } from "pg";
import {
  normalizeDbContract, normalizeSheetContractRow, inSheetWindow, parseISO,
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
  console.error("bbe252-b21-formula-audit: env 누락 — VPS 에서 실행하세요.");
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

async function batchGet(sid, ranges, valueRenderOption) {
  const res = await sheets.spreadsheets.values
    .batchGet({ spreadsheetId: sid, ranges, valueRenderOption })
    .catch((e) => ({ __err: String(e?.message ?? e).slice(0, 120) }));
  if (res?.__err) return { err: res.__err };
  return { valueRanges: res.data.valueRanges ?? [] };
}

const serialToISO = (v) => {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const n = Number(v);
  if (!Number.isFinite(n) || n < 20000) return null;
  return new Date((n - 25569) * 86400000).toISOString().slice(0, 10);
};

const CONTRACT_TAB_ALIASES = [
  { tab: "02 계약수납관리", firstDataRow: 6 },
  { tab: "02 계약관리", firstDataRow: 5 },
];
async function resolveContractTab(sid) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sid, fields: "sheets(properties(title))" }).catch(() => null);
  const titles = new Set((meta?.data.sheets ?? []).map((t) => t.properties?.title ?? ""));
  return CONTRACT_TAB_ALIASES.find((a) => titles.has(a.tab)) ?? CONTRACT_TAB_ALIASES[0];
}

async function readRegistryUsers() {
  const res = await batchGet(REGISTRY_ID, ["'users'!A2:R"], "UNFORMATTED_VALUE");
  if (res.err) throw new Error(`레지스트리 읽기 실패: ${res.err}`);
  const rows = res.valueRanges[0]?.values ?? [];
  return rows
    .map((r) => ({ email: s(r, 0).toLowerCase(), cohort: s(r, 1), spreadsheetId: s(r, 3), role: s(r, 4) || "trainee" }))
    .filter((u) => u.spreadsheetId && u.role === "trainee");
}

async function auditUser(u) {
  const label = anon(u.spreadsheetId);
  const { tab: contractTab, firstDataRow } = await resolveContractTab(u.spreadsheetId);

  const ranges = ["'01 영업관리'!O1", "'01 영업관리'!O2", "'대시보드(자동작성)'!B21", "'01 영업관리'!O4", "'01 영업관리'!O6", "'01 영업관리'!O5", "'01 영업관리'!A4:A6"];
  const [valRes, fxRes] = await Promise.all([
    batchGet(u.spreadsheetId, ranges, "UNFORMATTED_VALUE"),
    batchGet(u.spreadsheetId, ranges, "FORMULA"),
  ]);
  if (valRes.err || fxRes.err) {
    console.log(`\n--- ${u.cohort}기 | ${label} --- 읽기 실패: ${valRes.err || fxRes.err}`);
    return;
  }
  const val = (i) => valRes.valueRanges[i]?.values?.[0]?.[0];
  const fx = (i) => fxRes.valueRanges[i]?.values?.[0]?.[0];

  const o1Val = val(0);
  const o1ISO = serialToISO(o1Val);
  const o1Fx = fx(0);
  const o2Val = val(1);
  const o2ISO = serialToISO(o2Val);
  const o2Fx = fx(1);
  const b21Val = val(2);
  const b21Fx = fx(2);
  const o4Val = val(3), o4Fx = fx(3);
  const o6Val = val(4), o6Fx = fx(4);
  const o5Val = val(5), o5Fx = fx(5);
  const labels = (valRes.valueRanges[6]?.values ?? []).map((r) => r?.[0]);

  // DB 쪽 courseStart — 앱이 실제로 쓰는 값(readProfileBundle.courseStart 는 O1 파생, dashboard-aggregates.ts 주석 확인됨).
  // 여기서는 O1 UNFORMATTED 재파싱값을 그대로 courseStartISO 로 씀(코드와 동일 경로).
  const contractsRes = await batchGet(u.spreadsheetId, [`'${contractTab}'!A${firstDataRow}:AK`], "UNFORMATTED_VALUE");
  const sheetContracts = contractsRes.err ? [] : (contractsRes.valueRanges[0]?.values ?? []).map(normalizeSheetContractRow).filter((c) => c.계약일);

  const dbRes = await pool.query(
    `select payload from sheet_rows where spreadsheet_id=$1 and tab='contracts' and coalesce((payload->>'_cleared')::boolean,false)=false`,
    [u.spreadsheetId],
  );
  const dbContracts = dbRes.rows.map((r) => normalizeDbContract(r.payload));

  const carrySum = (contracts, courseStartISO) => {
    let fee = 0, carryCount = 0, total = 0;
    for (const c of contracts) {
      total++;
      const carry = c.구분 === "이월" || (c.계약일 && courseStartISO && c.계약일 < courseStartISO);
      if (carry) { carryCount++; continue; }
      fee += c.수임비;
    }
    return { fee, carryCount, total };
  };
  // BBE-120 STATS_WEEKS(8) 클램프 가설 — B21 이 실제로 "이월 제외 전체합"이 아니라
  // "1~8주 주차버킷 합"(O4=O38+O72+...+O276, 8개 주차 stride 셀의 합)일 가능성.
  const windowedFeeSum = (contracts, cs, courseStartISO) => {
    let fee = 0, outOfWindow = 0, total = 0;
    for (const c of contracts) {
      total++;
      const carry = c.구분 === "이월" || (c.계약일 && courseStartISO && c.계약일 < courseStartISO);
      if (carry) continue;
      if (!inSheetWindow(c.계약일, cs)) { outOfWindow++; continue; }
      fee += c.수임비;
    }
    return { fee, outOfWindow, total };
  };
  const cs = o1ISO ? parseISO(o1ISO) : null;
  const sheetRecount = carrySum(sheetContracts, o1ISO);
  const dbRecount = carrySum(dbContracts, o1ISO);
  const sheetWindowed = cs ? windowedFeeSum(sheetContracts, cs, o1ISO) : null;
  const dbWindowed = cs ? windowedFeeSum(dbContracts, cs, o1ISO) : null;

  console.log(`\n--- ${u.cohort}기 | ${label} (계약탭=${contractTab}) ---`);
  console.log(`  O1(수강시작일) 값=${o1Val} → ISO=${o1ISO} | 수식원문="${o1Fx}"`);
  console.log(`  O2(수료일)     값=${o2Val} → ISO=${o2ISO} | 수식원문="${o2Fx}"`);
  console.log(`  B21(대시보드셀) 값=${b21Val} | 수식원문="${b21Fx}"`);
  console.log(`  O4(1~8주 주차버킷 합 추정) 값=${o4Val} | 수식원문="${o4Fx}"`);
  console.log(`  O5 값=${o5Val} | 수식원문="${o5Fx}" | O4:O6 라벨(A4:A6)=${JSON.stringify(labels)}`);
  console.log(`  O6 값=${o6Val} | 수식원문="${o6Fx}"`);
  console.log(`  JS재계산-무클램프(carry=이월|계약일<O1ISO): sheet fee=${sheetRecount.fee}(${sheetRecount.total}건중 ${sheetRecount.carryCount}건 이월/이전 제외) | DB fee=${dbRecount.fee}(${dbRecount.total}건중 ${dbRecount.carryCount}건 제외)`);
  console.log(`  JS재계산-8주클램프(carry 제외 + inSheetWindow 1~8주만): sheet fee=${sheetWindowed?.fee}(${sheetWindowed?.outOfWindow}건 창밖 추가제외) | DB fee=${dbWindowed?.fee}(${dbWindowed?.outOfWindow}건 창밖 추가제외)`);
  console.log(`  B21 vs 무클램프-sheet=${num(b21Val) - sheetRecount.fee} | B21 vs 무클램프-DB=${num(b21Val) - dbRecount.fee} | B21 vs 8주클램프-sheet=${sheetWindowed ? num(b21Val) - sheetWindowed.fee : "N/A"} | B21 vs 8주클램프-DB=${dbWindowed ? num(b21Val) - dbWindowed.fee : "N/A"}`);

  if (PROBE_O38.has(label)) {
    // PII 방지 — 업체명(D)·진행기관(M/S/Y) 등은 절대 안 부른다. 계약일(C)·수임비(E)·
    // 수납액(Q/W/AC)·수납일(R/X/AD)만 — 금액·날짜뿐, 개인정보 아님(lib/repo/contract-payment.ts
    // 컬럼 매핑: M~R=수납1·S~X=수납2·Y~AD=수납3, 각 슬롯 마지막 2컬럼이 수납액/수납일).
    const lastRow = firstDataRow + 15;
    const o38Ranges = [
      "'01 영업관리'!O38", "'01 영업관리'!N36:P40",
      `'${contractTab}'!C${firstDataRow}:E${lastRow}`,
      `'${contractTab}'!Q${firstDataRow}:R${lastRow}`,
      `'${contractTab}'!W${firstDataRow}:X${lastRow}`,
      `'${contractTab}'!AC${firstDataRow}:AD${lastRow}`,
    ];
    const [o38Val, o38Fx] = await Promise.all([
      batchGet(u.spreadsheetId, o38Ranges, "UNFORMATTED_VALUE"),
      batchGet(u.spreadsheetId, o38Ranges, "FORMULA"),
    ]);
    console.log(`  [O38 PROBE] O38 값=${JSON.stringify(o38Val.valueRanges?.[0]?.values)} 수식=${JSON.stringify(o38Fx.valueRanges?.[0]?.values)}`);
    console.log(`  [O38 PROBE] N36:P40 수식블록:`);
    (o38Fx.valueRanges?.[1]?.values ?? []).forEach((row, i) => console.log(`    row${36 + i}: ${JSON.stringify(row)}`));
    const ceRows = o38Val.valueRanges?.[2]?.values ?? [];
    const qrRows = o38Val.valueRanges?.[3]?.values ?? [];
    const wxRows = o38Val.valueRanges?.[4]?.values ?? [];
    const acadRows = o38Val.valueRanges?.[5]?.values ?? [];
    console.log(`  [O38 PROBE] 계약일|수임비 vs 수납1(액,일)|수납2(액,일)|수납3(액,일) (PII 없음, row=${firstDataRow}~${lastRow}):`);
    for (let i = 0; i < ceRows.length; i++) {
      console.log(`    row${firstDataRow + i}: C,E=${JSON.stringify(ceRows[i])} | Q,R=${JSON.stringify(qrRows[i])} | W,X=${JSON.stringify(wxRows[i])} | AC,AD=${JSON.stringify(acadRows[i])}`);
    }
  }
}
const PROBE_O38 = new Set(arg("--probe-o38", "").split(",").map((s) => s.trim()).filter(Boolean));
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : Number.isFinite(Number(v)) ? Number(v) : 0);

async function main() {
  initClients();
  const users = await readRegistryUsers();
  const targets = users.filter((u) => COHORTS.includes(u.cohort.replace(/기\s*$/, "")));
  console.log("=== BBE-252 B21/주차집계 수식-재계산 드리프트 근인 대조 ===");
  console.log(`대상: ${COHORTS.join(",")}기 — ${targets.length}명`);
  for (const u of targets) await auditUser(u);
  console.log("\n(데이터 변경 0건 — SELECT/values.get(FORMULA 포함) 만 호출)");
}

main()
  .catch((e) => {
    const msg = (e instanceof Error ? e.message : String(e)).replace(/postgres(ql)?:\/\/\S+/gi, "[DATABASE_URL]");
    console.error(`bbe252-b21-formula-audit 실패: ${msg}`);
    process.exitCode = 1;
  })
  .finally(() => pool?.end().catch(() => {}));
