/**
 * 8기 등 지정 기수 시트 전체 → Supabase sheet_rows 1회 적재 (db-migration-pilot §1 P1).
 *
 * 실행 위치: **VPS** (.env/.env.local 에 SA·SHEETS_REGISTRY_ID·DATABASE_URL 보유)
 *   — GitHub Actions "DB Backfill" 워크플로가 SSH 로 실행. 기본 dry-run.
 *   node scripts/ops/backfill-sheet-rows.mjs --cohort 8 [--execute]
 *   node scripts/ops/backfill-sheet-rows.mjs --cohort 연습 --sheet <시트ID> [--execute]
 *     ↑ **파일럿 편입 전 선백필** — registry B(cohort)가 빈 계정은 --cohort 로 못 찾으므로
 *       시트를 명시해 먼저 DB 를 채우고, 그 다음 B 를 쓴다(순서 반대면 게이트가 DB 로 붙어 빈 화면).
 *
 * row_key 규칙 — lib/repo/db/mirror.ts 의 dual-write 와 **반드시 동일**:
 *   meetings=A열 id · todos=A열 id · contracts=r{행} · db={섹션}:r{행} ·
 *   sales={ISO날짜}:{채널} · company_archive=C열 계약ref.
 * payload = 열문자→값(비어있지 않은 셀만) + _backfill:true. 멱등: upsert(jsonb 병합).
 * ★URL·비밀번호·SA 키 로그 미출력.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";
import { Pool } from "pg";
import {
  LEGACY_CONTRACT_TAB,
  LEGACY_CONTRACT_FIRST_DATA_ROW,
  LEGACY_DB_SECTIONS,
  isLegacyDbSectionTotalRow,
  LEGACY_SALES_CHANNELS,
  legacySalesBlockRow,
} from "./backfill-sheet-rows-legacy.mjs";

// ── env (.env.local 우선 병합 — append-updates 는 첫 파일만 읽는 것과 달리 둘 다) ──
function loadEnv() {
  const out = {};
  for (const f of [".env", ".env.local"]) { // 뒤(.env.local)가 우선 덮어씀
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

const COHORT = (() => {
  const i = process.argv.indexOf("--cohort");
  return i >= 0 ? String(process.argv[i + 1] ?? "").trim() : "";
})();
/**
 * --sheet <spreadsheetId> (선택) — **명시 타겟**. 레지스트리 cohort 와 무관하게 그 시트만 백필.
 * 왜: 기본 선택은 registry B(cohort) 매칭인데, **아직 파일럿에 편입되지 않은 계정은 B 가 비어**
 * 있어 --cohort 로는 찾을 수 없다(연습용/테스터). 그런 계정을 파일럿에 넣으려면 **B 를 쓰기 전에**
 * DB 를 먼저 채워야 하는데(먼저 넣으면 게이트가 DB 로 붙어 빈 화면), 그 선백필을 가능케 한다.
 * email 은 그 시트의 registry 행에서 가져오고, cohort 스탬프는 --cohort 인자 값을 쓴다.
 */
const SHEET = (() => {
  const i = process.argv.indexOf("--sheet");
  return i >= 0 ? String(process.argv[i + 1] ?? "").trim() : "";
})();
const EXECUTE = process.argv.includes("--execute");
// R2-1.5(아레나): 콤마 목록 허용 — 예: --cohort "A1-0,A1-1,A1-2" (단일 라벨 동작 불변).
const COHORTS = COHORT.split(",").map((s) => s.trim().replace(/기\s*$/, "")).filter(Boolean);

const REGISTRY_ID = env("SHEETS_REGISTRY_ID");
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const SA_KEY = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
const DB_URL = env("DATABASE_URL");

