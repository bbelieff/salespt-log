/**
 * 8기 등 지정 기수 시트 전체 → Supabase sheet_rows 1회 적재 (db-migration-pilot §1 P1).
 *
 * 실행 위치: **VPS** (.env/.env.local 에 SA·SHEETS_REGISTRY_ID·DATABASE_URL 보유)
 *   — GitHub Actions "DB Backfill" 워크플로가 SSH 로 실행. 기본 dry-run.
 *   node scripts/ops/backfill-sheet-rows.mjs --cohort 8 [--execute]
 *   node scripts/ops/backfill-sheet-rows.mjs --cohort 연습 --sheet <시트ID> [--execute]
 *     ↑ **파일럿 편입 전 선백필** — registry B(cohort)가 빈 계정은 --cohort 로 못 찾으므로
 *       시트를 명시해 먼저 DB 를 채우고, 그 다음 B 를 쓴다(순서 반대면 게이트가 DB 로 붙어 빈 화면).
 *   node scripts/ops/backfill-sheet-rows.mjs --cohort 5 --legacy-year 2026 [--execute]
 *     ↑ **5기 등 무번호 legacy 탭**(BBE-67) — 아래 "Legacy 5기 어댑터" 절 참고.
 *
 * row_key 규칙 — lib/repo/db/mirror.ts 의 dual-write 와 **반드시 동일**:
 *   meetings=A열 id · todos=A열 id · contracts=r{행} · db={섹션}:r{행} ·
 *   sales={ISO날짜}:{채널} · company_archive=C열 계약ref.
 * payload = 열문자→값(비어있지 않은 셀만) + _backfill:true. 멱등: upsert(jsonb 병합).
 * ★URL·비밀번호·SA 키 로그 미출력.
 *
 * ── Legacy 5기 어댑터 (BBE-67, 2026-08-11) ──────────────────────────────
 * 5기 시트는 01~06 번호 탭이 아니라 무번호 구형 세대(영업관리·계약관리·DB관리)를 쓰고,
 * **구조 자체가 다르다**(고정좌표 재사용 금지 — Linear BBE-67 census 코멘트가 근거).
 * 확정 근거(Drive 읽기 도구 3표본 + G작업원D 의 masterbot grid sentinel read, PII 없음):
 *   · db(DB관리): 위치 고정(3표본 완전 일치) — parseLegacyDbManagement.
 *   · sales(영업관리): **소스마다 컬럼 세트가 다르다**(19열 vs 15열 표본 확인) → 고정 위치
 *     금지, 매 주차 헤더 행을 다시 읽어 이름으로 컬럼을 찾는다(parseLegacySalesRows).
 *     날짜는 O1 앵커+34행 stride 가 아니라 **행마다 직접 적힌 M/D 값**이고, 하루=정확히
 *     4행(매입DB→직접생산→현수막→지-기-소, 항상 존재)이며 날짜는 그 날의 매입DB 행에만
 *     있고 나머지 3행은 이어받는다. 연도 정보가 시트에 없어 `--legacy-year` 필수(없으면 에러
 *     — 추측 금지).
 *   · contracts(계약관리): row10=헤더·11=예시·12+=데이터(G작업원D 판정, 유일한 근거).
 *     컬럼 의미(C=계약일 등)는 "02 계약관리" alias 와 동일하다는 가정 — TAB_ALIASES 가 이미
 *     다루는 "이름만 바뀌고 컬럼은 같은" 패턴과 동일 계보로 판단(미검증, dry-run 행수 37 로
 *     사후 확인 필요).
 *   · meetings·todos·company_archive: 5기 시트에 **탭 자체가 없다**(3표본 확인) — 기존
 *     "탭 없음→0행" 처리가 이미 정답이라 코드 변경 없음.
 * DB payload 키는 항상 **모던 03 DB관리 컬럼 문자**(lib/config/index.ts SHEET_RANGES.
 * dbManagement.sections 와 동일, SSOT 갱신 시 이 파일도 같이 갱신)로 맞춘다 — legacy 자체
 * 컬럼 문자를 그대로 쓰면 앱 읽기 코드가 기대하는 자리와 안 맞는다. legacy 필드 중 모던에
 * 대응 없는 것(예: 매입DB·현수막의 "주문금액" — 모던은 개당단가×주문개수 계산값이라 미저장)
 * 은 추측해 끼워넣지 않고 버린다.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";
import { Pool } from "pg";

// Windows 에서 file:// URL 과 process.argv[1] 슬래시/인코딩 차이로 문자열 비교가 항상 거짓이
// 되는 함정을 피한 경로 비교(db-migrate.mjs·backfill-db-row-numbers.mjs 와 동일 패턴).
// BBE-67 순수 함수(parseLegacyDbManagement 등)를 tests/ops/ 에서 import 할 때 아래 CLI
// 인자검증·process.exit·main() 이 같이 실행되지 않도록 이 가드로 격리한다.
const isMainModule =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

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
/** legacy(무번호) sales 탭은 시트에 연도가 없다(M/D 만) — 추측 금지, 명시 인자 필수.
 * 값이 있어야만 legacy sales 파싱을 시도한다(없으면 sales 는 조용히 스킵, 에러 아님 —
 * legacy 탭이 아예 없는 일반 기수 실행에서 이 인자가 없어도 기존 동작 불변). */
