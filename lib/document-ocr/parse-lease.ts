/**
 * document-ocr/parse-lease — 부동산 임대차(월세·전세) 계약서 OCR 텍스트 → 업체정보 칸 제안.
 *
 * 채우는 칸(company-info-restructure 2026-09-28 — 편집기 선택형 칸 모양): 소재지(임차 부동산) ·
 *   임차보증금·임차월세 = 원 단위 숫자("10,000,000" — 편집기 칸 옆 "원") ·
 *   임차면적 = ㎡ 숫자만("33" — 평만 있으면 ×3.3058 환산, 소수 한 자리) · 소유여부 = "임차".
 *   ㎡·평 병기("33㎡(10평)")는 저장하지 않는 참고 정보(info)로만 보여 준다.
 * 읽지 않는 것(belie 결정): 계약기간 · 임대인 · 용도.
 *
 * 금액은 "금 일천만원정", "金 10,000,000원", "₩10,000,000", "1억 2천만원" 모두 읽는다.
 * 같은 칸에 서로 다른 금액 후보가 여러 개면 첫 값을 고르되 확신도를 낮추고 경고를 단다.
 *
 * 개인정보: 13자리 등록번호 꼴(임대인·임차인 주민등록번호)은 읽기 전에 원문에서 지운다.
 *
 * 금액 표기는 공용 ./amount groupThousands(원 단위 쉼표). 한글 금액 읽기(parseKoreanAmount)·
 * 면적(formatSqm·formatArea)은 이 문서에만 쓰여 여기 둔다.
 */
import {
  THIRTEEN_DIGIT_ID,
  compactText,
  findLabelLines,
  labelPattern,
  normalizeOcrText,
  toLines,
  valueAfter,
} from "./text-utils";
import { groupThousands } from "./amount";
import type { CompanyInfoKey, DocParseResult, ParsedField, ParsedInfo } from "./types";

// ─────────────────────────── 금액 ───────────────────────────

const DIGIT_WORD: Record<string, number> = {
  영: 0, 공: 0, 零: 0,
  일: 1, 一: 1, 壹: 1,
  이: 2, 二: 2, 貳: 2, 弐: 2,
  삼: 3, 三: 3, 參: 3, 参: 3,
  사: 4, 四: 4, 肆: 4,
  오: 5, 五: 5, 伍: 5,
  육: 6, 六: 6, 陸: 6,
  칠: 7, 七: 7, 柒: 7,
  팔: 8, 八: 8, 捌: 8,
  구: 9, 九: 9, 玖: 9,
};
const SMALL_UNIT: Record<string, number> = { 십: 10, 十: 10, 拾: 10, 백: 100, 百: 100, 佰: 100, 천: 1000, 千: 1000, 仟: 1000 };
const BIG_UNIT: Record<string, number> = { 만: 1e4, 萬: 1e4, 万: 1e4, 억: 1e8, 億: 1e8 };

/**
 * "일천만원정" · "金 10,000,000원" · "1억 2천만" · "5,000만" · "1.5억" → 원 단위 정수.
 * 숫자를 하나도 못 읽으면 null. 읽다가 말이 안 되는 글자가 나오면 거기서 멈추고 읽은 데까지 쓴다
 * (예: "500,000 이하" → 500000).
 */
export function parseKoreanAmount(raw: string): number | null {
  let s = normalizeOcrText(raw)
    .replace(/\s+/g, "")
    .replace(/^(?:금|金|₩|￦|\\)+/, "")
    .replace(/(?:원|圓|정|也)+$/, "");
  // 천 단위 구분자(쉼표·OCR 이 점으로 읽은 것) 제거. "1.5억" 같은 소수점은 남긴다.
  s = s.replace(/(\d)[,](?=\d{3}(?!\d))/g, "$1");
  if (/^\d{1,3}(?:\.\d{3})+(?!\d)/.test(s)) s = s.replace(/(\d)\.(?=\d{3}(?!\d))/g, "$1");
  const tokens = s.match(/\d+(?:\.\d+)?|[^\d]/g) ?? [];
  let total = 0;
  let section = 0;
  let num: number | null = null;
  let seen = false;
  for (const t of tokens) {
    if (/^\d/.test(t) || t in DIGIT_WORD) {
      if (num !== null) break; // 숫자 두 개가 단위 없이 붙음 → 여기까지
      num = /^\d/.test(t) ? Number(t) : DIGIT_WORD[t]!;
      seen = true;
    } else if (t in SMALL_UNIT) {
      section += (num ?? 1) * SMALL_UNIT[t]!;
      num = null;
      seen = true;
    } else if (t in BIG_UNIT) {
      section += num ?? 0;
      if (section === 0) {
        if (!seen) break; // 단위만 덩그러니("만료") — 금액 아님
        section = 1;
      }
      total += section * BIG_UNIT[t]!;
      section = 0;
      num = null;
    } else {
      break;
    }
  }
  total += section + (num ?? 0);
  if (!seen || !Number.isFinite(total) || total <= 0) return null;
  return Math.round(total);
}

