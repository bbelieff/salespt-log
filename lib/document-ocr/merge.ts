/**
 * document-ocr/merge — 두 인식기(PaddleOCR·tesseract)로 읽은 같은 문서의 파서 결과를 칸마다 합친다.
 *
 * 2026-10-28 belie 「지금 잘 읽는 부분은 살리고 새 OCR 을 붙여라」:
 * - 한쪽만 읽은 칸 → 그 값.
 * - 둘 다 같은 값 → 그 값, 확신도 조금 올린다(두 엔진이 맞춤).
 * - 값이 다름 → 형식 검증(valid) 통과 + 확신도가 높은 쪽. 비슷하면 앞(results[0], Paddle) 쪽.
 *   고른 칸에는 「다른 인식」 경고를 붙이고 확신도를 낮춰 사람이 한 번 보게 한다.
 * 문서 경고·참고 정보는 칸을 더 많이 채운 결과를 기준으로 쓴다(못 읽은 쪽의 「못 찾았어요」가 섞이지 않게).
 */
import type { DocParseResult, ParsedField } from "./types";

const TIE = 0.05;
const AGREE_BONUS = 0.1;
const DISAGREE_PENALTY = 0.1;

const same = (a: string, b: string) => a.replace(/\s+/g, "") === b.replace(/\s+/g, "");
const score = (f: ParsedField) => (f.valid === false ? -1 : 0) + f.confidence;
const filled = (r: DocParseResult) => r.fields.filter((f) => f.value !== "" && f.valid !== false).length;

function pick(cands: ParsedField[]): ParsedField {
  const read = cands.filter((f) => f.value !== "");
  if (read.length === 0) return cands[0]!;
  // 앞쪽이 동점 우선 — 뒤 후보는 TIE 보다 확실히 높아야 이긴다.
  const best = read.reduce((a, b) => (score(b) > score(a) + TIE ? b : a));
  const others = read.filter((f) => f !== best);
  if (others.length === 0) return best;
  if (others.every((f) => same(f.value, best.value))) {
    return { ...best, confidence: Math.min(1, Math.max(...read.map((f) => f.confidence)) + AGREE_BONUS) };
  }
  const alt = others.find((f) => !same(f.value, best.value))!;
  return {
    ...best,
    confidence: Math.max(0, best.confidence - DISAGREE_PENALTY),
    warnings: [...best.warnings, `다른 인식 결과: ${alt.value}`],
  };
}

export function mergeParseResults(results: DocParseResult[]): DocParseResult {
  if (results.length <= 1) return results[0] ?? { fields: [], documentWarnings: [] };
  const keys: ParsedField["key"][] = [];
  for (const r of results) for (const f of r.fields) if (!keys.includes(f.key)) keys.push(f.key);
  const fields = keys.map((key) => pick(results.flatMap((r) => r.fields.filter((f) => f.key === key))));
  const base = results.reduce((a, b) => (filled(b) > filled(a) ? b : a));
  const info = results.flatMap((r) => r.info ?? []);
  const mergedInfo = [...(base.info ?? [])];
  for (const i of info) if (!mergedInfo.some((m) => m.label === i.label)) mergedInfo.push(i);
  return { ...base, fields, ...(mergedInfo.length > 0 ? { info: mergedInfo } : {}) };
}
