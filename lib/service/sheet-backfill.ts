/**
 * Layer: service — DB-read union fallback 헬퍼 (R3 §7-3 L4 종결).
 *
 * 문제: append/add 신규행은 R2 fire-and-forget 미러라, 미러 3회 실패 시 DB에 행이
 * 아예 안 생긴다(mirror_pending 은 이미 존재하는 행에만 표식 → 이 경로 못 잡음).
 * 파일럿 DB-read 화면에서 방금 만든 계약·DB행·발굴이 조용히 사라진다(L4 갭).
 *
 * 해결: read 시 DB 결과에 없는 시트 행만 보충(union). 조인 키 = 시트 행번호 `row`
 * (DB read·시트 read 양쪽이 동일 값 방출). DB 우선(정본), 시트는 gap-filler.
 * 미러 실패 원인이 DB blip 이라 append durable redrive(옵션2)는 무력 — 시트 보충만 견고.
 */

/**
 * DB read 결과에 없는 시트 행만 보충해 합친다(row 오름차순).
 *
 * @param dbRows   DB 정본 목록(미러 성공분).
 * @param sheetRows 시트 전체 목록(미러 실패 신규행 포함).
 * @param rowOf    각 행의 시트 행번호 추출. undefined 면 식별 불가 → 항상 보충(안전).
 * @param extraKeyOf 행 시프트(drift)에도 안정적인 2차 키(예: 계약 linkedMeetingId).
 *   같은 키가 이미 DB 에 있으면 다른 row 로 온 시트 행을 중복 추가하지 않는다. 없으면 생략.
 * @returns 보충 없으면 dbRows 원본(흔한 경로·정렬 유지), 있으면 병합 후 row 오름차순.
 */
export function backfillMissingRows<T>(
  dbRows: readonly T[],
  sheetRows: readonly T[],
  rowOf: (r: T) => number | undefined,
  extraKeyOf?: (r: T) => string | undefined,
): T[] {
  const seenRows = new Set<number>();
  const seenKeys = new Set<string>();
  for (const r of dbRows) {
    const n = rowOf(r);
    if (n != null) seenRows.add(n);
    const k = extraKeyOf?.(r);
    if (k) seenKeys.add(k);
  }

  const missing = sheetRows.filter((r) => {
    const n = rowOf(r);
    if (n != null && seenRows.has(n)) return false; // 같은 행번호 = 이미 DB 정본에 있음
    const k = extraKeyOf?.(r);
    if (k && seenKeys.has(k)) return false; // drift: 다른 행번호지만 같은 계약(2차 키 중복)
    return true;
  });

  if (missing.length === 0) return dbRows as T[]; // 흔한 경로: 보충 없음 → DB 그대로
  return [...dbRows, ...missing].sort((a, b) => (rowOf(a) ?? 0) - (rowOf(b) ?? 0));
}
