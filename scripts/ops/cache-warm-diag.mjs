#!/usr/bin/env node
/**
 * 캐시 워밍이 왜 느린지 진단 — **읽기 전용**. 시트/DB 쓰기 0.
 *
 * 왜 필요한가 (2026-08-31, #903):
 *   워밍 한 바퀴가 **51초** 걸리고 일부는 실패한다(`/api/health` 의 `warm.lastMs`/`allOk`).
 *   원인 후보는 하나 — `enrichUsersWithDates` 가 레지스트리 **캐시 컬럼 I~L**
 *   (cohortLabel·nameLabel·courseStartISO·graduationISO)이 비어 있으면 학생마다 개인
 *   시트로 폴백한다는 것. 그 컬럼은 관리자 [🔄 동기화] 버튼으로만 채워진다.
 *   **그래서 먼저 센다.** 몇 명이 비어 있는지 모르면 고칠 대상도 모른다.
 *
 * 실행(VPS): node scripts/ops/cache-warm-diag.mjs
 *
 * ⚠️ 개인정보 미출력 — 이 출력은 GitHub Actions 로그에 남는다. 이메일·이름·시트ID를
 *    절대 찍지 않고 **집계와 기수 라벨만** 낸다.
 */
import { existsSync, readFileSync } from "node:fs";
import { google } from "googleapis";

/**
 * .env 파서 — **따옴표로 감싼 여러 줄 값**을 지원한다.
 *
 * 기존 ops 스크립트들의 한 줄 파서는 값이 물리적으로 여러 줄에 걸치면 **첫 줄만** 집는다.
 * SA 개인키가 그렇게 저장돼 있으면 `"-----BEGIN PRIVATE KEY-----` 만 읽혀 "비어있지 않음"
 * 검사를 통과하고, 실제 서명 단계에서야 `DECODER routines::unsupported` 로 죽는다
 * (2026-08-31 이 스크립트가 정확히 그렇게 실패). 그래서 닫는 따옴표까지 이어 읽는다.
 */
function loadEnv() {
  const out = {};
  for (const f of [".env", ".env.local"]) {
    if (!existsSync(f)) continue;
    const lines = readFileSync(f, "utf8").replace(/\r/g, "").split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const m = lines[i].match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      let v = m[2];
      const q = v[0] === '"' || v[0] === "'" ? v[0] : "";
      if (q) {
        v = v.slice(1);
        while (!v.endsWith(q) && i + 1 < lines.length) {
          i += 1;
          v += "\n" + lines[i];
        }
        if (v.endsWith(q)) v = v.slice(0, -1);
      } else {
        v = v.trim();
      }
      out[m[1]] = v;
    }
  }
  return out;
}
const fileEnv = loadEnv();
const env = (k) => process.env[k] || fileEnv[k] || "";

const REGISTRY_ID = env("SHEETS_REGISTRY_ID");
const USERS_TAB = env("SHEETS_REGISTRY_TAB") || "users";
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
/**
 * PEM 정규화 — 리터럴 \n 을 실개행으로 되돌리고, 개행이 아예 없는 한 줄 키도 복원한다.
 *
 * 실측(2026-08-31 VPS): 이 스크립트 초판이 `replace(/\n/g, "\n")` 로 잘못 써 있었다 —
 * **실개행을 실개행으로 바꾸는 무의미한 치환**이라 리터럴 `\n` 이 그대로 남았고,
 * Node crypto 가 `DECODER routines::unsupported` 로 죽었다. 진단 로그가
 * "길이 1726 · PEM머리말 있음 · 실개행 없음" 을 찍어 한 번에 잡혔다.
 * 앱은 Next 의 dotenv 가 처리해 주지만 ops 스크립트는 손수 해야 한다.
 */
function normalizePem(raw) {
  let k = String(raw || "").replace(/\\n/g, "\n").trim();
  if (k.includes("\n")) return k;
  // 개행 표시가 아예 없는 경우 — 헤더/푸터를 떼고 본문을 64자마다 끊어 표준 PEM 복원.
  const m = k.match(/^(-----BEGIN [A-Z ]+-----)([\s\S]*?)(-----END [A-Z ]+-----)$/);
  if (!m) return k;
  const wrapped = m[2].replace(/\s+/g, "").match(/.{1,64}/g) || [];
  return `${m[1]}\n${wrapped.join("\n")}\n${m[3]}\n`;
}

