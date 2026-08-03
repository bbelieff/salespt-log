/**
 * 아레나 새 시즌 **개막 준비 진단** — 읽기 전용(쓰기 0). AR-2b 후속.
 *
 * 실행 위치: **VPS**(.env/.env.local 에 SA·SHEETS_REGISTRY_ID 보유)
 *   node scripts/ops/arena-season-readiness.mjs --season 2
 *
 * 왜 필요한가 — 전광판이 새 시즌을 제대로 보여주려면 **두 값**이 맞아야 한다:
 *   ① cohorts 탭 시즌 행(label "A{n}") J열 seasonStartISO = 개막일
 *      → 시즌 번호·주차 판정 정본(lib/service/arena-season-config).
 *   ② 참가자 개인시트 `영업관리!O1`(수강시작일) = 개막일
 *      → 시트 대시보드 C33:H40 의 **주차 버킷 앵커**. 전광판 표·랭킹이 이 값을 읽는다.
 *
 * ⚠️ ②가 특히 위험하다: `create-arena-members` 는 개강일을 쓰지 않고(일반 기수 생성과 달리),
 *   복제 템플릿의 O1 이 그대로 남는다. 이전 시즌 개강일이 남아 있으면 개막일 기록이
 *   `weekIndexOf(개막일, 옛개강일)` = 9주차 이상으로 튀어 **1~8주 표에서 통째로 빠진다**
 *   → 전광판에 신규 시즌 참가자가 **전원 0.0** 으로 시즌 내내 표시된다.
 *
 * 출력: 문제 목록 + 조치 안내. 종료코드 0=준비완료 / 1=조치 필요.
 * ★비밀값(SA 키·URL) 미출력.
 */
import { existsSync, readFileSync } from "node:fs";
import { google } from "googleapis";

// ── env (.env → .env.local 순으로 병합, 뒤가 우선) ──
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

const arg = (name, fallback = "") => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const SEASON = Number(arg("--season", "0"));
if (!Number.isInteger(SEASON) || SEASON <= 0) {
  console.error("사용법: node scripts/ops/arena-season-readiness.mjs --season 2");
  process.exit(2);
}

const REGISTRY_ID = env("SHEETS_REGISTRY_ID");
const COHORTS_TAB = env("SHEETS_COHORTS_TAB") || "cohorts";
const REGISTRY_TAB = env("SHEETS_REGISTRY_TAB") || "users";
if (!REGISTRY_ID) {
  console.error("❌ SHEETS_REGISTRY_ID 없음 — VPS(.env/.env.local) 에서 실행하세요.");
  process.exit(2);
}

