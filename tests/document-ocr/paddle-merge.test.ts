/**
 * PaddleOCR 붙이기(2026-10-28) — 글자 상자 → 줄 글, 두 엔진 결과 칸별 합치기. 합성 데이터만.
 */
import { describe, expect, it } from "vitest";
import { paddleItemsToText } from "@/lib/document-ocr/paddle-lines";
import { mergeParseResults } from "@/lib/document-ocr/merge";
import { parseDocument } from "@/lib/document-ocr/registry";
import type { DocParseResult, ParsedField } from "@/lib/document-ocr/types";
import { BAD_BIZNO, PERSONAL_CERT, VALID_BIZNO } from "./fixtures";

const box = (text: string, x: number, y: number, h = 30, w = 100) => ({
  text,
  poly: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]],
});
const field = (key: ParsedField["key"], value: string, confidence: number, valid?: boolean): ParsedField => ({
  key, value, confidence, warnings: [], ...(valid === undefined ? {} : { valid }),
});
const result = (...fields: ParsedField[]): DocParseResult => ({ fields, documentWarnings: [] });
const byKey = (r: DocParseResult) => Object.fromEntries(r.fields.map((f) => [f.key, f]));

describe("paddleItemsToText", () => {
  it("같은 높이 상자는 한 줄로, 왼쪽부터 · 줄은 위에서 아래로", () => {
    const items = [box("소매업", 300, 102), box("업", 80, 100), box("태:", 160, 104), box("등록번호", 80, 20), box("214-86-12345", 220, 22)];
    expect(paddleItemsToText(items)).toBe("등록번호 214-86-12345\n업 태: 소매업");
  });
  it("빈 글자·빈 상자는 버린다", () => {
    expect(paddleItemsToText([box("  ", 0, 0), { text: "x", poly: [] }, box("상호", 0, 50)])).toBe("상호");
  });
});

describe("mergeParseResults", () => {
  it("한쪽만 읽은 칸은 그 값을 쓴다", () => {
    const m = byKey(mergeParseResults([result(field("개업일", "", 0)), result(field("개업일", "2020.03.02", 0.8))]));
    expect(m["개업일"]?.value).toBe("2020.03.02");
  });
  it("둘이 같으면 그 값 · 확신도를 올린다", () => {
    const m = byKey(mergeParseResults([result(field("소재지", "서울 중구 예시로 1", 0.7)), result(field("소재지", "서울 중구  예시로 1", 0.6))]));
    expect(m["소재지"]?.value).toBe("서울 중구 예시로 1");
    expect(m["소재지"]?.confidence).toBeCloseTo(0.8);
  });
  it("다르면 형식 검증을 통과한 쪽 · 다른 인식은 경고로 남긴다", () => {
    const m = byKey(mergeParseResults([
      result(field("소재지", "서울 중구", 0.9), field("업태", "도매", 0.9, false)),
      result(field("소재지", "서울 종구", 0.6), field("업태", "도매업", 0.5)),
    ]));
    expect(m["업태"]?.value).toBe("도매업");
    expect(m["소재지"]?.value).toBe("서울 중구");
    expect(m["소재지"]?.warnings).toContain("다른 인식 결과: 서울 종구");
    expect(m["소재지"]?.confidence).toBeCloseTo(0.8);
  });
  it("확신도가 비슷하면 앞(Paddle) 쪽", () => {
    const m = byKey(mergeParseResults([result(field("개업일", "전자상거래", 0.7)), result(field("개업일", "전자상거레", 0.73))]));
    expect(m["개업일"]?.value).toBe("전자상거래");
  });
  it("실제 파서 — tesseract 가 사업자번호를 잘못 읽어도 Paddle 이 맞으면 살린다", () => {
    const paddle = parseDocument("사업자등록증", PERSONAL_CERT)!;
    const tess = parseDocument("사업자등록증", PERSONAL_CERT.replace(VALID_BIZNO, BAD_BIZNO).replace("예시로", "에시로"))!;
    const merged = mergeParseResults([paddle, tess]);
    const original = byKey(paddle);
    for (const f of merged.fields) expect(f.value).toBe(original[f.key]?.value);
  });
  it("결과가 하나뿐이면 그대로", () => {
    const one = result(field("업태", "도매", 0.5));
    expect(mergeParseResults([one])).toBe(one);
  });
});