const LEGACY_YEAR = (() => {
  const i = process.argv.indexOf("--legacy-year");
  if (i < 0) return null;
  const n = Number(process.argv[i + 1]);
  if (!Number.isInteger(n) || n < 2020 || n > 2100) {
    console.error(`backfill: --legacy-year 값이 이상함(${process.argv[i + 1]}) — 4자리 연도(예: 2026)`);
    process.exit(1);
  }
  return n;
})();
// R2-1.5(아레나): 콤마 목록 허용 — 예: --cohort "A1-0,A1-1,A1-2" (단일 라벨 동작 불변).
const COHORTS = COHORT.split(",").map((s) => s.trim().replace(/기\s*$/, "")).filter(Boolean);
// CLI 인자검증 — isMainModule 가드(직접 실행될 때만). tests/ops/ 의 import 는 여기서
// process.exit 되면 안 되므로(순수 함수만 쓴다) 실행 시에만 검사한다.
if (isMainModule && !COHORT) {
  console.error(
    "사용법: node backfill-sheet-rows.mjs --cohort <기수라벨> [--sheet <시트ID>] [--legacy-year <YYYY>] [--execute]\n" +
      "  --sheet 지정 시: 그 시트만 백필(레지스트리 cohort 무관). --cohort 는 DB 에 스탬프할 라벨.\n" +
      "  --legacy-year: 5기 등 무번호 legacy 탭(영업관리) 대상일 때 필수 — 시트에 연도가 없어 직접 지정.",
  );
  process.exit(1);
}