// CLI 인자 검증(process.exit) — BBE-67 이 extractUserRows 를 단위테스트로 직접 import 할 수
// 있도록 isMainModule 뒤로 미룬다. 클라이언트 생성 자체는 빈 문자열이어도 던지지 않는다
// (googleapis JWT — 실측 확인됨, CI 에 SA 자격 없어도 import 만으로는 안전).
const isMainModule =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  if (!COHORT) {
    console.error(
      "사용법: node backfill-sheet-rows.mjs --cohort <기수라벨> [--sheet <시트ID>] [--execute]\n" +
        "  --sheet 지정 시: 그 시트만 백필(레지스트리 cohort 무관). --cohort 는 DB 에 스탬프할 라벨.",
    );
    process.exit(1);
  }
  if (!REGISTRY_ID || !SA_EMAIL || !SA_KEY) {
    console.error("backfill: SA/레지스트리 env 누락"); process.exit(1);
  }
  if (EXECUTE && !DB_URL) {
    console.error("backfill: --execute 인데 DATABASE_URL 없음"); process.exit(1);
  }
}

const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
]);
const sheets = google.sheets({ version: "v4", auth });

const colName = (i) => (i < 26 ? String.fromCharCode(65 + i) : "A" + String.fromCharCode(65 + i - 26));
const rowObj = (r, startColIdx = 0) => {
  const o = { _backfill: true };
  r.forEach((v, i) => {
    const s = String(v ?? "").trim();
    if (s !== "") o[colName(startColIdx + i)] = s;
  });
  return o;
};
let gridMissingTab = 0, gridReadFailures = 0;
async function grid(sid, range, attempt = 1) {
  // SERIAL_NUMBER — repo(readCourseStart)와 동일. FORMATTED_STRING 이면 O1 이
  // 로케일 서식("2026. 5. 30.")으로 와서 ISO 파싱 실패 → sales 전체 조용히 스킵
  // (dry-run #1 실측 버그, 2026-07-07).
  // ★2026-08-06 사고 수정: 원래 `.catch(() => null)` 로 API 오류를 전부 조용히 삼켰다 —
  // A2 db-parity 대조에서 시트가 DB보다 일관되게 많은(meetings -89·sales -236 등) 게 이
  // 함수의 무재시도 탓으로 드러났다(a2-db-parity.mjs 에서 같은 버그 재현·확인). "탭 없음"
  // (Unable to parse range — 그 시트에 그 탭이 아예 없음, 영구적)은 재시도 없이 즉시 빈 배열,
  // 그 외(quota 등 일시 오류)는 15~30초 백오프로 재시도한다.
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sid, range, valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "SERIAL_NUMBER",
    });
    return res?.data.values ?? [];
  } catch (e) {
    const msg = String(e?.message ?? e);
    if (/Unable to parse range/.test(msg)) { gridMissingTab++; return []; }
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, /Quota exceeded/.test(msg) ? 15000 * attempt : 1000 * attempt));
      return grid(sid, range, attempt + 1);
    }
    gridReadFailures++;
    console.warn(`    ⚠ grid 읽기 3회 실패(sid=${sid.slice(0, 8)}…, range=${range}): ${msg.slice(0, 100)}`);
    return [];
  }
}
const serialToISO = (v) => {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const n = Number(v);
  if (!Number.isFinite(n) || n < 20000) return null;
  return new Date((n - 25569) * 86400000).toISOString().slice(0, 10);
};

/** 시트 탭 제목 집합(1회 메타 조회) — 현행/5기 legacy 분기 판정용.
 * 실패하면 빈 Set — 호출부는 `titles.size === 0` 을 "판정 불가 → 현행 그대로 시도"로 취급해
 * 메타 조회 실패가 곧 회귀가 되지 않게 한다(BBE-67 census, `docs/plans/active/
 * bbe67-legacy-5gi-adapter.md` §3). */
async function tabTitles(sid) {
  try {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: sid, fields: "sheets(properties(title))",
    });
    return new Set((meta.data.sheets ?? []).map((s) => s.properties.title));
  } catch {
    return new Set();
  }
}

