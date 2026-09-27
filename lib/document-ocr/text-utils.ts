/**
 * document-ocr/text-utils — OCR 텍스트 정리·라벨 찾기·날짜 변환(모든 문서 파서 공용).
 * 라벨 탐색 방식 출처: MoaWork app/src/lib/document-ocr/parse-certificate.ts (origin/main).
 */

function fullWidthToHalf(raw: string): string {
  return raw.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30));
}

/** 전각 숫자·여러 대시·전각 기호를 반각으로. */
export function normalizeOcrText(raw: string): string {
  return fullWidthToHalf(raw || "")
    .replace(/[‐‑‒–—―─ㅡ]/g, "-")
    .replace(/：/g, ":")
    .replace(/．/g, ".")
    .replace(/\u00a0/g, " ");
}

/** 공백을 모두 뺀 텍스트 — "사 업 자 등 록 증" 같은 자간 노이즈에 둔감한 키워드 검사용. */
export function compactText(raw: string): string {
  return normalizeOcrText(raw).replace(/\s+/g, "");
}

/** "사업자등록번호" → /사\s*업\s*자\s*…/ — 글자 사이 공백을 허용하는 라벨식. */
export function labelPattern(label: string): RegExp {
  const chars = [...label.replace(/\s+/g, "")].map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(chars.join("\\s*"));
}