const WORD_NUM = "일이삼사오육칠팔구십백천만억영공零一二三四五六七八九十百千萬万億壹貳弐參参肆伍陸柒捌玖拾佰仟";
/** 금액 한 덩어리: (금/金/₩)? + 숫자·수사 연속(사이 공백 허용) + (원)? */
const AMOUNT_RUN = new RegExp(
  `(금|金|₩|￦)?\\s*([0-9${WORD_NUM}][0-9,.\\s${WORD_NUM}]*?)\\s*(?:(원|圓)|(?=[^0-9,.\\s${WORD_NUM}]|$))`,
  "g",
);

type AmountCand = { won: number; form: "digit" | "word" };

/** 한 구간 안의 금액 후보. 숫자형은 접두(금·₩)·"원"·만/억 단위 중 하나, 한글·한자 수사는 접두나 "원"이 있어야 인정. */
export function findAmounts(segment: string): AmountCand[] {
  const out: AmountCand[] = [];
  for (const m of segment.matchAll(AMOUNT_RUN)) {
    const run = (m[2] ?? "").trim();
    if (!run) continue;
    const hasDigit = /\d/.test(run);
    const prefixed = Boolean(m[1]);
    const won = Boolean(m[3]);
    const unit = /\d\s*[,.\d\s]*[만억萬億]/.test(run);
    if (hasDigit ? !(prefixed || won || unit) : !(prefixed || won)) continue;
    const v = parseKoreanAmount(run);
    if (v === null || v < 1e4) continue; // 1만원 미만은 보증금·월세가 아니다
    out.push({ won: v, form: hasDigit ? "digit" : "word" });
  }
  return out;
}

// ─────────────────────────── 면적 ───────────────────────────

export const SQM_PER_PYEONG = 3.3058;
const trimNum = (n: number, digits: number) => String(Number(n.toFixed(digits)));

/** ㎡·평 중 있는 값으로 "33㎡(10평)" — 한쪽만 있으면 환산(㎡ 소수 2자리, 평 소수 1자리). */
export function formatArea(sqm: number | null, pyeong: number | null): string {
  const m = sqm ?? (pyeong !== null ? pyeong * SQM_PER_PYEONG : null);
  const p = pyeong ?? (sqm !== null ? sqm / SQM_PER_PYEONG : null);
  if (m === null || p === null) return "";
  return `${trimNum(m, 2)}㎡(${trimNum(p, 1)}평)`;
}

/** 면적 → 임차면적 칸 값: ㎡ 숫자만, 소수 한 자리("33" · "33.1"). 평만 있으면 ×3.3058. */
export function formatSqm(sqm: number | null, pyeong: number | null): string {
  const m = sqm ?? (pyeong !== null ? pyeong * SQM_PER_PYEONG : null);
  return m === null ? "" : trimNum(m, 1);
}

type Area = { sqm: number | null; pyeong: number | null };
const AREA_RE = /(\d+(?:[.,]\d{1,3})?)\s*(㎡|m²|m2|M2|제곱미터|평방미터|평(?![가-힣]))/g;

function toAreaNumber(raw: string): number {
  // "33,06" (쉼표 소수) vs "1,234" (천 단위)
  return /,\d{3}$/.test(raw) ? Number(raw.replace(",", "")) : Number(raw.replace(",", "."));
}

/** 구간 안의 면적 표기 — "33㎡(10평)" 처럼 바로 붙은 ㎡·평은 한 면적으로 묶는다. */
export function findAreas(segment: string): Area[] {
  const areas: Area[] = [];
  let prevEnd = -100;
  for (const m of segment.matchAll(AREA_RE)) {
    const n = toAreaNumber(m[1]!);
    if (!(n > 0)) continue;
    const isPy = m[2] === "평";
    const last = areas[areas.length - 1];
    const close = last && (m.index ?? 0) - prevEnd <= 3;
    if (close && isPy && last.pyeong === null) last.pyeong = n;
    else if (close && !isPy && last.sqm === null) last.sqm = n;
    else areas.push(isPy ? { sqm: null, pyeong: n } : { sqm: n, pyeong: null });
    prevEnd = (m.index ?? 0) + m[0].length;
  }
  return areas;
}

const areaSqm = (a: Area) => a.sqm ?? (a.pyeong ?? 0) * SQM_PER_PYEONG;

