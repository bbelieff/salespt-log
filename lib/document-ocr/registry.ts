/**
 * document-ocr/registry — 문서 종류 분류기 + 문서별 파서 등록표.
 *
 * 새 문서(PR-5: 부가세 과세표준증명·재무제표·신분증·임대차계약서)는 파서를 만들어
 * PARSERS 에 한 줄 등록하면 팝업이 자동으로 쓴다. 등록 안 된 종류는 팝업이
 * "이 문서는 곧 지원돼요" 로 보여주고 아무 칸도 채우지 않는다.
 */
import { parseBusinessCertificate } from "./parse-certificate";
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
};

export function isSupportedDocType(type: DocType): boolean {
  return Boolean(PARSERS[type]);
}

/** 등록된 파서로 읽는다. 미지원 종류면 null(팝업이 "곧 지원돼요" 표시). */
export function parseDocument(type: DocType, text: string): DocParseResult | null {
  const parser = PARSERS[type];
  return parser ? parser(text) : null;
}
