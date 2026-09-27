/**
 * document-ocr/parse-id-card — 신분증(주민등록증·자동차운전면허증) OCR 텍스트 → 업체정보 칸 제안.
 *
 * 채우는 칸: 대표자이름 · 대표자생년월일(YY.MM.DD) · 주민등록번호("NNNNNN-" 앞자리만) · 자택주소지.
 *
 * 개인정보 규칙(belie 결정 2026-09-28):
 * - 주민등록번호 **뒷자리 7자리**와 **운전면허번호**는 어떤 제안값·경고·참고정보에도 싣지 않는다.
 *   파서는 맨 처음에 앞 6자리와 7번째 자리(세기 판정용, 반환하지 않음)만 꺼내고,
 *   원문에서 번호 전체를 지운 텍스트로 나머지를 읽는다.
 * - 주민등록번호 값은 normalizeRrnFront 를 거쳐 "NNNNNN-" 로만 낸다.
 *
 * 세기 판정(7번째 자리): 1·2·5·6 → 19xx, 3·4·7·8 → 20xx, 9·0 → 18xx.
 * 7번째 자리를 못 읽으면(가림 "*" 등) YY 가 올해 YY 보다 크면 19xx, 아니면 20xx 로 보고 경고한다.
 */
import { normalizeRrnFront } from "@/util/rrn-front";
import { DRIVER_LICENSE_ID, THIRTEEN_DIGIT_ID, compactText, normalizeOcrText, toLines } from "./text-utils";
import type { DocParseResult, ParsedField } from "./types";

/** 숫자 n자리 — 숫자 사이 공백 1칸까지 허용(OCR 자간 노이즈). */
const digits = (n: number) => `\\d(?:[ \\t]?\\d){${n - 1}}`;
/** 가림 표시로 쓰이는 글자(OCR 이 * 을 다르게 읽는 경우 포함). */
const MASK = "[\\d*xX※●•]";

/** 운전면허번호 — redactOcrText 와 같은 식(text-utils DRIVER_LICENSE_ID). */
const DRIVER_LICENSE_RE = DRIVER_LICENSE_ID;
/** 면허번호·식별번호·일련번호 라벨 뒤 같은 줄 값(형식이 달라도 통째로 지운다). */
const LICENSE_LABEL_TAIL = /(면\s*허\s*번\s*호|식\s*별\s*번\s*호|일\s*련\s*번\s*호|암\s*호\s*일\s*련)[^\n]*/g;
/**
 * 대시형 주민등록번호: 앞 6자리 + "-" + 뒷자리(0~7자, 가림 포함). 그룹1=앞, 그룹2=7번째.
 * 뒷자리 사이 공백은 같은 줄 안이면 몇 칸이든 뒷자리로 본다("1  234 567" 도 통째로 지운다).
 */
const RRN_DASHED_RE = new RegExp(
  `(?<!\\d)(${digits(6)})[ \\t]*[-~][ \\t]*(${MASK})?(?:[ \\t]*${MASK}){0,6}`,
  "g",
);
/** 대시 없는 13자리(가림 포함). */
const RRN_PLAIN_RE = /(?<!\d)(\d{6})([\d*])[\d*]{6}(?![\d*])/g;

type RrnFound = { front: string; seventh: string | null; lineIndex: number };

/** 원문에서 번호를 모두 지운다 — 운전면허번호·면허/식별 라벨 값·주민등록번호(전체)·13자리 번호. */
export function stripSensitiveNumbers(text: string): string {
  return text
    .replace(LICENSE_LABEL_TAIL, " ")
    .replace(DRIVER_LICENSE_RE, " ")
    .replace(RRN_PLAIN_RE, " ")
    .replace(RRN_DASHED_RE, " ")
    .replace(THIRTEEN_DIGIT_ID, " ");
}

/** 면허번호를 먼저 지운 줄들에서 첫 주민등록번호 꼴을 찾는다(앞 6자리 + 7번째 자리만 보관). */
function findRrn(lines: string[]): RrnFound | null {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    const plain = new RegExp(RRN_PLAIN_RE.source).exec(line);
    if (plain) return { front: plain[1]!, seventh: /\d/.test(plain[2]!) ? plain[2]! : null, lineIndex: i };
    const dashed = new RegExp(RRN_DASHED_RE.source).exec(line);
    if (dashed) {
      const s = dashed[2] ?? "";
      return { front: dashed[1]!.replace(/\s+/g, ""), seventh: /\d/.test(s) ? s : null, lineIndex: i };
    }
  }
  return null;
}

/** 7번째 자리 → 세기(1800/1900/2000). 모르면 null. */
export function centuryFromSeventh(seventh: string | null): number | null {
  if (seventh === null) return null;
  if ("1256".includes(seventh)) return 1900;
  if ("3478".includes(seventh)) return 2000;
  if ("90".includes(seventh)) return 1800;
  return null;
}

