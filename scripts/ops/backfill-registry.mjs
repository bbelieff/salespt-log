/**
 * 마스터 레지스트리(users·cohorts 탭) 전량 → Postgres 1회 적재 (R7 Phase1 · BBE-55).
 *
 * 실행 위치: **VPS** (.env/.env.local 에 SA·SHEETS_REGISTRY_ID·DATABASE_URL 보유).
 *   node scripts/ops/backfill-registry.mjs            # dry-run(기본, 쓰기 0)
 *   node scripts/ops/backfill-registry.mjs --execute  # 실제 적재 + 행수 대조
 *
 * 선행: `npm run db:migrate` 로 0001·0002 적용 완료(테이블·자연키 제약 존재).
 *
 * ⚠️ 이 스크립트는 **시트를 읽기만** 한다(spreadsheets.readonly). 시트 쓰기 0 —
 *    2026-08-05 A2 열밀림 사고(values.append 테이블 자동탐지)의 재발 여지가 구조적으로 없다.
 *
 * 자연키(= dual-write 미러와 반드시 동일, lib/repo/db/registry.ts):
 *   users = (email, cohort, name) · cohorts = (label).
 *   prep 행은 email 이 빈 문자열이라 (email,cohort) 만으로는 뭉개진다 —
 *   근거·실측은 lib/repo/db/migrations/0002_users_natural_key.sql 주석 참조.
 *   ★정규화 규칙도 **반드시 동일**: email=trim+소문자, cohort·name=trim
 *   (`lib/repo/db/registry.ts:normalizeUserKey`). 여기만 달라지면 같은 시트 행이 두 키로
 *   갈라져 유령 행이 생기고, 이 스크립트는 upsert 전용이라 그걸 영원히 못 지운다.
 * 멱등: upsert. 재실행하면 시트 현재값으로 수렴한다(시트가 정본).
 * ★URL·비밀번호·SA 키 로그 미출력.
 */
import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { google } from "googleapis";
import { Pool } from "pg";

// ── env (.env → .env.local 순, 뒤가 우선) ─────────────────────────
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
const USERS_TAB = env("SHEETS_REGISTRY_TAB") || "users";
const COHORTS_TAB = env("SHEETS_COHORTS_TAB") || "cohorts";
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const SA_KEY = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
const DB_URL = env("DATABASE_URL");

if (!REGISTRY_ID || !SA_EMAIL || !SA_KEY) {
  console.error("backfill-registry: SA/레지스트리 env 누락");
  process.exit(1);
}
if (EXECUTE && !DB_URL) {
  console.error("backfill-registry: --execute 인데 DATABASE_URL 없음");
  process.exit(1);
}

const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
]);
const sheets = google.sheets({ version: "v4", auth });

/**
 * ★ 앱의 레지스트리 읽기(`lib/repo/sheets-client.ts:readRange`)와 **같은 렌더 옵션**이어야 한다.
 *
 * `dateTimeRenderOption` 을 생략하면 Sheets API 기본값이 `SERIAL_NUMBER` 라, 앱이 늘 보던
 * `"2026. 8. 7."` 대신 `46241` 이 DB 에 들어간다. 그러면 같은 컬럼이 **출처에 따라 두 형식으로
 * 갈린다** — 이중기록 미러(BBE-55)는 앱 경로라 문자열, 이 백필은 숫자.
 *
 * 영향 컬럼 3개(실측): `users.course_start_iso`(K) · `users.graduation_iso`(L) ·
 * `cohorts.season_start_iso`(J). 앞의 둘은 BBE-57 의 D-day·주차·퍼널 계산 정본이고,
 * 마지막은 전광판 시즌 판정 정본이다.
 *
 * 이 스크립트의 자동 대조는 **행 수만** 보므로 이 어긋남을 못 잡는다 — 조용히 통과한 뒤
 * 게이트를 켠 화면에서야 날짜가 깨진 채 드러난다. (지적: 반장 FM·260806, BBE-56 코멘트
 * 2026-08-09 01:19Z / 확인: 데탑 C작업원A(260809) 실측 — `sheets-client.ts:97-98` 대조)
 */
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

/** users 시트 행(A~T) → DB 행. 빈 행(키 3컬럼 전부 공백)은 호출부가 거른다. */
function userFromRow(r) {
  const sortRaw = parseInt(s(r, 12), 10);
  const role = s(r, 4);
  const status = s(r, 5);
  return {
    // normalizeUserKey(lib/repo/db/registry.ts) 와 동일 규칙 — 어긋나면 유령 행.
    email: s(r, 0).toLowerCase(),
    cohort: s(r, 1),
    name: s(r, 2),
    spreadsheet_id: s(r, 3),
    // CHECK 제약 위반 방지 — 시트의 빈값/오타는 스키마 기본값으로 정규화(parseRow 와 동일 규칙).
    role: role === "trainer" || role === "admin" ? role : "trainee",
    status: status === "pending" || status === "archived" ? status : "active",
    assigned_trainer: s(r, 6),
    team: s(r, 7),
    cohort_label: s(r, 8),
    name_label: s(r, 9),
    course_start_iso: s(r, 10),
    graduation_iso: s(r, 11),
    sort_order: Number.isFinite(sortRaw) && sortRaw >= 0 ? sortRaw : 0,
    drive_parent_path: s(r, 13),
    feedback_folder_id: s(r, 14),
    drive_link_status: s(r, 15),
    memo: s(r, 16),
    captain_of: s(r, 17),
    gcal_token: s(r, 18),
    gcal_settings: s(r, 19),
  };
}