function sheetsClient() {
  const raw = env("GOOGLE_SERVICE_ACCOUNT_KEY") || env("GOOGLE_SA_KEY");
  if (!raw) {
    console.error("❌ 서비스 계정 키 없음 — VPS 에서 실행하세요.");
    process.exit(2);
  }
  const creds = JSON.parse(raw);
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: (creds.private_key || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** 날짜 셀이 시리얼/로케일로 와도 흡수 (lib/repo/cohorts.normalizeSeasonStart 와 동일 규칙). */
function normDate(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (ISO.test(s)) return s;
  const m = s.match(/^(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})\.?$/);
  if (!m) return "";
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

async function readRange(api, spreadsheetId, range) {
  const res = await api.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  return res.data.values ?? [];
}

const problems = [];
const notes = [];

async function main() {
  const api = sheetsClient();
  const seasonLabel = `A${SEASON}`;
  console.log(`\n🔎 아레나 시즌${SEASON} 개막 준비 진단 (읽기 전용)\n`);

  // ── ① cohorts 시즌 행 J (시즌 번호·주차 판정 정본) ──
  const cohortRows = await readRange(api, REGISTRY_ID, `${COHORTS_TAB}!A2:J`);
  const row = cohortRows.find((r) => String(r?.[0] ?? "").trim() === seasonLabel);

  if (!row) {
    problems.push(
      `cohorts 탭에 시즌 행 "${seasonLabel}" 이 없습니다.\n` +
        `   → 로스터 생성(관리자 화면 [아레나 추가])을 먼저 하거나, /admin/cohorts 에서 개강일을 저장하면 자동 생성됩니다.`,
    );
  } else {
    const type = String(row[3] ?? "").trim();
    const status = String(row[1] ?? "").trim() || "active";
    const j = normDate(row[9]);
    console.log(`  cohorts ${seasonLabel}: status=${status} type=${type || "(빈값=cohort)"} J=${j || "(미입력)"}`);

    if (status === "archived") {
      problems.push(`cohorts "${seasonLabel}" 이 archived 입니다 — 전광판 시즌 판정에서 제외됩니다.`);
    }
    if (type !== "arena") {
      problems.push(
        `cohorts "${seasonLabel}" 의 type 이 "${type || "(빈값)"}" 입니다 — arena 여야 시즌으로 인식됩니다.\n` +
          `   → /admin/cohorts 에서 개강일을 저장하면 type 이 arena 로 교정됩니다.`,
      );
    }
    if (!j) {
      problems.push(
        `cohorts "${seasonLabel}" J열(시즌 개강일)이 비었습니다 — 전광판이 시즌 번호를 표시하지 않습니다.\n` +
          `   → /admin/cohorts → ${seasonLabel} 행 [시즌 개강일] 에 개막일을 입력하세요.`,
      );
    } else {
      notes.push(`cohorts 개강일 = ${j}`);
    }
  }

  // ── ② 참가자 개인시트 O1 (전광판 표·랭킹의 주차 앵커) ──
  const users = await readRange(api, REGISTRY_ID, `${REGISTRY_TAB}!A2:R`);
  const members = users
    .map((r) => ({
      email: String(r?.[0] ?? "").trim(),
      cohort: String(r?.[1] ?? "").replace(/기\s*$/, "").trim(),
      name: String(r?.[2] ?? "").trim(),
      sheetId: String(r?.[3] ?? "").trim(),
    }))
    .filter((u) => new RegExp(`^A${SEASON}-\\d+$`).test(u.cohort) && u.sheetId);

  console.log(`  시즌${SEASON} 참가자 시트: ${members.length}개`);
  if (members.length === 0) {
    notes.push(`시즌${SEASON} 참가자 행이 아직 없습니다(로스터 생성 전이면 정상).`);
  }

  const expected = row ? normDate(row[9]) : "";
  const bad = [];
  for (const m of members) {
    let o1 = "";
    try {
      const v = await readRange(api, m.sheetId, "영업관리!O1");
      o1 = normDate(v?.[0]?.[0]);
    } catch (e) {
      bad.push({ ...m, o1: "(읽기 실패)", why: e?.message?.slice(0, 60) ?? "unknown" });
      continue;
    }
    if (!o1) bad.push({ ...m, o1: "(비어있음)" });
    else if (expected && o1 !== expected) bad.push({ ...m, o1 });
  }

  if (bad.length > 0) {
    const sample = bad.slice(0, 8).map((b) => `      · ${b.name || b.email} — O1=${b.o1}`).join("\n");
    problems.push(
      `참가자 시트 ${bad.length}개의 영업관리!O1 이 시즌 개강일(${expected || "미정"})과 다릅니다.\n` +
        `   → 이 상태면 개막일 기록이 9주차 이상으로 계산돼 전광판 표에서 **전원 0.0** 으로 보입니다.\n` +
        `   → 새 시즌 템플릿의 O1/O2 를 개막일 기준으로 맞춘 뒤 로스터를 만들거나,\n` +
        `      이미 만들어진 시트는 O1(개강일)·O2(종강일)을 직접 수정하세요.\n` +
        sample +
        (bad.length > 8 ? `\n      … 외 ${bad.length - 8}개` : ""),
    );
  } else if (members.length > 0) {
    notes.push(`참가자 시트 O1 전부 일치 (${expected})`);
  }

  // ── 결과 ──
  console.log("");
  if (notes.length) notes.forEach((n) => console.log(`  ✅ ${n}`));
  if (problems.length === 0) {
    console.log(`\n✅ 시즌${SEASON} 개막 준비 완료 — 전광판이 개막일부터 자동 전환됩니다.\n`);
    process.exit(0);
  }
  console.log(`\n❌ 조치 필요 ${problems.length}건\n`);
  problems.forEach((p, i) => console.log(`  ${i + 1}. ${p}\n`));
  process.exit(1);
}

main().catch((e) => {
  console.error("진단 실패:", e?.message ?? e);
  process.exit(2);
});
