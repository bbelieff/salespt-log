/**
 * document-ocr/parse-fs — 재무제표(표준재무제표증명: 재무상태표 + 손익계산서) OCR 텍스트 → 업체정보 칸 제안.
 *
 * 채우는 칸: 결산연도 · 연도별 매출 합계(Y~Y-3 중 결산연도에 맞는 칸 — 칸 = 매출 기준 연도 − 결산연도) ·
 *   영업이익 · 당기순이익 · 이자비용 · 자산총계 · 부채총계 · 자본총계.
 *   매출증가율·부채비율·이자보상배율·당기순이익률은 채우지 않는다 — 편집기가 금액 칸에서 자동 계산한다
 *   (lib/service/company-finance.ts). 전기 매출은 한 해 앞 칸 + 참고 정보로 들어간다.
 * 금액은 모두 백만원 정본(wonToMillion — "3,200" · "240" · "-12.3", company-finance-won-grid 2026-09-28).
 * 천원·백만원 문서는 원으로 먼저 바꾼 뒤 백만원으로 — 칸마다 원문 원 금액(sourceWon)을 같이 싣는다.
 *
 * 읽는 법:
 * - 단위는 머리글 "(단위: 원)" / "(단위: 천원)" / "(단위: 백만원)" 에서 고른다. 없으면 원으로 읽고 경고.
 * - 과목 줄은 번호(Ⅰ. / 1. / (1))를 떼고 과목명으로 **시작**할 때만 맞춘다 — "상품매출액" 이 "매출액" 으로 잡히지 않게.
 * - 과목 뒤 숫자 중 첫째 = 당기, 둘째 = 전기. 쉼표 없는 1~3자리 숫자(주석·코드 번호)는 금액 후보에서 뺀다.
 * - 음수: "(1,234)", "△1,234", "▲1,234", "-1,234". "영업손실"/"당기순손실" 처럼 손실 과목명이면 양수도 음수로.
 *
 * 개인정보: 표준재무제표증명 머리글의 13자리 등록번호(주민·법인)는 원문에서 지운 뒤 읽는다. 원문은 결과에 싣지 않는다.
 */
import { THIRTEEN_DIGIT_ID, compactText, labelPattern, normalizeOcrText, toLines } from "./text-utils";
import type { CompanyInfoKey, DocParseResult, ParsedField, ParsedInfo } from "./types";
import { SALES_YEAR_KEYS, salesSlotOf } from "@/util/company-sales";
import { formatMoneyTxt, wonToMillion } from "@/util/company-money";

// ───────────────────────── 공용 후보 헬퍼 ─────────────────────────

/** 머리글 단위 → 원 환산 배수. 못 찾으면 null. */
export function detectAmountUnit(text: string): { multiplier: number; label: string } | null {
  const m = compactText(text).match(/단위[:：]?(백만원|천원|원)/);
  if (!m) return null;
  if (m[1] === "백만원") return { multiplier: 1_000_000, label: "백만원" };
  if (m[1] === "천원") return { multiplier: 1_000, label: "천원" };
  return { multiplier: 1, label: "원" };
}

/** OCR 숫자 잡음 정리: 숫자 사이 O→0, l/I→1, "1, 234" → "1,234", "1.234.567" → "1,234,567". */
function cleanNumeric(raw: string): string {
  return raw
    .replace(/(?<![A-Za-z가-힣])[\dOolI,]*\d[\dOolI,]*(?![A-Za-z가-힣])/g, (tok) =>
      tok.replace(/[Oo]/g, "0").replace(/[lI]/g, "1"),
    )
    .replace(/(?<=\d)\s*,\s*(?=\d{3}(?!\d))/g, ",")
    .replace(/(?<=\d)\s*\.\s*(?=\d{3}(?!\d))/g, ",");
}

export type AmountToken = { value: number; separated: boolean };

/** 한 줄의 금액 토큰(단위 미적용). 괄호·△·▲·- 는 음수. */
export function parseAmountTokens(raw: string): AmountToken[] {
  const s = cleanNumeric(raw);
  const out: AmountToken[] = [];
  const re = /(\(\s*)?([△▲-]\s*)?(\d{1,3}(?:,\d{3})+|\d+)(\s*\))?/g;
  for (const m of s.matchAll(re)) {
    const digits = m[3]!.replace(/,/g, "");
    let value = Number(digits);
    if (!Number.isFinite(value)) continue;
    const neg = Boolean(m[2]) || (Boolean(m[1]) && Boolean(m[4]));
    if (neg) value = -value;
    out.push({ value, separated: m[3]!.includes(",") });
  }
  return out;
}

// ───────────────────────── 과목 줄 찾기 ─────────────────────────

type ItemSpec = { key: string; labels: string[]; lossLabels?: string[] };