const SA_KEY = normalizePem(env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"));

if (!REGISTRY_ID || !SA_EMAIL || !SA_KEY) {
  console.error("cache-warm-diag: SA/레지스트리 env 누락");
  process.exit(1);
}

// 키가 깨졌을 때 원인을 바로 알 수 있게 **형태만** 찍는다(내용 미출력).
{
  const looksPem = SA_KEY.startsWith("-----BEGIN");
  const hasRealNewline = SA_KEY.includes("\n");
  console.log(`[env] SA 키 형태 — 길이 ${SA_KEY.length} · PEM머리말 ${looksPem ? "있음" : "없음"} · 실개행 ${hasRealNewline ? "있음" : "없음"}`);
  if (!looksPem || !hasRealNewline) console.error("[env] 키 형태가 이상하다 — .env 값이 잘렸을 수 있다(여러 줄 값).");
}

const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
]);
const sheets = google.sheets({ version: "v4", auth });

// 앱(lib/repo/sheets-client.ts)과 **같은 렌더 옵션** — 안 그러면 날짜가 시리얼 숫자로 와서
// "ISO 아님"으로 잘못 세게 된다(backfill-registry.mjs 주석의 그 함정).
async function readRange(range) {
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: REGISTRY_ID,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  return r.data.values ?? [];
}

const s = (r, i) => String(r?.[i] ?? "").trim();
const ISO = /^\d{4}-\d{2}-\d{2}$/;

// lib/service/daily-source.ts 의 DB_READ_COHORTS 와 동일 — 어긋나면 진단이 거짓말을 한다.
const DB_READ_COHORTS = new Set(["8", "9", "연습", "4", "10", "7", "6"]);
const isArenaLabel = (c) => /^A\d+-\d+$/.test(c);
const normCohort = (c) => String(c ?? "").replace(/기\s*$/, "").trim();
const isDbPilot = (c) => DB_READ_COHORTS.has(normCohort(c)) || isArenaLabel(normCohort(c));

async function main() {
  const rows = await readRange(`${USERS_TAB}!A2:R`);

  const active = rows.filter(
    (r) => s(r, 4) === "trainee" && s(r, 5) === "active" && s(r, 3) !== "",
  );

  let complete = 0;
  const missing = { cohortLabel: 0, nameLabel: 0, courseStart: 0, graduation: 0 };
  const byCohort = new Map();
  let dbPilot = 0;

  for (const r of active) {
    const cohort = normCohort(s(r, 1)) || "(빈값)";
    const cl = s(r, 8), nl = s(r, 9), cs = s(r, 10), gr = s(r, 11);
    const ok = cl !== "" && nl !== "" && ISO.test(cs) && ISO.test(gr);
    if (ok) complete += 1;
    else {
      if (cl === "") missing.cohortLabel += 1;
      if (nl === "") missing.nameLabel += 1;
      if (!ISO.test(cs)) missing.courseStart += 1;
      if (!ISO.test(gr)) missing.graduation += 1;
    }
    if (isDbPilot(cohort)) dbPilot += 1;
    const e = byCohort.get(cohort) ?? { total: 0, complete: 0 };
    e.total += 1;
    if (ok) e.complete += 1;
    byCohort.set(cohort, e);
  }

  const incomplete = active.length - complete;
  console.log("=== 캐시 워밍 진단 (읽기 전용) ===");
  console.log(`활성 수강생(시트ID 보유): ${active.length}명`);
  console.log(`  캐시 컬럼 I~L 완비    : ${complete}명  → 시트 조회 0회 (빠름)`);
  console.log(`  캐시 컬럼 미완비      : ${incomplete}명 → **학생마다 개인시트 폴백** (느림)`);
  console.log(`  DB 정본 기수 해당      : ${dbPilot}명 (통계는 DB 배치로 감)`);
  console.log("");
  console.log("미완비 사유별 (중복 가능):");
  console.log(`  cohortLabel(I) 빔     : ${missing.cohortLabel}`);
  console.log(`  nameLabel(J)   빔     : ${missing.nameLabel}`);
  console.log(`  courseStart(K) 비ISO  : ${missing.courseStart}`);
  console.log(`  graduation(L)  비ISO  : ${missing.graduation}`);
  console.log("");
  console.log("기수별 (라벨만 — 개인정보 없음):");
  for (const [c, e] of [...byCohort.entries()].sort()) {
    const mark = e.complete === e.total ? "OK" : "폴백";
    console.log(`  ${String(c).padEnd(10)} ${String(e.complete).padStart(3)}/${String(e.total).padEnd(3)} 완비  [${mark}]`);
  }
  console.log("");
  if (incomplete === 0) {
    console.log("판정: 캐시 컬럼은 전부 채워져 있다 — 51초의 원인은 여기가 아니다. 다른 곳을 봐라.");
  } else {
    const pct = Math.round((incomplete / active.length) * 100);
    console.log(`판정: ${incomplete}명(${pct}%)이 매 워밍마다 개인 시트를 읽는다.`);
    console.log("      관리자 화면의 [🔄 동기화] 가 이 컬럼을 채운다. 채우면 워밍이 몇 초로 준다.");
  }
}

main().catch((e) => {
  // 비밀값이 섞일 수 있어 메시지만, 스택 없이.
  console.error("cache-warm-diag 실패:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