// BBE-67 5기 legacy sales 채널 포지션 표본검증(반장 요구 §4-A) — 전수(5행이 아니라 전체) 대조.
let legacySalesChannelChecked = 0, legacySalesChannelMismatch = 0;
/** dry-run 검증 스크립트가 누적 카운터를 읽기 위한 접근자(let 은 자동 export 안 됨). */
export function getLegacySalesChannelStats() {
  return { checked: legacySalesChannelChecked, mismatch: legacySalesChannelMismatch };
}

/** 한 사용자 시트 → {tab → [{rowKey, payload}]} (dual-write 와 동일 키 규칙). */
async function extractUserRows(sid) {
  const out = { meetings: [], contracts: [], todos: [], sales: [], db: [], company_archive: [] };
  const titles = await tabTitles(sid);

  // 04 미팅 — A=id
  for (const [i, r] of (await grid(sid, "'04 업체관리(앱자동작성용)'!A2:AP")).entries()) {
    const id = String(r[0] ?? "").trim();
    if (id) out.meetings.push({ rowKey: id, payload: rowObj(r), row: i + 2 });
  }
  // 05 실무투두 — A=id (탭 없으면 빈 배열)
  for (const [i, r] of (await grid(sid, "'05 실무투두'!A2:N")).entries()) {
    const id = String(r[0] ?? "").trim();
    if (id) out.todos.push({ rowKey: id, payload: rowObj(r), row: i + 2 });
  }
  // 02 계약수납 — 행 고정 키 r{행}. 신형(계약수납관리) → 6기 구형(계약관리 5) → 5기 legacy
  // (계약관리, 번호 없음, firstDataRow=12: row10=헤더·row11=예시행·row12+=실데이터 — BBE-67
  // census 로 실측 확정, `bbe67-legacy-5gi-adapter.md` §2).
  // 시작행 = 앱 레이아웃(lib/repo/contract-payment.ts TAB_ALIASES)과 동일: 신형 6 / 구형 5.
  // 과거 `>= 3` 이 헤더·예시 구간(r3 "수납총액" 안내행, r5 "00유통" 템플릿 예시행)을
  // 유령 계약으로 적재한 사고 수정(2026-07-12, 전 기수 94행 — repair 스크립트로 정리).
  for (const [tabName, firstDataRow] of [
    ["02 계약수납관리", 6], ["02 계약관리", 5],
    [LEGACY_CONTRACT_TAB, LEGACY_CONTRACT_FIRST_DATA_ROW],
  ]) {
    const rows = await grid(sid, `'${tabName}'!C1:AK`);
    if (rows.length === 0) continue;
    rows.forEach((r, i) => {
      const 계약일 = String(r[0] ?? "").trim(); // C
      const sheetRow = i + 1;
      if (계약일 && sheetRow >= firstDataRow && !/계약일/.test(계약일)) {
        out.contracts.push({ rowKey: `r${sheetRow}`, payload: rowObj(r, 2), row: sheetRow });
      }
    });
    break; // 첫 존재 탭만
  }
  // 03 DB관리 — 현행 4섹션 병렬 우선, 없으면 5기 legacy(DB관리, 번호 없음) 폴백.
  if (titles.has("03 DB관리") || titles.size === 0) {
    const SEC = [
      ["매입DB", "B", "H"], ["직접생산", "I", "O"], ["현수막", "P", "V"], ["콜지기소", "X", "AD"],
    ];
    for (const [name, c1, c2] of SEC) {
      const rows = await grid(sid, `'03 DB관리'!${c1}4:${c2}100`);
      rows.forEach((r, i) => {
        if (String(r[0] ?? "").trim() !== "") {
          const startIdx = c1.length === 1 ? c1.charCodeAt(0) - 65 : 26 + c1.charCodeAt(1) - 65;
          out.db.push({ rowKey: `${name}:r${i + 4}`, payload: rowObj(r, startIdx), row: i + 4 });
        }
      });
    }
  } else if (titles.has("DB관리")) {
    // 5기 legacy — 현행과 배치가 다르다(census §2): 매입DB·직접생산 은 같은 행 범위에서
    // 나란히(컬럼만 다름), 현수막·지인기고객소개 는 그 아래로 쌓인다. 섹션마다 "합계" 행에서
    // 종료(수기 시트라 실사용 행수가 학생마다 다름 — 고정 행수 가정 대신 라벨 감지).
    for (const { name, c1, c2, rowStart, rowMax } of LEGACY_DB_SECTIONS) {
      const rows = await grid(sid, `'DB관리'!${c1}${rowStart}:${c2}${rowMax}`);
      const startIdx = c1.length === 1 ? c1.charCodeAt(0) - 65 : 26 + c1.charCodeAt(1) - 65;
      // "합계" 행에서 멈춘다(break) — 빈 슬롯은 건너뛴다(continue). forEach 로는 break 를
      // 못 걸어 합계 뒤 잔여 행까지 잘못 집계되는 사고가 났었다(census dry-run 실측으로 발견).
      for (let i = 0; i < rows.length; i++) {
        const first = rows[i][0];
        if (isLegacyDbSectionTotalRow(first)) break;
        if (String(first ?? "").trim() === "") continue;
        out.db.push({
          rowKey: `${name}:r${rowStart + i}`, payload: rowObj(rows[i], startIdx), row: rowStart + i,
        });
      }
    }
  }
  // 01 영업관리 — 현행(O1 앵커 + E~H) 우선, 없으면 5기 legacy(영업관리, 번호 없음) 폴백.
  // (날짜,채널) 자연키. 좌표: row = 10 + (주-1)*34 + 일*4 + 채널idx — 두 세대 공통(census §2 실측).
  const CH = ["매입DB", "직접생산", "현수막", "콜·지·기·소"];
  if (titles.has("01 영업관리") || titles.size === 0) {
    const o1 = (await grid(sid, "'01 영업관리'!O1"))[0]?.[0];
    const startISO = serialToISO(o1);
    if (!startISO) console.warn(`    ⚠ O1(수강시작일) 파싱 실패 — sales 스킵 (raw=${typeof o1})`);
    if (startISO) {
      const start = new Date(startISO + "T00:00:00Z");
      const block = await grid(sid, "'01 영업관리'!E10:H349"); // 10주 × 34 stride
      for (let w = 1; w <= 10; w++) {
        for (let d = 0; d < 7; d++) {
          for (let c = 0; c < 4; c++) {
            const sheetRow = 10 + (w - 1) * 34 + d * 4 + c;
            const r = block[sheetRow - 10] ?? [];
            const [E, F, G, H] = [r[0], r[1], r[2], r[3]].map((v) => String(v ?? "").trim());
            if (E === "" && F === "" && G === "" && H === "") continue;
            const date = new Date(start.getTime() + ((w - 1) * 7 + d) * 86400000)
              .toISOString().slice(0, 10);
            out.sales.push({
              rowKey: `${date}:${CH[c]}`,
              payload: {
                _backfill: true, date, channel: CH[c],
                ...(E !== "" ? { production: Number(E) || E } : {}),
                ...(F !== "" ? { inflow: Number(F) || F } : {}),
                ...(G !== "" ? { contactProgress: Number(G) || G } : {}),
                ...(H !== "" ? { meetingReservation: Number(H) || H } : {}),
              },
              row: sheetRow,
            });
          }
        }
      }
    }
  } else if (titles.has("영업관리")) {
    // 5기 legacy — O1 앵커 없음(census §2). 요일 블록(4행=1일, 채널은 행 포지션으로 결정 —
    // 현행과 동일 규칙) 첫 행의 C열에서 날짜를 직접 읽는다(계산이 아니라 실측이라 더 견고함).
    // 4번째 채널 라벨은 5기 원문("지-기-소", "콜" 없음)을 그대로 보존한다 — 없는 데이터를
    // 지어내지 않는다(belie/반장 결정 대기, adapter 문서 §5). E~H 지표 컬럼 의미는 현행과
    // 동일(census 로 헤더 텍스트까지 확인: 생산건수▶·유입건수▶·컨택진행수▶·컨택성공건수▶).
    const block = await grid(sid, "'영업관리'!C10:H400"); // 넉넉히(최대 ~11주), 빈 구간은 skip
    for (let w = 1; w <= 12; w++) {
      for (let d = 0; d < 7; d++) {
        const dateRow = block[legacySalesBlockRow(w, d, 0) - 10];
        if (!dateRow) continue;
        const iso = serialToISO(dateRow[0]); // C열
        if (!iso) continue;
        for (let c = 0; c < 4; c++) {
          const sheetRow = legacySalesBlockRow(w, d, c);
          const r = block[sheetRow - 10] ?? [];
          const actualLabel = String(r[1] ?? "").trim(); // D열 — 포지션 채널과 교차검증
          if (actualLabel) {
            legacySalesChannelChecked++;
            if (actualLabel !== LEGACY_SALES_CHANNELS[c]) legacySalesChannelMismatch++;
          }
          const [E, F, G, H] = [r[2], r[3], r[4], r[5]].map((v) => String(v ?? "").trim());
          if (E === "" && F === "" && G === "" && H === "") continue;
          out.sales.push({
            rowKey: `${iso}:${LEGACY_SALES_CHANNELS[c]}`,
            payload: {
              _backfill: true, date: iso, channel: LEGACY_SALES_CHANNELS[c],
              ...(E !== "" ? { production: Number(E) || E } : {}),
              ...(F !== "" ? { inflow: Number(F) || F } : {}),
              ...(G !== "" ? { contactProgress: Number(G) || G } : {}),
              ...(H !== "" ? { meetingReservation: Number(H) || H } : {}),
            },
            row: sheetRow,
          });
        }
      }
    }
  }
  // 06 업체정보 — C=계약ref
  for (const [i, r] of (await grid(sid, "'06 업체정보'!A2:AB")).entries()) {
    const ref = String(r[2] ?? "").trim();
    if (ref) out.company_archive.push({ rowKey: ref, payload: rowObj(r), row: i + 2 });
  }
  return out;
}

