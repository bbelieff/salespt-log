#!/usr/bin/env node
/**
 * BBE-252 후속 — 읽기 전용. 6기 전용 legacy 오프셋(O5, `'02 계약관리'!D2`) 값을
 * spreadsheetId 별로 1회 스냅샷한다. `lib/service/dashboard-aggregates.ts`
 * LEGACY_FEE_OFFSET 상수를 채우는 근거 자료 — 이 스크립트 자체는 실행·저장을
 * 안 하고 콘솔 출력만 한다(코드에 값을 손으로 옮겨 적음, 자동화 안 함 — 6명뿐이라
 * 자동 backfill 파이프라인을 새로 만드는 게 오히려 과함).
 *
 * O5 는 02 탭 헤더/예시 구간(R1~R4)의 고정 셀 — 앱이 절대 쓰지 않는 위치(계약 CRUD 는
 * firstDataRow=5 부터만 건드림, lib/repo/contract-payment.ts). 사람이 최초 온보딩 때
 * 1회 수기입력한 값으로 추정 — 이후 변경될 걸로 기대하지 않지만, "확정"은 안 한다.
 *
 * 실행(VPS, 읽기 전용): node scripts/ops/bbe252-6gi-o5-snapshot.mjs
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

const REGISTRY_ID = env("SHEETS_REGISTRY_ID");
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const SA_KEY = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
if (!REGISTRY_ID || !SA_EMAIL || !SA_KEY) {
  console.error("bbe252-6gi-o5-snapshot: env 누락 — VPS 에서 실행하세요.");
  process.exit(1);
}

const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, ["https://www.googleapis.com/auth/spreadsheets.readonly"]);
const sheets = google.sheets({ version: "v4", auth });
const s = (r, i) => String(r?.[i] ?? "").trim();

async function readRegistryUsers() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: REGISTRY_ID, range: "'users'!A2:R", valueRenderOption: "UNFORMATTED_VALUE",
  });
  return (res.data.values ?? [])
    .map((r) => ({ cohort: s(r, 1), spreadsheetId: s(r, 3), role: s(r, 4) || "trainee" }))
    .filter((u) => u.spreadsheetId && u.role === "trainee" && u.cohort.replace(/기\s*$/, "") === "6");
}

async function main() {
  const users = await readRegistryUsers();
  console.log(`6기 등록 ${users.length}명`);
  const out = [];
  for (const u of users) {
    const res = await sheets.spreadsheets.values
      .get({ spreadsheetId: u.spreadsheetId, range: "'02 계약관리'!D2", valueRenderOption: "UNFORMATTED_VALUE" })
      .catch((e) => ({ __err: String(e?.message ?? e).slice(0, 100) }));
    const v = res?.__err ? null : Number(res.data.values?.[0]?.[0] ?? 0);
    console.log(`  spreadsheetId=${u.spreadsheetId}  O5=${res?.__err ? `읽기실패(${res.__err})` : v}`);
    if (!res?.__err) out.push({ spreadsheetId: u.spreadsheetId, o5: v });
  }
  console.log("\n// LEGACY_FEE_OFFSET 코드용 (0 인 항목은 생략 가능, 맵 크기 최소화):");
  for (const { spreadsheetId, o5 } of out) {
    if (o5 !== 0) console.log(`  "${spreadsheetId}": ${o5},`);
  }
}
main().catch((e) => { console.error("실패:", e.message); process.exitCode = 1; });
