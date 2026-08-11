/**
 * registry-parity.mjs 의 순수 로직 분리본 — I/O 없음, import 시 부작용 없음.
 */
import { classifyDiff, looksLikeUnrenderedSerial, serialToISO } from "./parity-classify.mjs";

/**
 * 자연키로 시트 row·DB row 를 대조한다. 결과는 3종:
 *   missingInDb    — 시트엔 있는데 DB 에 없는 키(= "시차" — 백필 이후 신규 행 후보, 그대로 판정 확정)
 *   missingInSheet — DB 엔 있는데 시트에 없는 키(= 역방향, 대개 시트 삭제/개명 — 별도 보고만)
 *   fieldMismatches— 같은 키인데 특정 필드 값이 다름 — classifyDiff 로 렌더옵션/진짜불일치 판정
 *
 * @param {object[]} sheetRows @param {object[]} dbRows
 * @param {(row: object) => string} keyOf 자연키 추출
 * @param {string[]} fields 대조할 필드명 목록
 * @param {Record<string, (raw: string) => string>} [normalizers] 필드별 비교 전 정규화(앱이 그
 *   값을 실제로 읽는 방식 그대로 — BBE-143). 미지정 필드는 raw 문자열 그대로 비교.
 *   fieldMismatches 에는 원본(raw) 값을 그대로 남긴다 — 판정만 정규화 기준.
 */
export function diffByKey(sheetRows, dbRows, keyOf, fields, normalizers = {}) {
  const norm = (f, v) => (normalizers[f] ? normalizers[f](v) : v);
  const dbMap = new Map(dbRows.map((r) => [keyOf(r), r]));
  const missingInDb = [];
  const fieldMismatches = [];
  // 같은 자연키가 여러 행이면 **마지막(최신) 행을 대표로 쓴다** — BBE-143 실측(15scQKx.../
  // 1m_yc3... 두 spreadsheetId, 김덕호·박준용): 완전동일 중복(BBE-91)뿐 아니라 값이 다른
  // 중복(구 prep 행 + 완료 행)도 실재한다. `scripts/ops/backfill-registry.mjs:170`
  // (reportDuplicates)가 이미 "마지막 값으로 수렴" 이라 명시하고, 실제 적재도 시트 행 순서대로
  // upsert(on conflict do update)해 DB 는 항상 마지막 행 값을 갖는다 — 대조기가 첫 행을 대표로
  // 쓰면 DB 와 영원히 어긋난다. Map.set 은 같은 키 재설정 시 뒤 값으로 덮어써 이 순서를 그대로 재현.
  const bySheetKey = new Map();
  for (const sr of sheetRows) bySheetKey.set(keyOf(sr), sr);
  for (const [k, sr] of bySheetKey) {
    const dr = dbMap.get(k);
    if (!dr) { missingInDb.push(k); continue; }
    for (const f of fields) {
      const sv = sr[f] ?? "";
      const dv = dr[f] ?? "";
      if (norm(f, sv) !== norm(f, dv)) {
        fieldMismatches.push({ key: k, field: f, sheet: sv, db: dv });
      }
    }
  }
  const dbKeys = new Set(dbRows.map(keyOf));
  const missingInSheet = [...dbKeys].filter((k) => !bySheetKey.has(k));
  return {
    uniqueSheetKeys: bySheetKey.size,
    dbCount: dbRows.length,
    missingInDb,
    missingInSheet,
    fieldMismatches,
  };
}

/**
 * sort_order 정규화 — SSOT-COPY of `lib/repo/users.ts`(parseRow) 의 M 컬럼 처리(줄 51-58).
 * 앱은 raw 값을 int-parse 후 음수/NaN 은 0 으로, 소수는 floor 로 읽는다 — 대조기도 같은
 * 규칙으로 읽어야 "05" vs "5", "" vs "0" 같은 표현 차이를 진짜불일치로 오분류하지 않는다.
 * 원본이 바뀌면 이 사본도 같이 고칠 것(WEEK-INDEX-SSOT-COPY 선례와 동일 패턴).
 */
export function normalizeSortOrder(raw) {
  const s = String(raw ?? "").trim();
  if (s === "") return "0";
  const n = parseInt(s, 10);
  return String(Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0);
}

/**
 * cohorts.type 정규화 — SSOT-COPY of `lib/repo/cohorts.ts:106`
 * (`r[3] === "arena" ? "arena" : "cohort"`). "arena" 가 아닌 모든 값(빈값 포함)은
 * "cohort" 로 앱이 읽는다 — 대조기도 동일 규칙 적용.
 */
export function normalizeCohortType(raw) {
  return raw === "arena" ? "arena" : "cohort";
}

/**
 * fieldMismatches 각 항목을 분류한다 — registry 는 계산식이 없는(순수 값 대조) 도메인이라
 * "로직차이" 축은 적용 안 됨. 렌더옵션(날짜 필드 raw serial) 아니면 진짜불일치.
 */
export function classifyFieldMismatches(mismatches, label) {
  return mismatches.map((m) => {
    // 값 자체가 raw serial 이거나(#752 패턴), ISO 문자열 vs serial 이 같은 날을 가리키면 렌더옵션.
    const sheetIsSerial = looksLikeUnrenderedSerial(m.sheet);
    const dbIsSerial = looksLikeUnrenderedSerial(m.db);
    let type = "진짜불일치";
    let detail = "값이 다름 — 직접 조사 필요";
    if (sheetIsSerial || dbIsSerial) {
      const a = sheetIsSerial ? serialToISO(m.sheet) : String(m.sheet);
      const b = dbIsSerial ? serialToISO(m.db) : String(m.db);
      type = "렌더옵션";
      detail = a === b
        ? `시트/DB 값이 같은 날짜를 가리킴(${a}) — 표현 형식만 다름(dateTimeRenderOption)`
        : `날짜 렌더옵션 의심(raw serial 값 발견) — 변환 결과 시트=${a}, db=${b}`;
    }
    return { user: `${label}:${m.key}`, field: m.field, sheetValue: m.sheet, dbValue: m.db, type, detail };
  });
}

/** missingInDb 키 목록 → classifyDiff 결과 형태(존재 자체가 없으므로 판정은 항상 "시차" 확정). */
export function missingInDbAsClassified(keys, label) {
  return keys.map((k) => ({
    user: `${label}:${k}`, field: "(행 자체)", sheetValue: "존재", dbValue: "없음",
    type: "시차", detail: "시트엔 이 자연키 행이 있는데 DB 에 없음 — 백필 이후 신규 행 또는 백필 갭 후보",
  }));
}

// classifyDiff 를 직접 쓰는 소비자를 위해 재노출(레지스트리는 현재 fieldMismatches 전용 분류만
// 쓰지만, 후속에 로직차이형 필드가 생기면 이 경로를 바로 확장할 수 있게 열어둔다).
export { classifyDiff };
