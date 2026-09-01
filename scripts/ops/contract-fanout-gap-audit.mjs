/**
 * 「계약 도장은 찍혔는데 장부에 줄이 없는」 계약 전수 감사 — **읽기 전용** (2026-09-01).
 *
 *   node scripts/ops/contract-fanout-gap-audit.mjs
 *   node scripts/ops/contract-fanout-gap-audit.mjs --cohort 10,9
 *
 * ## 왜 필요한가 (2026-09-01 belie 신고 · 10기 문병규 실측)
 * 대시보드는 「계약 4건」인데 실무/수납엔 3건만 떴다. 수강생이 직접 연락했다.
 * 시트 원본 대조 결과 `04 업체관리` 에 **상태=계약**(케이탑전기진단, 8/31, ₩1,100,000)이
 * 있는데 `02 계약수납관리` 에는 그 줄이 **없었다**. 매출 110만원이 장부에서 통째로 빠진다.
 *
 * 근인은 계약 처리가 **두 번의 쓰기로 쪼개져** 있고 둘째가 빠져도 아무도 안 맞춰주는 것:
 *   ① `04` 에 상태=계약 기록      (app/(app)/schedule/page.tsx patchMeeting)
 *   ② `02` 에 계약수납 행 append  (같은 파일 addContractPayment — ①이 성공한 뒤 별도 호출)
 * ②가 실패하면 경고만 뜨고 끝나며, 화면 데이터에서 그 미팅을 못 찾으면 **`✓ 저장 완료`**
 * 라는 성공 표시를 띄우고 ②를 통째로 건너뛴다. 어긋난 뒤 스스로 낫는 경로가 없다.
 *
 * 기존 `db-contract-drift-audit.mjs` 는 **02 의 시트↔DB** 만 비교해서 이 유형을 못 잡는다
 * (문병규 건은 시트·DB 양쪽에 똑같이 없다). 그래서 **04↔02** 축을 새로 본다.
 *
 * ## 무엇을 세는가 (수강생 1명당)
 *   · 도장(04): `04 업체관리` 에서 상태(J)="계약" 인 행
 *   · 장부(02): `02 계약수납관리` 6행~ 의 행
 *   · 짝짓기: 02 의 **AK(연결 미팅 id)** 우선 → 없으면 (계약일 C == 미팅날짜 D) + 업체명 일치.
 *     이는 `appendFromContract(dateCompanyFallback=true)` 의 중복 방지 규칙과 **같은 규칙**이다 —
 *     여기서만 느슨하면 실제로는 복구가 되는 건을 "누락"으로 잘못 보고한다.
 *   · 누락 = 도장은 있는데 짝이 없는 계약. **이게 화면에서 사라진 매출이다.**
 *
 * 02 에만 있고 04 에 없는 행은 **정상**이라 세지 않는다 — 「이전 계약업체 등록」(구분=이월,
 * 이월원본행id=prior:) 은 미팅 없이 직접 만든 줄이다.
 *
 * ## 안전
 *   ★쓰기 API 를 한 줄도 호출하지 않는다 — `spreadsheets.values.batchGet` 만 쓴다.
 *   Sheets 쿼터(60 reads/min/user) 보호로 수강생 1명당 1 batchGet + 간격 1.2초.
 *   ★비밀값·이메일 원문 미출력(마스킹). 시트 ID 미출력.
 */
import { existsSync, readFileSync } from "node:fs";
import { google } from "googleapis";

// ── env ───────────────────────────────────────────────────────────
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
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : fb;
};

const COHORT_FILTER = arg("--cohort", "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const GAP_MS = Number(arg("--gap", "1200"));

const REG = env("SHEETS_REGISTRY_ID");
const REG_TAB = env("SHEETS_REGISTRY_TAB") || "users";

// lib/config/index.ts SHEET_RANGES 와 동일해야 한다 — 어긋나면 감사 결과가 거짓이 된다.
const MEETINGS_TAB = "04 업체관리(앱자동작성용)";
const MEETINGS_RANGE = "A2:AS";
const CONTRACT_TAB = "02 계약수납관리";
const CONTRACT_RANGE = "A6:AK";

// 04 열: A=id(0) D=미팅날짜(3) G=업체명(6) J=상태(9) L=수임비(11)
const M = { id: 0, 날짜: 3, 채널: 5, 업체명: 6, 상태: 9, 수임비: 11 };
// 02 열: C=계약일(2) D=업체명(3) E=수임비(4) AI=구분(34) AJ=이월원본행id(35) AK=연결미팅id(36)
const C = { 계약일: 2, 업체명: 3, 수임비: 4, 구분: 34, 이월원본행id: 35, 미팅id: 36 };

function normalizePem(raw) {
  const s = String(raw || "");
  return s.includes("\\n") ? s.replace(/\\n/g, "\n") : s;
}
const sheets = google.sheets({
  version: "v4",
  auth: new google.auth.JWT({
    email: env("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    key: normalizePem(env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY")),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  }),
});

