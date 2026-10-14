/**
 * document-ocr/registry — 문서 종류 분류기 + 문서별 파서 등록표.
 *
 * 다섯 문서(사업자등록증 · 부가세 과세표준증명 · 재무제표 · 신분증 · 임대차계약서)가 모두 등록돼 있다.
 * 새 문서는 파서를 만들어 PARSERS 에 한 줄 등록하면 팝업이 자동으로 쓴다. 등록 안 된 종류
 * (지금은 "모르는 문서" 뿐)는 팝업이 칸을 채우지 않고 문서 종류를 고르라고 안내한다.
 *
 * 파서는 원문 텍스트 + 업체 문맥(매출 기준 연도)을 받는다. 오늘 날짜는 각 파서가 기기 시계로(테스트만 주입).
 * 부가세·재무제표는 기준 연도로 매출 칸(Y~Y-3)을 고른다(company-finance-won-grid).
 */
import { parseBusinessCertificate } from "./parse-certificate";
import { parseFinancialStatement } from "./parse-fs";
import { parseIdCard } from "./parse-id-card";
import { parseLeaseContract } from "./parse-lease";
import { parseMeetingMemo } from "./parse-memo";
import { parseVatCertificate } from "./parse-vat";
import { compactText } from "./text-utils";
import type { DocParseContext, DocParseResult, DocParser, DocType } from "./types";

/** 문서 종류별 제목 키워드(공백 제거 후 비교). 문서 맨 위 제목이 가장 먼저 나오므로 "가장 앞에 나온 키워드" 가 이긴다. */
const KEYWORDS: [Exclude<DocType, "unknown">, string[]][] = [
  // 스캔 OCR 은 "증명" 을 "중명" 으로 자주 읽는다(2026-09-29 실측) — 제목 앞부분만으로도 판별.
  ["부가세과세표준증명", ["부가가치세과세표준증명", "과세표준증명", "과세표준중명", "부가가치세과세표준"]],
  ["재무제표", ["표준재무제표증명", "재무상태표", "손익계산서", "대차대조표"]],
  ["신분증", ["주민등록증", "자동차운전면허증", "운전면허증"]],
  // 주택 표준계약서 제목은 "주택임대차표준계약서" — "임대차계약서" 가 끊겨 있어 따로 둔다(2026-10-14 원페이지 경영진단 비교).
  ["임대차계약서", ["부동산임대차계약서", "임대차계약서", "부동산임대차", "상가건물임대차", "주택임대차", "임대차표준계약서"]],
  ["사업자등록증", ["사업자등록증", "사업자등록증명"]],
];

export function classifyDocumentText(text: string): DocType {
  const compact = compactText(text);
  let best: { type: DocType; at: number } = { type: "unknown", at: Number.POSITIVE_INFINITY };
  for (const [type, words] of KEYWORDS) {
    for (const w of words) {
      const at = compact.indexOf(w);
      if (at >= 0 && at < best.at) best = { type, at };
    }
  }
  if (best.type === "unknown" && looksLikeIdCard(text, compact)) return "신분증";
  return best.type;
}

/** 주민등록번호 꼴(가려진 것 포함) — 앞 6자리가 날짜 꼴일 때만. */
const RRN_SHAPE = /(?<!\d)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\s*[-~]\s*[\d*]{1,7}/;
const ID_ISSUER = /(시장|구청장|군수|도지사|경찰청장|도로교통공단)/;
/** "홍길동(洪吉童)" — 한글 이름 뒤 괄호 한자. */
const NAME_WITH_HANJA = /[가-힣]{2,4}\s*[(（]\s*[一-鿿]{2,4}\s*[)）]/;

/**
 * 신분증 사진은 제목("주민등록증")이 자주 깨진다 → 제목을 못 찾았을 때만, 짧은 글 + 주민등록번호 꼴 +
 * (발급기관 또는 한자 이름)이 함께 있으면 신분증으로 본다. 계약서 같은 긴 서류는 글 길이로 거른다.
 * 출처: 원페이지 경영진단 doc-parsers.js 판별 보완(2026-10-14 비교 보고).
 */
function looksLikeIdCard(text: string, compact: string): boolean {
  if (compact.length > 400) return false;
  if (!RRN_SHAPE.test(text)) return false;
  return ID_ISSUER.test(compact) || NAME_WITH_HANJA.test(text);
}

export const PARSERS: Partial<Record<DocType, DocParser>> = {
  사업자등록증: parseBusinessCertificate,
  부가세과세표준증명: (text, ctx) => parseVatCertificate(text, { baseYear: ctx?.baseYear }),
  재무제표: (text, ctx) => parseFinancialStatement(text, new Date(), { baseYear: ctx?.baseYear }),
  신분증: (text) => parseIdCard(text),
  임대차계약서: (text) => parseLeaseContract(text),
  미팅메모: (text, ctx) => parseMeetingMemo(text, ctx),
};

export function isSupportedDocType(type: DocType): boolean {
  return Boolean(PARSERS[type]);
}

/** 등록된 파서로 읽는다. 미지원 종류("모르는 문서")면 null. */
export function parseDocument(type: DocType, text: string, ctx?: DocParseContext): DocParseResult | null {
  const parser = PARSERS[type];
  return parser ? parser(text, ctx) : null;
}
