/**
 * Layer: util (순수 — import 0). 한국어 조사 선택.
 *
 * 왜 필요한가: 화면 문구에 **변수로 들어오는 말**(채널명·목록명·지표명)을 끼우면
 * 조사가 틀어진다. 실제로 그랬다 — 「게시**을** 입력하세요」(→ 게시를),
 * 「영업기회**이** 추가됐어요」(→ 영업기회가). 사소해 보여도 읽는 사람은 바로 걸린다.
 *
 * 규칙: 마지막 글자의 **받침 유무**로 고른다. 한글 음절은 유니코드에서
 * `0xAC00 + (초성×21 + 중성)×28 + 종성` 이라, `(코드 − 0xAC00) % 28 === 0` 이면 받침이 없다.
 *
 * 한글이 아닌 글자로 끝나면(숫자·영문·기호) **받침 있음 쪽**을 고른다 — 한국어 UI 에서
 * 흔한 보수적 기본값이고, 이 앱의 문구는 전부 한글 명사로 끝난다.
 */

/** 마지막 글자에 받침이 있나. 한글이 아니면 true(보수적). */
export function hasFinalConsonant(word: string): boolean {
  const last = word.trim().slice(-1);
  if (!last) return true;
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return true; // 한글 음절 밖
  return (code - 0xac00) % 28 !== 0;
}

/** 목적격 — 받침 있으면 "을", 없으면 "를". 예: 유입을 / 게시를 */
export function eulReul(word: string): string {
  return hasFinalConsonant(word) ? "을" : "를";
}

/** 주격 — 받침 있으면 "이", 없으면 "가". 예: 구매목록이 / 영업기회가 */
export function iGa(word: string): string {
  return hasFinalConsonant(word) ? "이" : "가";
}

/** 보조사 — 받침 있으면 "은", 없으면 "는". 예: 생산목록은 / 영업기회는 */
export function eunNeun(word: string): string {
  return hasFinalConsonant(word) ? "은" : "는";
}