const cell = (row, i) => String(row?.[i] ?? "").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 날짜 표기 흔들림 흡수 — "2026-08-31" · "26/08/31" · "2026. 8. 31." · **시리얼 46192** →
 * "2026-08-31".
 *
 * ⚠️ 시리얼 처리를 빼면 **없는 누락이 생긴다.** 2026-09-01 첫 실행에서 강구수(이태평) 님
 * "국수 50,000원"이 누락으로 잡혔는데, 04 미팅 날짜가 시리얼 숫자(`46192`)라 02 의 ISO
 * 날짜와 짝이 안 맞았을 뿐이었다. 변환 규칙은 `db-contract-drift-audit.mjs:dateish` 와
 * 동일하게 맞춘다(같은 시트를 같은 규칙으로 읽어야 두 감사 결과가 서로 어긋나지 않는다).
 */
function normDate(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Sheets 시리얼(1899-12-30 기준). 20000 미만은 날짜로 보지 않는다(금액·개수 오인 방지).
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
const normName = (raw) => String(raw ?? "").trim().replace(/\s+/g, "");
const money = (raw) => Number(String(raw ?? "").replace(/[^0-9.-]/g, "")) || 0;

async function main() {
  if (!REG) throw new Error("SHEETS_REGISTRY_ID 미설정");

  const reg = await sheets.spreadsheets.values.get({
    spreadsheetId: REG,
    range: `${REG_TAB}!A2:F`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const users = (reg.data.values ?? [])
    .map((r) => ({
      cohort: cell(r, 1),
      name: cell(r, 2),
      spreadsheetId: cell(r, 3),
      role: cell(r, 4),
      status: cell(r, 5),
    }))
    .filter(
      (u) =>
        u.spreadsheetId &&
        u.name &&
        u.role !== "trainer" &&
        u.role !== "admin" &&
        u.status === "active" &&
        (COHORT_FILTER.length === 0 || COHORT_FILTER.includes(u.cohort.replace(/기$/, ""))),
    );

  console.log(
    `대상 ${users.length}명${COHORT_FILTER.length ? ` (기수 ${COHORT_FILTER.join(",")})` : " (활성 전원)"} · 읽기 간격 ${GAP_MS}ms\n`,
  );

  const gaps = [];
  const failed = [];
  let stamped = 0;
  let ledger = 0;

  for (const u of users) {
    await sleep(GAP_MS);
    let res;
    try {
      res = await sheets.spreadsheets.values.batchGet({
        spreadsheetId: u.spreadsheetId,
        ranges: [`${MEETINGS_TAB}!${MEETINGS_RANGE}`, `${CONTRACT_TAB}!${CONTRACT_RANGE}`],
        valueRenderOption: "UNFORMATTED_VALUE",
      });
    } catch (e) {
      failed.push({ ...u, error: e?.message || String(e) });
      console.log(`FAIL  ${u.cohort}\t${u.name}\t${e?.message || e}`);
      continue;
    }
    const meetingRows = res.data.valueRanges?.[0]?.values ?? [];
    const contractRows = res.data.valueRanges?.[1]?.values ?? [];

    const contracts = contractRows.filter((r) => cell(r, C.업체명) || cell(r, C.계약일));
    const byMeetingId = new Set(
      contracts.map((r) => cell(r, C.미팅id)).filter(Boolean),
    );
    const byDateName = new Set(
      contracts.map((r) => `${normDate(cell(r, C.계약일))}|${normName(cell(r, C.업체명))}`),
    );

    const stamps = meetingRows.filter((r) => cell(r, M.상태) === "계약");
    stamped += stamps.length;
    ledger += contracts.length;

    // 짝짓기 — appendFromContract(dateCompanyFallback=true) 와 같은 규칙.
    const missing = stamps.filter((r) => {
      const id = cell(r, M.id);
      if (id && byMeetingId.has(id)) return false;
      return !byDateName.has(`${normDate(cell(r, M.날짜))}|${normName(cell(r, M.업체명))}`);
    });

    const mark = missing.length > 0 ? "⚠" : " ";
    console.log(
      `${mark} ${u.cohort}\t${u.name}\t도장 ${stamps.length}\t장부 ${contracts.length}\t누락 ${missing.length}`,
    );
    for (const r of missing) {
      const amount = money(cell(r, M.수임비));
      console.log(
        `    └ ${normDate(cell(r, M.날짜))}  ${cell(r, M.업체명)}  ${amount.toLocaleString()}원  (${cell(r, M.채널)})`,
      );
      gaps.push({ cohort: u.cohort, name: u.name, date: normDate(cell(r, M.날짜)), company: cell(r, M.업체명), amount });
    }
  }

  const lostMoney = gaps.reduce((s, g) => s + g.amount, 0);
  console.log("\n=== 요약 ===");
  console.log(`수강생 ${users.length}명 · 계약 도장 ${stamped}건 · 장부 행 ${ledger}건`);
  console.log(`**장부에서 빠진 계약 ${gaps.length}건 · 합계 ${lostMoney.toLocaleString()}원**`);
  console.log(`영향 받은 수강생 ${new Set(gaps.map((g) => `${g.cohort}/${g.name}`)).size}명 · 읽기 실패 ${failed.length}명`);
  if (failed.length) {
    console.log("\n읽기 실패 목록(시트 공유·탭 이름 확인 필요):");
    for (const f of failed) console.log(`  ${f.cohort}\t${f.name}\t${f.error}`);
  }
}

main().catch((e) => {
  console.error("치명 오류:", e?.message || e);
  process.exit(1);
});