async function main() {
  // 레지스트리에서 대상 사용자(시트 보유) 목록
  const reg = await grid(REGISTRY_ID, "'users'!A2:R");
  const all = reg.map((r) => ({
    email: String(r[0] ?? "").trim().toLowerCase(),
    cohort: String(r[1] ?? "").trim(),
    sid: String(r[3] ?? "").trim(),
    role: String(r[4] ?? "").trim() || "trainee",
  }));
  const notStaff = (u) => u.role !== "trainer" && u.role !== "admin";
  const users = SHEET
    ? // 명시 타겟: 그 시트 행만(레지스트리 cohort 무관 — 아직 빈 B 라도 선백필 가능).
      //   DB 에 스탬프할 cohort 는 --cohort 인자(파일럿 라벨)로 강제.
      all
        .filter((u) => u.sid === SHEET && notStaff(u))
        .map((u) => ({ ...u, cohort: COHORTS[0] ?? u.cohort }))
    : all.filter(
        (u) => u.sid && COHORTS.includes(u.cohort.replace(/기\s*$/, "")) && notStaff(u),
      );
  if (SHEET && users.length === 0) {
    console.error(`backfill: --sheet ${SHEET} 에 해당하는 registry trainee 행이 없습니다.`);
    process.exit(1);
  }
  // 같은 시트 중복 행 제거(부부 멀티계정 — 시트 1개당 1회)
  const seen = new Set();
  const targets = users.filter((u) => !seen.has(u.sid) && seen.add(u.sid));
  const scope = SHEET ? `시트 ${SHEET} (라벨 ${COHORT} 로 스탬프)` : `기수 ${COHORT}`;
  console.log(`backfill: ${scope} — 대상 시트 ${targets.length}개 (mode=${EXECUTE ? "EXECUTE" : "DRY-RUN"})`);

  const pool = EXECUTE
    ? new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false }, max: 3 })
    : null;
  const TABS = ["meetings", "contracts", "todos", "sales", "db", "company_archive"];
  const totals = Object.fromEntries(TABS.map((t) => [t, 0]));
  let upserted = 0;

  for (const u of targets) {
    const rows = await extractUserRows(u.sid);
    const line = TABS.map((t) => `${t}:${rows[t].length}`).join(" ");
    console.log(`  ${u.email} → ${line}`);
    for (const t of TABS) {
      totals[t] += rows[t].length;
      if (!EXECUTE) continue;
      for (const item of rows[t]) {
        await pool.query(
          `insert into sheet_rows (cohort, email, spreadsheet_id, tab, row_key, payload, updated_at)
           values ($1,$2,$3,$4,$5,$6::jsonb, now())
           on conflict (spreadsheet_id, tab, row_key)
           do update set cohort=$1, email=$2,
             payload = sheet_rows.payload || excluded.payload, updated_at = now()`,
          [u.cohort, u.email, u.sid, t, item.rowKey, JSON.stringify(item.payload)],
        );
        upserted++;
      }
    }
  }

  console.log("\n── 결과 표 (기수·탭별 시트 유효 행수) ──");
  console.log("tab | sheet_rows(시트 추출)");
  for (const t of TABS) console.log(`${t} | ${totals[t]}`);
  console.log(`탭 없음(영구·무해 추정) ${gridMissingTab}건 · 진짜 읽기실패(재시도 후에도) ${gridReadFailures}건`);
  if (gridReadFailures > 0) console.log("⚠️ 읽기실패가 남아있음 — 위 시트 유효행수가 과소집계됐을 수 있음(재실행 권장)");
  if (legacySalesChannelChecked > 0) {
    // BBE-67 5기 legacy sales 채널 포지션 표본검증(반장 lease §4-A) — 전수 대조.
    console.log(
      `5기 legacy sales 채널 포지션 검증: ${legacySalesChannelChecked}건 확인 · 불일치 ${legacySalesChannelMismatch}건` +
        (legacySalesChannelMismatch > 0 ? " ⚠️ 포지션 규칙 재검토 필요" : " ✅"),
    );
  }

  if (EXECUTE && pool) {
    console.log(`\nDB upsert 완료: ${upserted}건`);
    // 대조는 대상 사용자들의 실제 cohort 라벨 전체 기준(콤마 목록·기 접미 변형 포괄).
    const cohortLabels = [...new Set(targets.map((u) => u.cohort))];
    const res = await pool.query(
      `select cohort, tab, count(*)::int n from sheet_rows
       where cohort = any($1) and coalesce((payload->>'_cleared')::boolean,false)=false
       group by cohort, tab order by cohort, tab`,
      [cohortLabels.length ? cohortLabels : COHORTS],
    );
    console.log("── 대조 표 (DB 기준) ──");
    console.log("cohort | tab | db행수");
    for (const r of res.rows) console.log(`${r.cohort} | ${r.tab} | ${r.n}`);
    await pool.end();
  } else {
    console.log("\nDRY-RUN — DB 미기록. 실행하려면 --execute.");
  }
}

if (isMainModule) {
  main().catch((e) => {
    const msg = (e instanceof Error ? e.message : String(e)).replace(/postgres(ql)?:\/\/\S+/gi, "[DATABASE_URL]");
    console.error("backfill 실패:", msg);
    process.exit(1);
  });
}

// BBE-67 census/dry-run 검증 스크립트가 실제 추출 로직을 직접 호출할 수 있도록 export.
// CLI 동작(위 isMainModule 분기)에는 영향 없음 — 순수 함수 참조 노출뿐.
export { extractUserRows };
