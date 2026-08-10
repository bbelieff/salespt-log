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
 */
export function diffByKey(sheetRows, dbRows, keyOf, fields) {
  const dbMap = new Map(dbRows.map((r) => [keyOf(r), r]));
  const missingInDb = [];
  const fieldMismatches = [];
  const seen = new Set();
  for (const sr of sheetRows) {
    const k = keyOf(sr);
    if (seen.has(k)) continue; // 완전동일 중복 행은 대조 대상에서 1건으로 축약(BBE-91 실측: 2건 존재)
    seen.add(k);
    const dr = dbMap.get(k);
    if (!dr) { missingInDb.push(k); continue; }
    for (const f of fields) {
      if ((sr[f] ?? "") !== (dr[f] ?? "")) {
        fieldMismatches.push({ key: k, field: f, sheet: sr[f] ?? "", db: dr[f] ?? "" });
      }
    }
  }
  const dbKeys = new Set(dbRows.map(keyOf));
  const missingInSheet = [...dbKeys].filter((k) => !seen.has(k));
  return { uniqueSheetKeys: seen.size, dbCount: dbRows.length, missingInDb, missingInSheet, fieldMismatches };
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
