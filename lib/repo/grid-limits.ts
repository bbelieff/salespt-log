/**
 * Layer: repo — Sheets "Range exceeds grid limits" 400 판별 (순수, import 0).
 *
 * 읽기 경로는 grid 를 넓히지 않는다(2026-07-12 카나리아 실측 — 읽기에 쓰기 작업을 붙이지
 * 않는다, gcal-event-ids.ts). 대신 이 오류를 받으면 좁은 범위로 재시도하거나 빈 값으로 본다.
 * sheets-client 는 테스트에서 통째로 목킹되므로 이 판별기는 별도 파일로 둔다.
 */
export function isGridLimitsError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const err = e as { code?: number; status?: number; message?: string };
  const is400 = err.code === 400 || err.status === 400;
  return is400 && /exceeds grid limits/i.test(String(err.message ?? ""));
}