// ─────────────────────────── 부가세 ───────────────────────────

type Vat = "separate" | "ambiguous" | "none";
const CHECKED = "[■☑✔✓√☒▣▶●]|\\[[vV✓]\\]|\\([vV✓]\\)";

export function detectVat(text: string): Vat {
  const c = compactText(text);
  if (!/부가세|부가가치세|VAT/i.test(c)) return "none";
  if (new RegExp(`(?:${CHECKED})불포함`).test(c)) return "separate";
  if (new RegExp(`(?:${CHECKED})포함`).test(c)) return "none";
  if (/(부가세|부가가치세|VAT).{0,6}별도|별도.{0,3}(부가세|부가가치세|VAT)/i.test(c)) return "separate";
  if (/(부가세|부가가치세|VAT).{0,6}불포함/i.test(c)) {
    return /불포함.{0,3}포함|(?<!불)포함.{0,3}불포함/.test(c) ? "ambiguous" : "separate";
  }
  return "none";
}

// ─────────────────────────── 파서 ───────────────────────────

const MONEY_STOPS = ["보증금", "계약금", "중도금", "잔금", "차임", "월세", "관리비", "융자금", "부가세", "부가가치세"];
const ADDR_STOPS = ["토지", "지목", "면적", "건물", "구조", "용도", "임대할부분", "임대할 부분"];
const LEASED_PART = ["임대할부분", "임대부분", "임차할부분", "임차부분", "전용면적"];

/** 라벨 줄에서 라벨 뒤 ~ 다음 금액 라벨 앞까지. 라벨 줄에 금액이 없으면 다음 줄(다른 금액 라벨이 없을 때만). */
function labelSegments(lines: string[], labels: string[]): string[] {
  const own = labels.map(labelPattern);
  const stops = MONEY_STOPS.filter((w) => !labels.includes(w)).map(labelPattern);
  const cut = (s: string) => {
    let out = s;
    for (const re of stops) {
      const m = out.match(re);
      if (m && m.index !== undefined) out = out.slice(0, m.index);
    }
    return out;
  };
  const segs: string[] = [];
  for (const hit of findLabelLines(lines, labels)) {
    let rest = hit.line;
    for (const re of own) {
      const m = rest.match(re);
      if (m && m.index !== undefined) {
        rest = rest.slice(m.index + m[0].length);
        break;
      }
    }
    // "월 차임" 의 앞 "월"·라벨 직후 조사("은")는 금액 해석에 방해만 된다.
    rest = cut(rest.replace(/^\s*(?:은|는|:)\s*/, " "));
    // 라벨 뒤가 비어 있을 때만(표의 다음 칸) 다음 줄을 본다 — 본문 문장 줄에서 엉뚱한 금액을 빌려오지 않게.
    if (rest.replace(/[\s:：()（）금金₩￦]/g, "") === "") {
      const next = lines[hit.index + 1] ?? "";
      if (!MONEY_STOPS.some((w) => labelPattern(w).test(next))) rest = `${rest} ${cut(next)}`;
    }
    segs.push(rest);
  }
  return segs;
}

type MoneyPick = { won: number; confidence: number; warnings: string[] };

function pickMoney(lines: string[], labels: string[], what: string): MoneyPick | null {
  const values: number[] = [];
  let confirmed = false;
  for (const seg of labelSegments(lines, labels)) {
    const cands = findAmounts(seg);
    const distinct = [...new Set(cands.map((c) => c.won))];
    if (distinct.length === 1 && new Set(cands.map((c) => c.form)).size === 2) confirmed = true;
    for (const v of distinct) if (!values.includes(v)) values.push(v);
  }
  if (values.length === 0) return null;
  const warnings: string[] = [];
  let confidence = confirmed ? 0.9 : 0.8;
  if (values.length > 1) {
    confidence = 0.4;
    warnings.push(`${what} 금액 후보가 여러 개예요(한글·숫자가 다르게 읽혔을 수 있어요). 첫 번째를 골랐어요.`);
  }
  // 원 단위 그대로 저장하므로 반올림하지 않는다(옛 "만원 아래 반올림" 경고 없음).
  return { won: values[0]!, confidence, warnings };
}

