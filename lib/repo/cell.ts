/**
 * Layer: repo — 시트 셀 tolerant 변환 (I/O 없음).
 *
 * `numCell`: 셀 → 0 이상 정수. 오류셀("#VALUE!"/"#REF!"/"#DIV/0!"/"#N/A")·빈값·
 * NaN·음수 → 0. 한 셀 오류가 행(또는 그 주) 전체 read 를 무너뜨리지 않게 격리
 * (sheet-value-error 2026-06-18: 강셀 Number()=NaN → z.number().int() 거부 →
 *  행 통째 드롭 → 생산까지 유실되던 사고 차단).
 */
export function numCell(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
}