const REGISTRY_ID = env("SHEETS_REGISTRY_ID");
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const SA_KEY = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
const DB_URL = env("DATABASE_URL");
if (isMainModule && (!REGISTRY_ID || !SA_EMAIL || !SA_KEY)) {
  console.error("backfill: SA/레지스트리 env 누락"); process.exit(1);
}
if (isMainModule && EXECUTE && !DB_URL) {
  console.error("backfill: --execute 인데 DATABASE_URL 없음"); process.exit(1);
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

// ══════════════════════════════════════════════════════════════════════
// Legacy 5기 어댑터 — 순수 함수(테스트 대상, tests/ops/backfill-legacy-adapter.test.ts)
// ══════════════════════════════════════════════════════════════════════

/**
 * legacy DB관리 → 모던 03 DB관리 컬럼 문자로 재매핑. **위치 고정**(census 3표본 완전 일치).
 * SSOT: lib/config/index.ts SHEET_RANGES.dbManagement.sections — 이 맵이 그 코드와
 * 어긋나면(모던 컬럼 스키마 변경) 이 배열도 같이 갱신해야 한다.
 *
 * 섹션별 legacy 필드 순서 → 모던 컬럼 문자. `null` = 모던에 대응 없어 버리는 필드
 * (예: "주문금액" — 모던은 개당단가×주문개수 계산값이라 미저장, 값 자체를 없는 필드에
 * 끼워넣지 않는다). "부가세여부"(모던 전용, legacy 에 없음)는 항상 공란.
 */
const LEGACY_DB_SECTIONS = [
  {
    name: "매입DB",
    legacyFields: ["구매일", "업체명", "개당단가", "주문개수", null /* 주문금액 */, "기타"],
    modernCols: ["B", "C", "D", "E", null /* F=부가세여부, legacy 소스 없음 */, "G"],
    legacyColOffset: 0, // 헤더행에서 "구매일" 이 있는 열(A=0)부터
  },
  {
    name: "직접생산",
    // legacy: 날짜,소재,기간예산,생산개수,개당단가(대응 없음),기타 — modern: 시작일,종료일,소재,
    // 기간예산,생산개수,부가세여부,기타. legacy 단일 "날짜" → 시작일(종료일은 정보 없음, 공란).
    legacyFields: ["시작일" /* legacy "날짜" */, "소재", "기간예산", "생산개수", null /* 개당단가 */, "기타"],
    modernCols: ["I", "K", "L", "M", null, "O"], // J(종료일) 대응 없음 — 공란 유지
    legacyColOffset: 6, // 매입DB(6열) 다음부터
  },
  {
    name: "현수막",
    legacyFields: ["날짜", "업체명", "도착일", "개당단가", "주문개수", null /* 주문금액 */, "기타"],
    modernCols: ["P", "Q", "R", "S", "T", null /* U=부가세여부, legacy 소스 없음 */, "V"],
    legacyColOffset: null, // 별도 섹션 블록(아래 헤더 탐색으로 처리)
  },
  {
    name: "콜지기소",
    // legacy "지인,기고객,소개" 섹션 — 필드 7개가 모던 콜·지·기·소와 완전 일치.
    legacyFields: ["구분", "접수일", "대표자명", "업체명", "소개처", "연락처", "조건"],
    modernCols: ["X", "Y", "Z", "AA", "AB", "AC", "AD"],
    legacyColOffset: null,
  },
];

/** rows(2차원 배열, 시트 그대로) 안에서 첫 셀이 target 과 정확히 일치하는 행 index. 없으면 -1. */
function findRowByFirstCell(rows, target) {
  return rows.findIndex((r) => String(r?.[0] ?? "").trim() === target);
}

/** legacyFields/modernCols 매핑으로 한 행을 모던 컬럼-문자 payload 로 변환.
 * null 필드는 건너뜀(모던에 대응 없음 — 값이 있어도 버림, 잘못된 자리에 끼워넣지 않음). */
function remapLegacyDbRow(cells, spec) {
  const payload = { _backfill: true };
  spec.legacyFields.forEach((_field, i) => {
    const modernCol = spec.modernCols[i];
    if (!modernCol) return; // 대응 없음 — 버림
    const v = String(cells[i] ?? "").trim();
    if (v !== "") payload[modernCol] = v;
  });
  return payload;
}

/**
 * legacy DB관리 파싱 — 위치 고정(매입DB+직접생산 나란히 12열 → 합계 → 현수막(7열) → 합계
 * → 지인/기고객/소개(7열) → 합계). rows = grid(sid, "'DB관리'!A1:L200") 같은 넓은 범위
 * (합계 행까지 전부 포함하도록 여유 있게). rowKey = `{modern섹션명}:r{절대행1-based}`
 * (기존 03 DB관리 row_key 규칙과 동일 포맷 — dual-write 와 정합).
 */
export function parseLegacyDbManagement(rows) {
  const out = [];
  // ① 매입DB + 직접생산 — 같은 헤더행("구매일"이 A열), 같은 데이터 행에 나란히.
  const buyHeaderIdx = findRowByFirstCell(rows, "구매일");
  if (buyHeaderIdx >= 0) {
    for (let i = buyHeaderIdx + 1; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const buyDate = String(r[0] ?? "").trim();
      if (!buyDate || /^합계$|^평균단가/.test(buyDate)) break;
      const buyCells = r.slice(0, 6);
      if (String(buyCells[0] ?? "").trim() !== "") {
        out.push({
          rowKey: `매입DB:r${i + 1}`,
          payload: remapLegacyDbRow(buyCells, LEGACY_DB_SECTIONS[0]),
          row: i + 1,
        });
      }
      const prodCells = r.slice(6, 12);
      if (String(prodCells[0] ?? "").trim() !== "") {
        out.push({
          rowKey: `직접생산:r${i + 1}`,
          payload: remapLegacyDbRow(prodCells, LEGACY_DB_SECTIONS[1]),
          row: i + 1,
        });
      }
    }
  }
  // ② 현수막 — 독립 헤더행("날짜"가 A열, 매입DB 헤더 이후에 다시 등장).
  const bannerHeaderIdx = rows.findIndex(
    (r, i) => i > buyHeaderIdx && String(r?.[0] ?? "").trim() === "날짜",
  );
  if (bannerHeaderIdx >= 0) {
    for (let i = bannerHeaderIdx + 1; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const date = String(r[0] ?? "").trim();
      if (!date || /^합계$|^평균단가/.test(date)) break;
      out.push({
        rowKey: `현수막:r${i + 1}`,
        payload: remapLegacyDbRow(r.slice(0, 7), LEGACY_DB_SECTIONS[2]),
        row: i + 1,
      });
    }
  }
  // ③ 지인/기고객/소개 — 독립 헤더행("구분"이 A열).
  const referralHeaderIdx = findRowByFirstCell(rows, "구분");
  if (referralHeaderIdx >= 0) {
    for (let i = referralHeaderIdx + 1; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const kind = String(r[0] ?? "").trim();
      if (!kind || /^합계$/.test(kind)) break;
      if (!/^(지인|기고객|소개)$/.test(kind)) continue; // 분류행만(빈 템플릿 잔재 skip)
      out.push({
        rowKey: `콜지기소:r${i + 1}`,
        payload: remapLegacyDbRow(r.slice(0, 7), LEGACY_DB_SECTIONS[3]),
        row: i + 1,
      });
    }
  }
  return out;
}

/** legacy sales 헤더 행(2번째 서브헤더, "생산건 수 ▶" 등)에서 컬럼 이름 → index 맵.
 * 화살표(▶)·트림 차이를 흡수하려 prefix 매칭. census 3표본에서 이 4개 필드는 위치가 아니라
 * **이름**으로 찾아야 안전함이 확인됨(소스마다 뒤쪽 컬럼 구성이 다름 — 승인/수납 유무 등). */
function buildLegacySalesColumnMap(headerRow) {
  const map = {};
  headerRow.forEach((cell, i) => {
    const s = String(cell ?? "").trim();
    if (s) map[s.replace(/\s*▶$/, "")] = i;
  });
  const findIdx = (...names) => {
    for (const n of names) if (map[n] !== undefined) return map[n];
    return -1;
  };
  return {
    date: 1, // "날짜" 컬럼 — 위치 고정(요일 다음, 3표본 공통)
    channel: 2, // "채널" 컬럼 — 위치 고정
    production: findIdx("생산건 수", "생산건수"),
    inflow: findIdx("유입건 수", "유입건수"),
    contactProgress: findIdx("컨택진행 수", "컨택진행수"),
    // "컨택 성공건 수"(구) / "미팅 예약건 수"(신) — 모던 SHEET_RANGES.sales.metricCols.H 와
    // 동일한 개명 이력(주석 "구 컨택성공"). 표본에 따라 둘 중 하나만 존재.
    meetingReservation: findIdx("컨택 성공건 수", "컨택성공건수", "미팅 예약건 수", "미팅예약건수"),
  };
}

/** 모던 채널 라벨(mirror.ts CH 배열)과 매칭 — "지-기-소"(legacy, 콜 없는 3분류로 보임)를
 * "콜·지·기·소"(모던)로 정규화. 다른 3채널은 표기 동일. */
const LEGACY_CHANNEL_TO_MODERN = {
  매입DB: "매입DB", 직접생산: "직접생산", 현수막: "현수막", "지-기-소": "콜·지·기·소",
};

/**
 * legacy 영업관리 파싱 — 순차 스캔(고정좌표 없음). O1 앵커+34행 stride 를 쓰지 않는다
 * (census: 소스마다 컬럼 구성이 다르고, 주당 정확히 28행=7일×4채널이라 34-stride 와 다름).
 * 날짜는 각 날의 매입DB 행에만 적혀 있고 나머지 3채널 행은 공란 — 이어받는다(carry-forward).
 * rows = grid(sid, "'영업관리'!A1:S500") 처럼 전 시트를 넓게(19열까지) 읽은 결과.
 * year 없이는 M/D 에 연도를 못 붙이므로 호출부가 보장(LEGACY_YEAR 없으면 아예 호출 안 함).
 */
export function parseLegacySalesRows(rows, year) {
  const out = [];
  let colMap = null;
  let carryDate = null; // 이 날의 매입DB 행에서 읽은 M/D → carry
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const c0 = String(r[0] ?? "").trim();
    const c1 = String(r[1] ?? "").trim();
    // 주차 헤더행("요일" / "날짜"로 시작) → 그 다음 행이 서브헤더(실제 컬럼명).
    if (c0 === "요일" && c1 === "날짜") {
      colMap = buildLegacySalesColumnMap(rows[i + 1] ?? []);
      i += 1; // 서브헤더 행은 데이터가 아니므로 건너뜀
      carryDate = null;
      continue;
    }
    if (!colMap) continue; // 아직 헤더를 못 만남(예: 요약행 구간) — 스킵
    const channelRaw = String(r[colMap.channel] ?? "").trim();
    const modernChannel = LEGACY_CHANNEL_TO_MODERN[channelRaw];
    if (!modernChannel) {
      // "주차별합계" 등 주차 종료 마커 — 다음 주차 헤더를 다시 기다린다.
      if (/^주차별합계|^주간/.test(c0)) colMap = null;
      continue;
    }
    const dateCell = String(r[colMap.date] ?? "").trim();
    if (channelRaw === "매입DB") carryDate = dateCell || carryDate;
    const md = carryDate;
    if (!md) continue; // 이 채널행보다 먼저 매입DB 행에서 날짜를 못 얻음 — 스킵(안전)
    const m = md.match(/^(\d{1,2})\/(\d{1,2})/);
    if (!m) continue;
    const mm = String(m[1]).padStart(2, "0");
    const dd = String(m[2]).padStart(2, "0");
    const date = `${year}-${mm}-${dd}`;
    const payload = { _backfill: true, date, channel: modernChannel };
    const pick = (key, field) => {
      const idx = colMap[key];
      if (idx == null || idx < 0) return;
      const v = String(r[idx] ?? "").trim();
      if (v !== "") payload[field] = Number(v) || v;
    };
    pick("production", "production");
    pick("inflow", "inflow");
    pick("contactProgress", "contactProgress");
    pick("meetingReservation", "meetingReservation");
    // 4개 지표가 전부 없으면(빈 채널 행) 적재 안 함 — 현행 sales 스킵 규칙과 동일.
    if (
      payload.production === undefined && payload.inflow === undefined &&
      payload.contactProgress === undefined && payload.meetingReservation === undefined
    ) continue;
    out.push({ rowKey: `${date}:${modernChannel}`, payload, row: i + 1 });
  }
  return out;
}