function isRealDate(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const TITLE_WORDS = ["주민등록증", "자동차운전면허증", "운전면허증", "driver", "license", "licence"];
/** 이름·주소가 아닌 줄(발급기관·기간·면허종류 등). */
const NOT_NAME = /(주민등록|운전면허|면허증|\d종|보통|대형|소형|특수|원동기|청장|경찰|시장|군수|구청|적성|갱신|기간|조건|발급|성명|주소)/;
const ADDRESS_STOP =
  /((?:19|20)\d{2}\s*[.년/]\s*\d{1,2}|적\s*성|갱\s*신|기\s*간|조\s*건|청\s*장|경\s*찰|시\s*장$|군\s*수|구\s*청\s*장|발\s*급|교\s*부|암\s*호|식\s*별)/;
const ADDRESS_START = /(특별시|광역시|특별자치|[가-힣]+도(\s|$)|[가-힣]+시(\s|$)|[가-힣]+군(\s|$)|[가-힣]+구(\s|$)|[가-힣0-9]+(로|길)\s*\d)/;

/** "홍 길 동 (洪吉童)" → "홍길동". 한글 2~5자가 아니면 "". */
function cleanName(raw: string): string {
  const noParen = raw.replace(/[(（][^)）]*[)）]?/g, " ").replace(/[^가-힣\s]/g, " ");
  const joined = noParen.trim().split(/\s+/).every((t) => t.length === 1) ? noParen.replace(/\s+/g, "") : noParen.trim();
  const m = joined.match(/^[가-힣]{2,5}/);
  return m ? m[0] : "";
}

function isTitle(line: string): boolean {
  const c = compactText(line).toLowerCase();
  return TITLE_WORDS.some((w) => c.includes(w));
}

function findName(lines: string[], rrnLine: number | null): { value: string; confidence: number } | null {
  // ① "성명" 라벨
  for (const line of lines) {
    const m = line.match(/성\s*명\s*[:：]?\s*(.+)$/);
    if (m) {
      const v = cleanName(m[1]!);
      if (v) return { value: v, confidence: 0.85 };
    }
  }
  // ② 주민등록번호 줄 바로 위(신분증 공통 배치) — 위로 3줄까지
  if (rrnLine !== null) {
    for (let i = rrnLine - 1; i >= Math.max(0, rrnLine - 3); i -= 1) {
      const line = lines[i]!;
      if (isTitle(line) || NOT_NAME.test(compactText(line))) continue;
      const v = cleanName(line);
      if (v) return { value: v, confidence: 0.75 };
    }
  }
  // ③ 제목 다음 줄
  const t = lines.findIndex(isTitle);
  for (let i = t + 1; t >= 0 && i < Math.min(t + 4, lines.length); i += 1) {
    const line = lines[i]!;
    if (isTitle(line) || NOT_NAME.test(compactText(line))) continue;
    const v = cleanName(line);
    if (v) return { value: v, confidence: 0.55 };
  }
  return null;
}

/** 주소 줄 앞뒤 구분자만 걷는다 — 괄호(예: "(예시동)")는 주소의 일부라 남긴다. */
const trimAddr = (l: string) => l.replace(/^[\s:\-·•|]+/, "").replace(/[\s:\-·•|]+$/, "");

function findAddress(lines: string[], rrnLine: number | null): { value: string; lines: number } | null {
  let start = -1;
  const labelIdx = lines.findIndex((l) => /^주\s*소/.test(l));
  if (labelIdx >= 0) {
    const rest = trimAddr(lines[labelIdx]!.replace(/^주\s*소/, ""));
    if (rest) {
      const next = lines[labelIdx + 1];
      const tail = next && !ADDRESS_STOP.test(next) && !ADDRESS_START.test(next) ? ` ${trimAddr(next)}` : "";
      return { value: `${rest}${tail}`.trim(), lines: tail ? 2 : 1 };
    }
    start = labelIdx + 1;
  } else {
    const from = rrnLine !== null ? rrnLine : 0;
    for (let i = from; i < lines.length; i += 1) {
      if (ADDRESS_START.test(lines[i]!) && !ADDRESS_STOP.test(lines[i]!) && !isTitle(lines[i]!)) {
        start = i;
        break;
      }
    }
  }
  if (start < 0 || start >= lines.length) return null;
  const parts: string[] = [];
  for (let i = start; i < Math.min(start + 2, lines.length); i += 1) {
    const line = trimAddr(lines[i]!);
    if (!line || ADDRESS_STOP.test(line) || isTitle(line)) break;
    parts.push(line);
  }
  if (parts.length === 0) return null;
  return { value: parts.join(" "), lines: parts.length };
}