const ITEMS: ItemSpec[] = [
  { key: "매출액", labels: ["수익(매출액)", "매출액", "영업수익"] },
  { key: "영업이익", labels: ["영업이익(손실)", "영업손익", "영업이익"], lossLabels: ["영업손실"] },
  {
    key: "당기순이익",
    labels: ["당기순이익(손실)", "당기순손익", "당기순이익"],
    lossLabels: ["당기순손실"],
  },
  { key: "이자비용", labels: ["이자비용", "금융비용", "금융원가"] },
  { key: "자산총계", labels: ["자산총계"] },
  { key: "부채총계", labels: ["부채총계"] },
  { key: "자본총계", labels: ["자본총계"] },
];

/** 줄 앞 번호("Ⅰ.", "1.", "(1)", "가.") 를 뗀 공백 없는 형태. */
function itemHead(line: string): string {
  return compactText(line).replace(/^(?:[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫIVXivx\d]+[.)]?|\(\d+\)|[가-하][.)])+/, "");
}

type Found = { current: number; prior: number | null; sameLine: boolean; loss: boolean };

function stripAfterLabel(rest: string): string {
  return rest
    .replace(/^\s*\(\s*(?:손\s*실|이\s*익)\s*\)/, "")
    .replace(/\(\s*주\s*석?\s*[\d,\s]+\)/g, " ")
    .replace(/주\s*석\s*[\d,]+/g, " ");
}

function pickAmounts(tokens: AmountToken[]): number[] {
  if (tokens.length <= 1) return tokens.map((t) => t.value);
  // 쉼표 없는 1~3자리 숫자는 주석·코드 번호로 본다.
  const kept = tokens.filter((t) => t.separated || String(Math.abs(t.value)).length > 3);
  return kept.map((t) => t.value);
}

function findItem(lines: string[], spec: ItemSpec): Found | null {
  const all = [...spec.labels.map((l) => ({ l, loss: false })), ...(spec.lossLabels ?? []).map((l) => ({ l, loss: true }))];
  for (let i = 0; i < lines.length; i += 1) {
    const head = itemHead(lines[i]!);
    const hit = all.find(({ l }) => head.startsWith(compactText(l)));
    if (!hit) continue;
    const m = lines[i]!.match(labelPattern(hit.l));
    const rest = m && m.index !== undefined ? lines[i]!.slice(m.index + m[0].length) : "";
    const cleaned = stripAfterLabel(rest);
    // 재무제표의 "-" 는 0 이다(예: "이자비용  -  -").
    let amounts = /^[\s-]*-[\s-]*$/.test(cleaned) ? [0] : pickAmounts(parseAmountTokens(cleaned));
    let sameLine = true;
    if (amounts.length === 0) {
      // 표가 줄로 쪼개진 OCR — 바로 다음 줄이 숫자만이면 그 줄.
      const next = lines[i + 1] ?? "";
      if (/^[\s\d,.()△▲\-]+$/.test(next)) {
        amounts = pickAmounts(parseAmountTokens(next));
        sameLine = false;
      }
    }
    if (amounts.length === 0) continue;
    const signed = (v: number) => (hit.loss && v > 0 ? -v : v);
    return {
      current: signed(amounts[0]!),
      prior: amounts.length > 1 ? signed(amounts[1]!) : null,
      sameLine,
      loss: hit.loss,
    };
  }
  return null;
}

// ───────────────────────── 결산연도 ─────────────────────────

const DATE_G = /((?:19|20)\d{2})\s*[년.\-/]\s*(\d{1,2})\s*[월.\-/]\s*(\d{1,2})\s*일?/g;
const ISSUE_LINE = /발\s*급|발\s*행|신\s*청|출\s*력|접\s*수|확\s*인\s*일/;

function yearsIn(line: string): number[] {
  return [...line.matchAll(DATE_G)]
    .filter((m) => Number(m[2]) >= 1 && Number(m[2]) <= 12 && Number(m[3]) >= 1 && Number(m[3]) <= 31)
    .map((m) => Number(m[1]));
}

/** 사업연도·회계기간 끝 연도. 발급일 줄은 보지 않는다. */
export function findFiscalYear(lines: string[]): { year: number; confidence: number } | null {
  const period = /사\s*업\s*연\s*도|회\s*계\s*기\s*간|과\s*세\s*기\s*간|부\s*터|까\s*지|~|당\s*\)?\s*기/;
  const pick = (re: RegExp, confidence: number) => {
    const ys = lines.filter((l) => re.test(l) && !ISSUE_LINE.test(l)).flatMap(yearsIn);
    return ys.length > 0 ? { year: Math.max(...ys), confidence } : null;
  };
  const byPeriod = pick(period, 0.85) ?? pick(/현\s*재/, 0.75);
  if (byPeriod) return byPeriod;
  for (const l of lines) {
    const m = l.match(/((?:19|20)\d{2})\s*년?\s*(?:귀\s*속|사\s*업\s*연\s*도)|귀\s*속\s*연\s*도\s*[:]?\s*((?:19|20)\d{2})/);
    if (m && !ISSUE_LINE.test(l)) return { year: Number(m[1] ?? m[2]), confidence: 0.6 };
  }
  return null;
}

// ───────────────────────── 파서 ─────────────────────────

/** baseYear = 매출 칸 기준 연도(없으면 now 연도). */
export type FsParseOptions = { baseYear?: number };

