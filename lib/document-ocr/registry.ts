/**
 * document-ocr/registry — 문서 종류 분류기 + 문서별 파서 등록표.
 *
 * 다섯 문서(사업자등록증 · 부가세 과세표준증명 · 재무제표 · 신분증 · 임대차계약서)가 모두 등록돼 있다.
 * 새 문서는 파서를 만들어 PARSERS 에 한 줄 등록하면 팝업이 자동으로 쓴다. 등록 안 된 종류
 * (지금은 "모르는 문서" 뿐)는 팝업이 칸을 채우지 않고 문서 종류를 고르라고 안내한다.
 *
 * 파서는 모두 원문 텍스트 하나만 받는다(오늘 날짜는 각 파서가 기기 시계로 — 테스트만 주입).
 */
import { parseBusinessCertificate } from "./parse-certificate";
import { parseFinancialStatement } from "./parse-fs";
import { parseIdCard } from "./parse-id-card";
import { parseLeaseContract } from "./parse-lease";
import { parseVatCertificate } from "./parse-vat";
import { compactText } from "./text-utils";
import type { DocParseResult, DocParser, DocType } from "./types";

/** 문서 종류별 제목 키워드(공백 제거 후 비교). 문서 맨 위 제목이 가장 먼저 나오므로 "가장 앞에 나온 키워드" 가 이긴다. */
const KEYWORDS: [Exclude<DocType, "unknown">, string[]][] = [
  ["부가세과세표준증명", ["부가가치세과세표준증명", "과세표준증명"]],
  ["재무제표", ["표준재무제표증명", "재무상태표", "손익계산서", "대차대조표"]],
  ["신분증", ["주민등록증", "자동차운전면허증", "운전면허증"]],
  ["임대차계약서", ["부동산임대차계약서", "임대차계약서", "부동산임대차", "상가건물임대차"]],
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
  return best.type;
}

export const PARSERS: Partial<Record<DocType, DocParser>> = {
  사업자등록증: parseBusinessCertificate,
  부가세과세표준증명: (text) => parseVatCertificate(text),
  재무제표: (text) => parseFinancialStatement(text),
  신분증: (text) => parseIdCard(text),
  임대차계약서: (text) => parseLeaseContract(text),
};

export function isSupportedDocType(type: DocType): boolean {
  return Boolean(PARSERS[type]);
}

/** 등록된 파서로 읽는다. 미지원 종류("모르는 문서")면 null. */
export function parseDocument(type: DocType, text: string): DocParseResult | null {
  const parser = PARSERS[type];
  return parser ? parser(text) : null;
}