export function parseLeaseContract(rawText: string): DocParseResult {
  const normalized = normalizeOcrText(rawText);
  const fields: ParsedField[] = [];
  const info: ParsedInfo[] = [];
  const documentWarnings: string[] = [];
  if (!normalized.trim()) {
    return { fields, documentWarnings: ["읽힌 글자가 없어요. 더 선명한 사진으로 다시 해 보세요."] };
  }
  const push = (key: CompanyInfoKey, value: string, confidence: number, warnings: string[] = []) => {
    if (value) fields.push({ key, value, confidence, warnings });
  };
  if (/주\s*민\s*등\s*록\s*번\s*호/.test(normalized) || THIRTEEN_DIGIT_ID.test(normalized)) {
    documentWarnings.push("임대인·임차인 주민등록번호는 읽지 않았어요.");
  }
  THIRTEEN_DIGIT_ID.lastIndex = 0;
  const text = normalized.replace(THIRTEEN_DIGIT_ID, " ");
  const lines = toLines(text);

  // 소재지 — 첫 "소재지" 라벨(부동산의 표시). 임대인·임차인 "주소" 는 보지 않는다.
  const addrHit = findLabelLines(lines, ["소재지"])[0];
  if (addrHit) {
    const { value, multiline } = valueAfter(lines, addrHit, ["소재지"], ADDR_STOPS);
    // 공용 stripSep 이 끝 ")" 를 떼므로 "(예시동" 처럼 짝이 깨지면 되돌린다.
    const opens = (value.match(/\(/g) ?? []).length - (value.match(/\)/g) ?? []).length;
    const v = (opens > 0 ? `${value})` : value).slice(0, 120);
    const warnings = multiline ? ["라벨 다음 줄에서 읽었어요. 확인해 주세요."] : [];
    push("소재지", v, v.length >= 5 ? (multiline ? 0.65 : 0.75) : 0.4, warnings);
  }

  // 보증금 / 월세(차임)
  const deposit = pickMoney(lines, ["보증금"], "보증금");
  if (deposit) push("임차보증금", groupThousands(deposit.won), deposit.confidence, deposit.warnings);
  const rent = pickMoney(lines, ["월차임", "차임", "월세", "임대료"], "월세");
  if (rent) {
    const vat = detectVat(text);
    const warnings = [...rent.warnings];
    if (vat === "separate") warnings.push("월세는 부가세 별도로 적혀 있어요. 실제로 내는 돈은 10% 더 많아요.");
    if (vat === "ambiguous") warnings.push("부가세 포함 여부 체크를 읽지 못했어요. 계약서를 확인해 주세요.");
    push("임차월세", groupThousands(rent.won), rent.confidence, warnings);
  }

  // 면적 — "임대할 부분" 줄(+다음 두 줄) 우선, 없으면 문서 전체에서.
  const partHit = findLabelLines(lines, LEASED_PART)[0];
  const scoped = partHit ? findAreas(lines.slice(partHit.index, partHit.index + 3).join("\n")) : [];
  let area: Area | undefined;
  let areaConf = 0.8;
  const areaWarn: string[] = [];
  if (scoped.length > 0) {
    area = scoped[0];
  } else {
    const all = findAreas(text);
    if (all.length === 1) {
      area = all[0];
      areaConf = 0.6;
    } else if (all.length > 1) {
      area = [...all].sort((a, b) => areaSqm(a) - areaSqm(b))[0];
      areaConf = 0.35;
      areaWarn.push("면적 후보가 여러 개예요. 가장 작은 값(빌린 부분일 가능성이 커요)을 골랐어요.");
    }
  }
  if (area) {
    if (area.sqm !== null && area.pyeong !== null && Math.abs(area.sqm / SQM_PER_PYEONG - area.pyeong) > Math.max(1, area.pyeong * 0.1)) {
      areaWarn.push("㎡와 평 숫자가 서로 맞지 않아요. 확인해 주세요.");
      areaConf = Math.min(areaConf, 0.4);
    }
    push("임차면적", formatSqm(area.sqm, area.pyeong), areaConf, areaWarn);
    if (area.pyeong !== null) info.push({ label: "임차 면적(평 병기)", value: formatArea(area.sqm, area.pyeong) });
  }

  // 소유여부 — 보증금·월세가 읽혔으면 임차(편집기 선택형 칸의 값 그대로 "임차").
  if (deposit || rent) {
    const conf = Math.min(deposit?.confidence ?? 1, rent?.confidence ?? 1, 0.8);
    push("소유여부", "임차", conf, conf < 0.5 ? ["금액이 맞는지 확인해 주세요."] : []);
  }

  if (fields.length === 0) {
    documentWarnings.push("임대차계약서 칸을 찾지 못했어요. 문서 종류가 맞는지 확인해 주세요.");
  }
  // 방어: 제안값에 13자리 번호가 남지 않게.
  for (const f of fields) f.value = f.value.replace(THIRTEEN_DIGIT_ID, "").trim();
  return { fields: fields.filter((f) => f.value), documentWarnings, ...(info.length > 0 ? { info } : {}) };
}