/** cohorts 시트 행(A~J) → DB 행. */
function cohortFromRow(r) {
  return {
    label: s(r, 0),
    status: s(r, 1) === "archived" ? "archived" : "active",
    note: s(r, 2),
    type: s(r, 3) === "arena" ? "arena" : "cohort",
    template_sheet_id: s(r, 4),
    root_folder_id: s(r, 5),
    roster_sheet_id: s(r, 6),
    sheets_folder_id: s(r, 7),
    company_parent_folder_id: s(r, 8),
    season_start_iso: s(r, 9),
  };
}

const USER_COLS = [
  "email", "cohort", "name", "spreadsheet_id", "role", "status", "assigned_trainer", "team",
  "cohort_label", "name_label", "course_start_iso", "graduation_iso", "sort_order",
  "drive_parent_path", "feedback_folder_id", "drive_link_status", "memo", "captain_of",
  "gcal_token", "gcal_settings",
];
const USER_KEY = ["email", "cohort", "name"];
const COHORT_COLS = [
  "label", "status", "note", "type", "template_sheet_id", "root_folder_id",
  "roster_sheet_id", "sheets_folder_id", "company_parent_folder_id", "season_start_iso",
];

function upsertSql(table, cols, keyCols) {
  const set = cols.filter((c) => !keyCols.includes(c)).map((c) => `${c} = excluded.${c}`).join(", ");
  return `insert into ${table} (id, ${cols.join(", ")})
     values ($1, ${cols.map((_, i) => `$${i + 2}`).join(", ")})
     on conflict (${keyCols.join(", ")}) do update set ${set}, updated_at = now()`;
}

/** 중복 자연키 그룹 보고 — 조용한 유실을 만들지 않는다(§ "no silent caps"). */
function reportDuplicates(items, keyOf, label) {
  const m = new Map();
  for (const x of items) {
    const k = keyOf(x);
    (m.get(k) ?? m.set(k, []).get(k)).push(x);
  }
  const dups = [...m.entries()].filter(([, v]) => v.length > 1);
  if (dups.length) {
    console.log(`\n⚠️ ${label} 자연키 중복 ${dups.length}건 — 마지막 값으로 수렴(시트 정리 대상):`);
    for (const [k, v] of dups) console.log(`   "${k}" ×${v.length}`);
  }
  return m.size;
}

async function main() {
  const userRows = (await readRange(`${USERS_TAB}!A2:T`))
    .map(userFromRow)
    .filter((u) => u.email || u.cohort || u.name);
  const cohortRows = (await readRange(`${COHORTS_TAB}!A2:J`))
    .map(cohortFromRow)
    .filter((c) => c.label);

  console.log(`시트 users 데이터행 ${userRows.length} · cohorts 데이터행 ${cohortRows.length}`);
  const uniqUsers = reportDuplicates(userRows, (u) => `${u.email}|${u.cohort}|${u.name}`, "users");
  const uniqCohorts = reportDuplicates(cohortRows, (c) => c.label, "cohorts");
  console.log(`\n고유 자연키: users ${uniqUsers} · cohorts ${uniqCohorts}`);
  const prepCount = userRows.filter((u) => !u.email).length;
  console.log(`(참고) email 빈 prep 행 ${prepCount}건 — 자연키에 name 이 있어 개별 보존됨`);

  if (!EXECUTE) {
    console.log("\n dry-run — 실제 적재는 --execute. 쓰기 0건.");
    return;
  }

  const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false }, max: 4 });
  try {
    const uSql = upsertSql("users", USER_COLS, USER_KEY);
    const cSql = upsertSql("cohorts", COHORT_COLS, ["label"]);
    let uOk = 0, cOk = 0;
    for (const u of userRows) {
      await pool.query(uSql, [randomUUID(), ...USER_COLS.map((c) => u[c])]);
      uOk++;
    }
    for (const c of cohortRows) {
      await pool.query(cSql, [randomUUID(), ...COHORT_COLS.map((k) => c[k])]);
      cOk++;
    }
    console.log(`\n적재 완료 — users upsert ${uOk}회 · cohorts upsert ${cOk}회`);

    // 수용 기준 대조: 시트 고유 자연키 수 == DB 행수.
    const uCount = (await pool.query("select count(*)::int as n from users")).rows[0].n;
    const cCount = (await pool.query("select count(*)::int as n from cohorts")).rows[0].n;
    console.log("\n=== 행수 대조 ===");
    console.log(`users  : 시트 ${userRows.length}행(고유키 ${uniqUsers}) vs DB ${uCount} → ${uCount === uniqUsers ? "✅ 일치" : "❌ 불일치"}`);
    console.log(`cohorts: 시트 ${cohortRows.length}행(고유키 ${uniqCohorts}) vs DB ${cCount} → ${cCount === uniqCohorts ? "✅ 일치" : "❌ 불일치"}`);
    if (uCount !== uniqUsers || cCount !== uniqCohorts) {
      console.log("※ DB 가 더 많으면 시트에서 삭제된 옛 행이 남은 것 — 삭제 미러(BBE-55)는 앞으로의 삭제만 반영한다.");
    }
  } finally {
    await pool.end().catch(() => {});
  }
}

main().catch((e) => {
  const msg = (e instanceof Error ? e.message : String(e)).replace(/postgres(ql)?:\/\/\S+/gi, "[DATABASE_URL]");
  console.error(`backfill-registry 실패: ${msg}`);
  process.exit(1);
});