export function parseFinancialStatement(
  rawText: string,
  now: Date = new Date(),
  opts: FsParseOptions = {},
): DocParseResult {
  const baseYear = opts.baseYear ?? now.getFullYear();
  const normalized = normalizeOcrText(rawText);
  const fields: ParsedField[] = [];
  const info: ParsedInfo[] = [];
  const documentWarnings: string[] = [];
  if (!normalized.trim()) {
    return { fields, info, documentWarnings: ["읽힌 글자가 없어요. 더 선명한 사진으로 다시 해 보세요."] };
  }
  const push = (key: CompanyInfoKey, value: string, confidence: number, warnings: string[] = [], sourceWon?: number) => {
    if (!value) return;
    fields.push({ key, value, confidence, warnings, ...(sourceWon === undefined ? {} : { sourceWon }) });
  };

  const text = normalized.replace(THIRTEEN_DIGIT_ID, " ");
  const lines = toLines(text);

  const unit = detectAmountUnit(text);
  if (!unit) documentWarnings.push("금액 단위(원·천원)를 찾지 못해 원으로 읽었어요. 금액 자릿수를 확인해 주세요.");
  else info.push({ label: "금액 단위", value: unit.label });
  const mul = unit?.multiplier ?? 1;
  const baseConf = unit ? 0.8 : 0.55;

  const got: Record<string, { current: number; prior: number | null; confidence: number; warnings: string[] }> = {};
  for (const spec of ITEMS) {
    const f = findItem(lines, spec);
    if (!f) continue;
    const warnings = f.sameLine ? [] : ["과목 다음 줄에서 읽었어요. 확인해 주세요."];
    got[spec.key] = {
      current: f.current * mul,
      prior: f.prior === null ? null : f.prior * mul,
      confidence: f.sameLine ? baseConf : baseConf - 0.15,
      warnings,
    };
  }

  // 대차 검증: 자산총계 ≈ 부채총계 + 자본총계 (1% 넘게 어긋나면 셋 다 경고·신뢰도 낮춤).
  const A = got.자산총계, L = got.부채총계, E = got.자본총계;
  if (A && L && E) {
    const diff = Math.abs(A.current - (L.current + E.current));
    if (diff > Math.max(Math.abs(A.current) * 0.01, 1_000)) {
      for (const g of [A, L, E]) {
        g.confidence = Math.min(g.confidence, 0.4);
        g.warnings.push("자산총계와 부채총계+자본총계가 맞지 않아요. 숫자를 확인해 주세요.");
      }
      documentWarnings.push("재무상태표 합계가 맞지 않아요. 흐린 숫자가 있을 수 있어요.");
    }
  }

  // 결산연도
  const fy = findFiscalYear(lines);
  if (fy) push("결산연도", String(fy.year), fy.confidence);
  else documentWarnings.push("사업연도(결산연도)를 찾지 못했어요.");

  // 매출 → 결산연도에 맞는 연도별 매출 합계 칸(칸 = 기준 연도 − 결산연도)
  const sales = got.매출액;
  if (sales) {
    info.push({ label: "매출액(당기)", value: formatMoneyTxt(wonToMillion(sales.current)) });
    if (sales.prior !== null) info.push({ label: "매출액(전기)", value: formatMoneyTxt(wonToMillion(sales.prior)) });
    if (fy) {
      const place = (year: number, won: number, conf: number, warnings: string[]) => {
        const slot = salesSlotOf(year, baseYear);
        if (slot !== null) push(SALES_YEAR_KEYS[slot]!, wonToMillion(won), conf, warnings, won);
        else documentWarnings.push(`${year}년 매출은 매출 칸(${baseYear - 3}~${baseYear}년)에 맞지 않아 넣지 않았어요.`);
      };
      place(fy.year, sales.current, Math.min(sales.confidence, fy.confidence), sales.warnings);
      if (sales.prior !== null) {
        place(fy.year - 1, sales.prior, Math.min(sales.confidence, fy.confidence) - 0.1, [
          "전기(작년) 칸에서 읽었어요. 확인해 주세요.",
        ]);
      }
    }
  }

  // 금액 칸
  const money: [string, CompanyInfoKey][] = [
    ["영업이익", "영업이익"], ["당기순이익", "당기순이익"], ["이자비용", "이자비용"],
    ["자산총계", "자산총계"], ["부채총계", "부채총계"], ["자본총계", "자본총계"],
  ];
  for (const [src, key] of money) {
    const g = got[src];
    if (!g) continue;
    const won = key === "이자비용" ? Math.abs(g.current) : g.current;
    push(key, wonToMillion(won), g.confidence, g.warnings, won);
  }
  // 부채비율·이자보상배율·당기순이익률은 편집기가 위 금액으로 계산한다(파서는 채우지 않음).

  if (Object.keys(got).length === 0) {
    documentWarnings.push("재무제표 과목(매출액·자산총계 등)을 찾지 못했어요. 문서 종류가 맞는지 확인해 주세요.");
  }
  return { fields: fields.filter((f) => f.value), info, documentWarnings };
}
