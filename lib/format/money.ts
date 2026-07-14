/**
 * 금액 포맷 — **순수 함수**(의존성 0). 앱 전체 금액 표시·입력의 단일 원천.
 *
 * ⚠️ **절대 제약**: 시트/DB 로 나가는 금액은 **항상 number**. 콤마 문자열("1,000,000")이
 * repo 층에 닿으면 시트가 텍스트로 먹어 **수식이 깨진다**(쓰기는 전 경로 USER_ENTERED).
 * 현재 유일한 방벽은 Zod `z.number()` — 금액 스키마에 **`z.coerce.number()` 도입 금지**.
 * → 입력 컴포넌트(MoneyInput)는 `onChange: (n: number) => void` 로 number 방출을 타입 강제한다.
 *
 * ⚠️ **parseInt 금지**: `parseInt("1,000,000", 10) === 1` 로 **조용히 절단**된다(NaN 이 아니라
 * 유한수라 가드도 통과 → 시트에 1원 저장). 반드시 숫자만 strip 후 `Number()`.
 *
 * 스코프 밖(이 유틸로 치환 금지):
 *  - 건수·점수 등 **카운트**(type=number 스테퍼) — 콤마 넣으면 브라우저가 값을 거부해 0 이 된다.
 *  - **만원 축약**(`원/10_000 + "만"`) — 별개 개념.
 *  - 서술형 자유텍스트 매출·신용점수(z.string) — 원문이 깨진다.
 */

/** 표시용 — 천단위 콤마(ko-KR). null/undefined/NaN → "0". 정수 반올림. 음수 허용(차감 표시). */
export function formatMoney(n: number | null | undefined): string {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? v.toLocaleString("ko-KR") : "0";
}

/**
 * 입력창 표시용 — 0·빈값은 **빈 문자열**(placeholder 가 보이도록).
 * 표시용 formatMoney 와 0 시맨틱이 다르다(기존 fmtComma 계열 동작 승계).
 */
export function formatMoneyInput(n: number | null | undefined): string {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v) || v === 0) return "";
  return v.toLocaleString("ko-KR");
}

/**
 * 입력 문자열 → 저장용 number. 숫자 외 문자 제거 후 `Number()`(parseInt 금지 — 위 주석).
 * 빈값·무효 → 0. 음수 부호는 취급하지 않는다(금액 스키마가 nonnegative).
 */
export function parseMoney(s: string | number | null | undefined): number {
  if (typeof s === "number") return Number.isFinite(s) ? Math.round(s) : 0;
  const digits = String(s ?? "").replace(/[^\d]/g, "");
  if (digits === "") return 0;
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}
