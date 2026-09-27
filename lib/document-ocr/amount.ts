/**
 * document-ocr/amount — 문서 파서 공용 금액 표기(업체정보 칸에 들어가는 한 가지 모양).
 *
 * - formatManwon: 새 금액 칸(재무 금액·임차보증금·임차월세·반기별매출·면세수입금액) 공용.
 *   만 원 단위로 반올림하고 쉼표를 찍는다. 1억 이상은 억을 앞에 둔다.
 *     32,000,000 → "3,200만" · -32,000,000 → "-3,200만" · 120,000,000 → "1.2억"
 *     125,000,000 → "1억 2,500만" · 300,000,000 → "3억" · 5,000 → "5,000원" · 0 → "0원"
 *   억 아래가 천만 단위로 딱 떨어지면 "1.2억" 처럼 짧게, 아니면 만 단위까지 그대로("1억 2,500만") —
 *   반올림으로 금액이 바뀌지 않게 한다.
 * - formatBaekman: 기존 매출 칸(과년도매출·금년도매출) 표기 "250백만".
 */

/** 정수 부분에 천 단위 쉼표(부호 유지). */
export function groupThousands(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}${String(Math.trunc(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

export type ManwonOptions = { sep?: boolean };

/** 원 → "3,200만" / "1.2억" / "1억 2,500만". sep=false 면 쉼표 없이("1000만" — 소유여부 문구용). */
export function formatManwon(won: number, { sep = true }: ManwonOptions = {}): string {
  if (!Number.isFinite(won) || won === 0) return "0원";
  const sign = won < 0 ? "-" : "";
  const abs = Math.abs(won);
  const f = (n: number) => (sep ? groupThousands(n) : String(Math.trunc(n)));
  if (abs < 1e4) return `${sign}${f(Math.round(abs))}원`;
  const man = Math.round(abs / 1e4);
  if (man < 1e4) return `${sign}${f(man)}만`;
  const eok = Math.floor(man / 1e4);
  const rest = man % 1e4;
  if (rest === 0) return `${sign}${f(eok)}억`;
  if (rest % 1000 === 0) return `${sign}${f(eok)}.${rest / 1000}억`;
  return `${sign}${f(eok)}억 ${f(rest)}만`;
}

/** 원 → "250백만"(백만 원 반올림). 0 아닌 1백만 미만은 소수 한 자리("0.3백만"). */
export function formatBaekman(won: number): string {
  const m = won / 1e6;
  if (won !== 0 && Math.abs(m) < 1) return `${Math.round(m * 10) / 10}백만`;
  return `${groupThousands(Math.round(m))}백만`;
}