const LEAD_SEP = /^[\s:\-·•|/()［\[\]"'“”]+/;
const TRAIL_SEP = /[\s:\-·•|/()］\[\]"'“”]+$/;

export function stripSep(raw: string): string {
  return raw.replace(LEAD_SEP, "").replace(TRAIL_SEP, "").trim();
}

export function toLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export type LineHit = { line: string; index: number };

export function findLabelLines(lines: string[], labels: string[]): LineHit[] {
  const patterns = labels.map(labelPattern);
  const hits: LineHit[] = [];
  lines.forEach((line, index) => {
    if (patterns.some((re) => re.test(line))) hits.push({ line, index });
  });
  return hits;
}

/**
 * 라벨 뒤 값 — 같은 줄에 있으면 그 값(다음 라벨 앞까지), 없으면 다음 비어 있지 않은 줄.
 * stopWords = 같은 줄에 이어 나오는 다른 라벨(예: "업태 제조 종목 필름" 의 "종목").
 */
export function valueAfter(
  lines: string[],
  hit: LineHit,
  labels: string[],
  stopWords: readonly string[],
): { value: string; multiline: boolean } {
  let rest = hit.line;
  for (const label of labels) {
    const m = rest.match(labelPattern(label));
    if (m && m.index !== undefined) {
      rest = rest.slice(m.index + m[0].length);
      break;
    }
  }
  let cut = rest;
  for (const w of stopWords) {
    const m = cut.match(labelPattern(w));
    if (m && m.index !== undefined && m.index > 0) cut = cut.slice(0, m.index);
  }
  const same = stripSep(cut);
  if (same) return { value: same, multiline: false };
  for (let i = hit.index + 1; i < Math.min(hit.index + 3, lines.length); i += 1) {
    const next = stripSep(lines[i]!);
    if (next) return { value: next, multiline: true };
  }
  return { value: "", multiline: false };
}

/** "2020년 1월 2일" / "2020-01-02" / "2020.01.02" / "20200102" → { y, m, d } (없으면 null). */
export function parseDateParts(raw: string): { y: number; m: number; d: number } | null {
  const t = normalizeOcrText(raw).replace(/\s+/g, "");
  const m =
    t.match(/(\d{4})년(\d{1,2})월(\d{1,2})일/) ||
    t.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/) ||
    t.match(/(?<!\d)((?:19|20)\d{2})(\d{2})(\d{2})(?!\d)/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

/** 업체정보 날짜 칸 형식 "YY.MM.DD" (예: 개업일 "25.01.24"). */
export function toYyMmDd(raw: string): string | null {
  const p = parseDateParts(raw);
  if (!p) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(p.y % 100)}.${pad(p.m)}.${pad(p.d)}`;
}

/** 13자리 등록번호 꼴(주민등록번호·외국인등록번호·법인등록번호). 파서는 원문에서 이것을 지운 뒤 읽는다. */
export const THIRTEEN_DIGIT_ID = /(?<!\d)\d{6}\s*-?\s*[\d*]{7}(?!\d)/g;

const CORP_NO = /(?<!\d)(\d{6})\s*-?\s*(\d{7})(?!\d)/;
/** 법인등록번호가 아닌 다른 번호 라벨(다음 줄 값을 빌려오면 안 되는 줄). */
const OTHER_ID_LABEL = /주\s*민|생\s*년\s*월\s*일|등\s*록\s*번\s*호|면\s*허|외\s*국\s*인/;

/**
 * 법인등록번호 라벨에 붙은 13자리 숫자(구분자 없음, 없으면 "").
 * 값은 라벨 같은 줄(다른 번호 라벨 앞까지)에서 찾고, 없을 때만 다음 줄을 본다 —
 * 단 다음 줄에 다른 번호 라벨(주민등록번호·생년월일 등)이 있으면 빌려오지 않는다.
 */
export function findCorpNo(text: string): string {
  const lines = toLines(normalizeOcrText(text));
  for (const hit of findLabelLines(lines, ["법인등록번호"])) {
    const lm = hit.line.match(labelPattern("법인등록번호"))!;
    let own = hit.line.slice((lm.index ?? 0) + lm[0].length);
    const other = own.search(OTHER_ID_LABEL);
    if (other >= 0) own = own.slice(0, other);
    let m = own.match(CORP_NO);
    const next = lines[hit.index + 1] ?? "";
    if (!m && !OTHER_ID_LABEL.test(next)) m = next.match(CORP_NO);
    if (m) return `${m[1]}${m[2]}`;
  }
  return "";
}

/** 숫자 n자리 — 숫자 사이 공백 1칸까지 허용(OCR 자간 노이즈 "8 0 0 1 0 1"). */
const spacedDigits = (n: number) => String.raw`\d(?:[ \t]?\d){${n - 1}}`;

/**
 * 운전면허번호: "11-12-345678-90" · "12-345678-90"(옛 양식) · 앞에 지역명("서울 12-345678-90").
 * 숫자 사이 공백 노이즈도 잡는다. 신분증 파서와 redactOcrText 가 같은 식을 쓴다.
 */
export const DRIVER_LICENSE_ID = new RegExp(
  String.raw`(?<!\d)(?:(?:${spacedDigits(2)}|[가-힣]{2})[ \t]*-?[ \t]*)?${spacedDigits(2)}[ \t]*-[ \t]*${spacedDigits(6)}[ \t]*-[ \t]*${spacedDigits(2)}(?!\d)`,
  "g",
);

/** 대시형 주민등록번호(숫자 사이 공백 노이즈 포함) — 앞 6자리 + "-" + 뒷자리 5~7자(가림 "*" 포함). */
const SPACED_RRN = new RegExp(String.raw`(?<!\d)(${spacedDigits(6)})[ \t]*-[ \t]*[\d*](?:[ \t]*[\d*]){4,6}(?![\d*])`, "g");

/**
 * 화면 메모리에 두기 전 OCR 원문 가리기 — 13자리 등록번호는 법인등록번호(라벨에 붙은 값)만 남기고
 * 앞 6자리 + "-*******" 로, 운전면허번호는 통째로 가린다(주민등록번호 뒷자리가 state 에 남지 않게).
 * 숫자 사이에 공백이 낀 번호("800101 - 1 234 567")도 가린다.
 */
export function redactOcrText(raw: string): string {
  const text = normalizeOcrText(raw);
  const corp = findCorpNo(text);
  const mask = (m: string) => {
    const d = m.replace(/\D/g, "");
    return corp && d === corp ? m : `${d.slice(0, 6)}-*******`;
  };
  return text
    .replace(DRIVER_LICENSE_ID, "**-**-******-**")
    .replace(THIRTEEN_DIGIT_ID, mask)
    .replace(SPACED_RRN, mask);
}