/** 한 사용자 시트 → {tab → [{rowKey, payload}]} (dual-write 와 동일 키 규칙). */
async function extractUserRows(sid) {
  const out = { meetings: [], contracts: [], todos: [], sales: [], db: [], company_archive: [] };

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
  // 02 계약수납 — 행 고정 키 r{행}. 신형(계약수납관리) 우선, 구형(계약관리) 폴백.
  // 시작행 = 앱 레이아웃(lib/repo/contract-payment.ts TAB_ALIASES)과 동일: 신형 6 / 구형 5.
  // 과거 `>= 3` 이 헤더·예시 구간(r3 "수납총액" 안내행, r5 "00유통" 템플릿 예시행)을
  // 유령 계약으로 적재한 사고 수정(2026-07-12, 전 기수 94행 — repair 스크립트로 정리).
  for (const [tabName, firstDataRow] of [
    ["02 계약수납관리", 6],
    ["02 계약관리", 5],
    ["계약관리", 12], // 5기 등 legacy(무번호) — G작업원D census 판정(row10=헤더·11=예시·12+=데이터)
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
  // 03 DB관리 — 4섹션, {섹션}:r{행}, 행 4~100, 첫 컬럼 비면 제외
  const SEC = [
    ["매입DB", "B", "H"], ["직접생산", "I", "O"], ["현수막", "P", "V"], ["콜지기소", "X", "AD"],
  ];
  let dbFound = false;
  for (const [name, c1, c2] of SEC) {
    const rows = await grid(sid, `'03 DB관리'!${c1}4:${c2}100`);
    if (rows.length > 0) dbFound = true;
    rows.forEach((r, i) => {
      if (String(r[0] ?? "").trim() !== "") {
        const startIdx = c1.length === 1 ? c1.charCodeAt(0) - 65 : 26 + c1.charCodeAt(1) - 65;
        out.db.push({ rowKey: `${name}:r${i + 4}`, payload: rowObj(r, startIdx), row: i + 4 });
      }
    });
  }
  // 5기 등 legacy(무번호 "DB관리") 폴백 — 모던 "03 DB관리" 탭이 아예 없을 때만.
  if (!dbFound) {
    const legacyRows = await grid(sid, "'DB관리'!A1:L200");
    if (legacyRows.length > 0) out.db.push(...parseLegacyDbManagement(legacyRows));
  }
  // 01 영업관리 E~H — (날짜,채널) 자연키. 좌표: row = 10 + (주-1)*34 + 일*4 + 채널idx.
  const CH = ["매입DB", "직접생산", "현수막", "콜·지·기·소"];
  const o1Rows = await grid(sid, "'01 영업관리'!O1");
  if (o1Rows.length === 0) {
    // 모던 "01 영업관리" 탭 자체가 없음 — 5기 등 legacy(무번호 "영업관리") 폴백.
    if (LEGACY_YEAR) {
      const legacySalesRows = await grid(sid, "'영업관리'!A1:S500");
      if (legacySalesRows.length > 0) {
        out.sales.push(...parseLegacySalesRows(legacySalesRows, LEGACY_YEAR));
      }
    } else {
      console.warn("    ⚠ '01 영업관리' 탭 없음 — legacy 폴백 하려면 --legacy-year 필요(생략됨, sales 스킵)");
    }
  }
  const o1 = o1Rows[0]?.[0];
  const startISO = serialToISO(o1);
  if (o1Rows.length > 0 && !startISO) {
    console.warn(`    ⚠ O1(수강시작일) 파싱 실패 — sales 스킵 (raw=${typeof o1})`);
  }
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
