/**
 * live-format — 입력하는 **동시에** 모양을 잡는 순수 도구(import 없음, belie 2026-09-29).
 *  - groupTyping: 숫자 칸 천 단위 쉼표("1234567" → "1,234,567"), 소수·앞 "-" 유지.
 *  - bizNoTyping: 사업자등록번호 "0000000000" → "000-00-00000".
 * 둘 다 커서 위치를 "숫자 몇 개 뒤였나" 로 옮겨 계산해 돌려준다 — 모양이 바뀌어도 커서가 튀지 않게.
 * 쉼표·대시 하나만 지운 경우(Backspace 로 구분자를 지움)는 그 앞 숫자를 지운 것으로 본다 — 안 그러면
 * 다시 구분자가 생겨 지우기가 안 먹는다.
 * 숫자 칸이 아닌 글(옛 자유 글 "3,200만" 등)은 null — 호출부가 손대지 않는다.
 */

export type LiveResult = { value: string; caret: number };

const isSep = (ch: string) => ch === "," || ch === "-" || ch === " ";

/** 구분자(쉼표·대시·공백)를 뺀 글자 수 — 커서 앞 "진짜 글자" 개수. */
function tokensBefore(s: string, end: number): number {
  let n = 0;
  for (let i = 0; i < Math.min(end, s.length); i += 1) if (!isSep(s[i]!)) n += 1;
  return n;
}

/** 모양 잡은 값에서 진짜 글자 n 개 뒤의 커서 자리. */
function caretAfterTokens(s: string, n: number): number {
  if (n <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < s.length; i += 1) {
    if (!isSep(s[i]!)) seen += 1;
    if (seen === n) return i + 1;
  }
  return s.length;
}

/** 구분자만 하나 지웠다면(글자 수 그대로, 길이 1 줄음) 커서 앞 진짜 글자 하나를 지운다. */
function undoSeparatorDelete(raw: string, caret: number, prev: string, strip: (s: string) => string): { raw: string; caret: number } {
  if (raw.length === prev.length - 1 && strip(raw) === strip(prev) && caret > 0) {
    let i = caret - 1;
    while (i >= 0 && isSep(raw[i]!)) i -= 1;
    if (i >= 0) return { raw: raw.slice(0, i) + raw.slice(i + 1), caret: i };
  }
  return { raw, caret };
}

/**
 * 천 단위 쉼표. signed = 앞 "-" 허용(손익 칸). 숫자·쉼표·점·빼기 외 글자가 있으면 null(옛 자유 글).
 * 소수점 뒤는 그대로 둔다(자릿수 제한은 호출부 sanitize 가 한다).
 */
export function groupTyping(raw: string, caret: number, prev = "", signed = false): LiveResult | null {
  if (!/^[\s\d,.\-−]*$/.test(raw)) return null;
  const strip = (s: string) => s.replace(/[,\s]/g, "");
  ({ raw, caret } = undoSeparatorDelete(raw.replace(/−/g, "-"), caret, prev, strip));
  // 숫자 칸에서 구분자는 쉼표·공백뿐("-" 는 부호라 진짜 글자).
  const isGroupSep = (ch: string) => ch === "," || /\s/.test(ch);
  let before = 0;
  for (let i = 0; i < Math.min(caret, raw.length); i += 1) if (!isGroupSep(raw[i]!)) before += 1;
  let s = strip(raw);
  const neg = signed && s.startsWith("-");
  if (!neg && s.startsWith("-") && before > 0) before -= 1; // 버려지는 "-" 는 세지 않는다
  s = s.replace(/-/g, "");
  const dot = s.indexOf(".");
  const int = dot >= 0 ? s.slice(0, dot) : s;
  const dec = dot >= 0 ? s.slice(dot) : "";
  const value = `${neg ? "-" : ""}${int.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${dec}`;
  let pos = 0;
  for (let i = 0, seen = 0; i < value.length && seen < before; i += 1) {
    if (value[i] !== ",") seen += 1;
    pos = i + 1;
  }
  return { value, caret: pos };
}

/** 사업자등록번호 000-00-00000. 숫자·대시·공백 외 글자가 있으면 null. 숫자는 10자리까지. */
export function bizNoTyping(raw: string, caret: number, prev = ""): LiveResult | null {
  if (!/^[\d\-\s]*$/.test(raw)) return null;
  const strip = (s: string) => s.replace(/\D/g, "");
  ({ raw, caret } = undoSeparatorDelete(raw, caret, prev, strip));
  const before = Math.min(10, tokensBefore(raw, caret));
  const d = strip(raw).slice(0, 10);
  const value = d.length <= 3 ? d : d.length <= 5 ? `${d.slice(0, 3)}-${d.slice(3)}` : `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
  return { value, caret: caretAfterTokens(value, before) };
}
