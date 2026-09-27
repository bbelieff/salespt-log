/**
 * 문서로 자동입력 — 재무제표(표준재무제표증명) 파서. 네트워크 없음 · 합성 OCR 텍스트만(잡음 포함).
 */
import { describe, expect, it } from "vitest";
import {
  detectAmountUnit,
  formatRatio,
  parseAmountTokens,
  parseFinancialStatement,
} from "@/lib/document-ocr/parse-fs";
import type { ParsedField } from "@/lib/document-ocr/types";

const NOW = new Date(2026, 8, 28);
const byKey = (fields: ParsedField[]) => Object.fromEntries(fields.map((f) => [f.key, f]));
const val = (fields: ParsedField[]) => Object.fromEntries(fields.map((f) => [f.key, f.value]));

/** 천원 단위 · 당기/전기 두 열 · 머리글에 발급일(2026)·주민등록번호 · 자간 노이즈 · O/0 혼동. */
const FS_THOUSAND = `
표 준 재 무 제 표 증 명
발급번호 1234-5678   발급일자 2026년 03월 31일
상 호 : 예시상사(주)    사업자등록번호 123-45-67890
대표자 : 홍길동    주민등록번호 800101-1234567
사업연도 : 2025년 01월 01일 ~ 2025년 12월 31일
재 무 상 태 표
(단위 : 천원)
과 목        제 5(당)기      제 4(전)기
Ⅰ. 유동자산     1,200,000     1,000,000
자 산 총 계     2,500,000     2,100,000
부 채 총 계     1,375,000     1,300,000
자 본 총 계     1,125,000       800,000
부채와자본총계   2,500,000     2,100,000
손 익 계 산 서
Ⅰ. 매출액 (주석 12)   3,200,000   2,800,000
    상품매출액   1,000,000     900,000
Ⅱ. 매출원가    2,000,000   1,800,000
Ⅳ. 영업이익(손실)   240,000    200,000
    이자수익      5,000      4,000
    이자비용    100,000     90,000
Ⅹ. 당기순이익(손실)   96,OOO    80,000
`;

/** 원 단위 · K-IFRS 과목명 · 손실 · 자본잠식 · 이자비용 "-"(=0) · 전기 없음. */
const FS_LOSS_WON = `
재무상태표
2023년 12월 31일 현재
(단위: 원)
자산총계   150,000,000
부채총계   180,000,000
자본총계   (30,000,000)
포괄손익계산서
수익(매출액)   400,000,000
영업손실   12,345,678
금융비용   -
당기순손실   (20,000,000)
`;

describe("parse-fs 헬퍼", () => {
  it("비율", () => {
    expect(formatRatio(122.2222)).toBe("122.2");
    expect(formatRatio(120)).toBe("120");
    expect(formatRatio(-0.01)).toBe("0");
  });

  it("단위 감지", () => {
    expect(detectAmountUnit("( 단 위 : 천 원 )")?.multiplier).toBe(1000);
    expect(detectAmountUnit("(단위: 원)")?.multiplier).toBe(1);
    expect(detectAmountUnit("(단위:백만원)")?.multiplier).toBe(1_000_000);
    expect(detectAmountUnit("단위 없음")).toBeNull();
  });

  it("금액 토큰: 괄호·△·OCR 잡음", () => {
    expect(parseAmountTokens("(1,234)  △5,000  1. 234.567  l,000  96,OOO").map((t) => t.value)).toEqual([
      -1234, -5000, 1234567, 1000, 96000,
    ]);
  });
});