export type IdCardParseOptions = { now?: Date };

export function parseIdCard(rawText: string, options: IdCardParseOptions = {}): DocParseResult {
  const normalized = normalizeOcrText(rawText);
  const fields: ParsedField[] = [];
  const documentWarnings: string[] = [];
  if (!normalized.trim()) {
    return { fields, documentWarnings: ["읽힌 글자가 없어요. 더 선명한 사진으로 다시 해 보세요."] };
  }

  // ① 운전면허번호·면허/식별 라벨 값을 먼저 지운다(면허번호 끝 "345678-90" 을 주민번호로 오인 방지).
  const noLicense = normalized.replace(LICENSE_LABEL_TAIL, " ").replace(DRIVER_LICENSE_RE, " ");
  // ② 주민등록번호: 앞 6자리 + 7번째 자리만 꺼낸다(줄 번호는 이름·주소 앵커).
  const rrn = findRrn(noLicense.split(/\r?\n/).map((l) => l.trim()));
  // ③ 나머지는 번호를 전부 지운 텍스트로 읽는다. 빈 줄 제거 전 줄 번호로 앵커를 맞춘다.
  const rawLines = stripSensitiveNumbers(noLicense).split(/\r?\n/).map((l) => l.trim());
  const lines = toLines(rawLines.join("\n"));
  /** 번호 줄 바로 다음(지운 뒤 기준) 줄의 위치 — 이름은 그 위, 주소는 여기부터. */
  let rrnLine: number | null = null;
  if (rrn) {
    // 지운 뒤 빈 줄이 된 번호 줄의 위치 = 그 앞까지 살아남은 줄 수.
    const kept = rawLines.slice(0, rrn.lineIndex).filter((l) => l.length > 0).length;
    rrnLine = kept;
    // 번호 줄에 이름이 같이 있으면(한 줄 OCR) 그 줄은 이름 후보로도 쓴다.
    if ((rawLines[rrn.lineIndex] ?? "").length > 0) rrnLine = kept + 1;
  }

  const name = findName(lines, rrnLine);
  if (name) fields.push({ key: "대표자이름", value: name.value, confidence: name.confidence, warnings: [] });

  if (rrn) {
    const yy = Number(rrn.front.slice(0, 2));
    const mm = Number(rrn.front.slice(2, 4));
    const dd = Number(rrn.front.slice(4, 6));
    const warnings: string[] = [];
    let century = centuryFromSeventh(rrn.seventh);
    if (century === null) {
      const nowYy = (options.now ?? new Date()).getFullYear() % 100;
      century = yy > nowYy ? 1900 : 2000;
      // 팝업은 가린 원문(앞6-*******)으로 읽으므로 7번째 자리는 늘 안 보인다 — 세기는 추정이다.
      warnings.push(
        `주민등록번호 뒷자리는 읽지 않아 ${century === 1900 ? "1900" : "2000"}년대생으로 봤어요. 생년월일이 맞는지 확인해 주세요.`,
      );
    }
    const ok = isRealDate(century + yy, mm, dd);
    const front = normalizeRrnFront(rrn.front);
    fields.push({
      key: "주민등록번호",
      value: front,
      confidence: ok ? 0.85 : 0.3,
      warnings: ok ? [] : ["앞 6자리가 날짜가 아니에요. 숫자를 직접 확인해 주세요."],
      valid: ok,
    });
    if (ok) {
      fields.push({
        key: "대표자생년월일",
        value: `${rrn.front.slice(0, 2)}.${rrn.front.slice(2, 4)}.${rrn.front.slice(4, 6)}`,
        confidence: warnings.length > 0 ? 0.6 : 0.85,
        warnings,
      });
    }
  } else {
    documentWarnings.push("주민등록번호 앞자리를 찾지 못했어요. 생년월일은 직접 적어 주세요.");
  }

  const addr = findAddress(lines, rrnLine);
  if (addr) {
    const value = addr.value.replace(/\d{7,}/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
    if (value) {
      fields.push({
        key: "자택주소지",
        value,
        confidence: addr.lines > 1 ? 0.65 : 0.7,
        warnings: addr.lines > 1 ? ["두 줄에 걸친 주소를 이어 붙였어요. 확인해 주세요."] : [],
      });
    }
  }

  if (fields.length === 0) {
    documentWarnings.push("신분증 칸을 찾지 못했어요. 문서 종류가 맞는지 확인해 주세요.");
  }
  // 방어: 어떤 값에도 7자리 이상 숫자가 남지 않게(주민번호 뒷자리·면허번호 유출 차단).
  for (const f of fields) {
    if (f.key !== "주민등록번호") f.value = f.value.replace(/\d(?:[\s-]?\d){6,}/g, "").trim();
  }
  return { fields: fields.filter((f) => f.value), documentWarnings };
}