describe("parseFinancialStatement", () => {
  it("천원 단위 표준재무제표증명 — 금액·비율·과년도 매출", () => {
    const r = parseFinancialStatement(FS_THOUSAND, NOW);
    expect(val(r.fields)).toEqual({
      결산연도: "2025",
      과년도매출: "25' 3,200백만",
      과년도매출Y2: "24' 2,800백만",
      영업이익: "2.4억",
      당기순이익: "9,600만",
      이자비용: "1억",
      자산총계: "25억",
      부채총계: "13억 7,500만",
      자본총계: "11억 2,500만",
      부채비율: "122.2%",
      이자보상배율: "2.4배",
      당기순이익률: "3%",
      매출증가율: "14.3%",
    });
    expect(r.info).toContainEqual({ label: "금액 단위", value: "천원" });
    expect(r.documentWarnings).toEqual([]);
  });

  it("주민등록번호는 어떤 결과에도 남지 않는다", () => {
    const r = parseFinancialStatement(FS_THOUSAND, NOW);
    const dump = JSON.stringify(r);
    expect(dump).not.toContain("1234567");
    expect(dump).not.toContain("800101");
  });

  it("원 단위 · 손실 · 자본잠식 · 이자비용 0", () => {
    const r = parseFinancialStatement(FS_LOSS_WON, NOW);
    const f = byKey(r.fields);
    expect(f.결산연도?.value).toBe("2023");
    expect(f.과년도매출Y3?.value).toBe("23' 400백만");
    expect(f.과년도매출).toBeUndefined();
    expect(f.영업이익?.value).toBe("-1,235만");
    expect(f.당기순이익?.value).toBe("-2,000만");
    expect(f.자본총계?.value).toBe("-3,000만");
    expect(f.이자비용?.value).toBe("0원");
    expect(f.이자보상배율).toBeUndefined();
    expect(f.부채비율?.value).toBe("자본잠식");
    expect(f.부채비율?.warnings.join()).toContain("자본잠식");
    expect(f.당기순이익률?.value).toBe("-5%");
    expect(f.매출증가율).toBeUndefined();
    expect(r.documentWarnings.join()).toContain("이자보상배율");
  });

  it("오래된 연도 매출은 넣지 않고, 단위가 없으면 경고", () => {
    const text = `손익계산서\n사업연도 2020.01.01 부터 2020.12.31 까지\n매 출 액 500,000,000\n영업이익 50,000,000\n이자비용 10,000,000`;
    const r = parseFinancialStatement(text, NOW);
    const f = byKey(r.fields);
    expect(f.결산연도?.value).toBe("2020");
    expect(f.과년도매출 ?? f.과년도매출Y2 ?? f.과년도매출Y3).toBeUndefined();
    expect(f.이자보상배율?.value).toBe("5배");
    expect(r.documentWarnings.join()).toContain("단위");
    expect(r.documentWarnings.join()).toContain("2020년 매출");
    expect(f.영업이익!.confidence).toBeLessThan(0.6);
  });

  it("표가 줄로 쪼개진 OCR · 전각 숫자 · △ 음수", () => {
    const text = [
      "손 익 계 산 서",
      "제 3 기  2025년 1월 1일 부터",
      "2025년 12월 31일 까지",
      "(단위 : 천원)",
      "매출액",
      "１,５００,０００",
      "영업이익(손실)  △ 30,000",
      "당기순이익(손실)  (45,000)",
    ].join("\n");
    const f = byKey(parseFinancialStatement(text, NOW).fields);
    expect(f.과년도매출?.value).toBe("25' 1,500백만");
    expect(f.과년도매출?.warnings.join()).toContain("다음 줄");
    expect(f.영업이익?.value).toBe("-3,000만");
    expect(f.당기순이익률?.value).toBe("-3%");
  });

  it("대차가 안 맞으면 경고하고 신뢰도를 낮춘다", () => {
    const text = `사업연도 2025.01.01 ~ 2025.12.31\n(단위: 원)\n자산총계 100,000,000\n부채총계 60,000,000\n자본총계 90,000,000`;
    const r = parseFinancialStatement(text, NOW);
    const f = byKey(r.fields);
    expect(f.자산총계?.confidence).toBeLessThanOrEqual(0.4);
    expect(f.자산총계?.warnings.join()).toContain("맞지 않아요");
    expect(r.documentWarnings.join()).toContain("합계");
  });

  it("빈 글자·과목 없는 문서", () => {
    expect(parseFinancialStatement("   ", NOW).documentWarnings[0]).toContain("읽힌 글자");
    const r = parseFinancialStatement("주민등록증\n홍길동", NOW);
    expect(r.fields).toEqual([]);
    expect(r.documentWarnings.join()).toContain("과목");
  });
});
