/**
 * 사업계획서 작성도구 「서류에서 숫자 읽기」 — 파서 결과 → 팩트시트 칸 제안. 합성 텍스트만(예시상사·홍길동, 가짜 번호).
 */
import { describe, expect, it } from "vitest";
import {
  applySuggestions,
  bizplanBaseYear,
  cleanWarnings,
  fullDate,
  pickDocType,
  resolveSuggestions,
  suggestionsFromParse,
} from "@/lib/document-ocr/bizplan-map";
import { parseBusinessCertificate } from "@/lib/document-ocr/parse-certificate";
import { parseFinancialStatement } from "@/lib/document-ocr/parse-fs";
import { parseVatCertificate } from "@/lib/document-ocr/parse-vat";
import { suggestionsFromPieces } from "@/components/bizplan/ocr-run";
import { emptyBizplanDraft } from "@/util/bizplan-pack";
import { CORP_CERT, VALID_BIZNO } from "./fixtures";

const NOW = new Date(2026, 10, 24);
const BASE = 2025; // 빈 초안 연도 = 2022·2023·2024
const FS_2024 = [
  "표준재무제표증명",
  "사업연도 2024.01.01 ~ 2024.12.31",
  "(단위 : 원)",
  "매출액 1,500,000,000 1,200,000,000",
  "영업이익 120,000,000 90,000,000",
  "당기순이익 80,000,000 60,000,000",
  "자산총계 2,000,000,000",
  "부채총계 1,200,000,000",
  "자본총계 800,000,000",
].join("\n");
const VAT = [
  "부가가치세 과세표준증명",
  "2024년 2기 확정 2025-01-24 800,000,000",
  "2024년 1기 확정 2024-07-25 700,000,000",
  "2023년 2기 확정 2024-01-25 600,000,000",
  "2023년 1기 확정 2023-07-25 500,000,000",
].join("\n");

describe("bizplan-map", () => {
  const draft = emptyBizplanDraft(BASE); // 연도 2022·2023·2024
  const base = bizplanBaseYear(draft, 2000);

  it("기준 연도 = 팩트시트 연도 중 가장 늦은 해", () => {
    expect(base).toBe(2024);
    expect(bizplanBaseYear({ ...draft, years: draft.years.map((y) => ({ ...y, year: "" })) }, 2025)).toBe(2025);
  });

  it("사업자등록증 → 회사 정보 칸", () => {
    const r = suggestionsFromParse("사업자등록증", parseBusinessCertificate(CORP_CERT), base, "등록증.pdf");
    const by = Object.fromEntries(r.suggestions.map((s) => [s.target.kind === "info" ? s.target.key : "", s.value]));
    expect(by.bizNo).toBe(VALID_BIZNO);
    expect(by.ceo).toBe("홍길동");
    expect(by.founded).toBe("2019.07.15");
    expect(by.address).toContain("예시대로 100");
    expect(by.industry).toContain("제조업");
  });

  it("재무제표 → 결산연도 칸, 매출은 당기·전기 두 해", () => {
    const r = suggestionsFromParse("재무제표", parseFinancialStatement(FS_2024, NOW, { baseYear: base }), base, "fs.pdf");
    const got = Object.fromEntries(r.suggestions.map((s) => [s.target.kind === "year" ? `${s.target.year}${s.target.col}` : "", s.value]));
    expect(got["2024매출액"]).toBe("1,500");
    expect(got["2023매출액"]).toBe("1,200");
    expect(got["2024영업이익"]).toBe("120");
    expect(got["2024자본총계"]).toBe("800");
  });

  it("부가세 → 연도별 과세표준(반기 합)", () => {
    const r = suggestionsFromParse("부가세과세표준증명", parseVatCertificate(VAT, { today: NOW, baseYear: base }), base, "vat.pdf");
    const got = Object.fromEntries(r.suggestions.map((s) => [s.target.kind === "year" ? `${s.target.year}${s.target.col}` : "", s.value]));
    expect(got["2024과세표준"]).toBe("1,500");
    expect(got["2023과세표준"]).toBe("1,100");
  });

  it("맞추기: 빈칸만 기본 체크 · 같은 값은 빼고 · 없는 연도는 알림 · 다른 값은 경고", () => {
    const filled = applySuggestions(draft, []);
    filled.years[2]!.영업이익 = "999"; // 2024 영업이익 이미 적힘
    filled.years[2]!.매출액 = "1,500"; // 같은 값
    const raw = [
      ...suggestionsFromParse("재무제표", parseFinancialStatement(FS_2024, NOW, { baseYear: base }), base, "fs.pdf").suggestions,
      { target: { kind: "year" as const, year: "2019", col: "매출액" as const }, value: "10", confidence: 0.8, warnings: [], source: "old.pdf" },
      { target: { kind: "year" as const, year: "2023", col: "매출액" as const }, value: "1,250", confidence: 0.6, warnings: [], source: "vat.pdf" },
    ];
    const { rows, notes } = resolveSuggestions(raw, filled);
    const by = Object.fromEntries(rows.map((r) => [r.label, r]));
    expect(by["2024년 매출액"]).toBeUndefined();
    expect(by["2024년 영업이익"]?.current).toBe("999");
    expect(by["2024년 영업이익"]?.check).toBe(false);
    expect(by["2024년 당기순이익"]?.check).toBe(true);
    expect(by["2023년 매출액"]?.value).toBe("1,200");
    expect(by["2023년 매출액"]?.warnings.join()).toContain("1,250");
    expect(notes.join()).toContain("2019");
    // 오래된 해 먼저
    expect(rows.findIndex((r) => r.label === "2023년 매출액")).toBeLessThan(rows.findIndex((r) => r.label === "2024년 영업이익"));

    const next = applySuggestions(filled, rows.filter((r) => r.check));
    expect(next.years[2]!.당기순이익).toBe("80");
    expect(next.years[2]!.영업이익).toBe("999");
    expect(filled.years[2]!.당기순이익).toBe(""); // 원본은 그대로
  });

  it("두 인식 결과 차이: 자릿수가 크게 다르면 경고를 뺀다", () => {
    expect(cleanWarnings("1,500", ["다른 인식 결과: 0", "확인해 주세요"])).toEqual(["확인해 주세요"]);
    expect(cleanWarnings("120", ["다른 인식 결과: 0.1"])).toEqual([]);
    expect(cleanWarnings("1,500", ["다른 인식 결과: 1,560"])).toEqual(["다른 인식 결과: 1,560"]);
    expect(cleanWarnings("3", ["다른 인식 결과: 8"])).toEqual(["다른 인식 결과: 8"]);
  });

  it("문서 종류: 판별 못 하면 올린 칸 기준", () => {
    expect(pickDocType("unknown", "fs")).toBe("재무제표");
    expect(pickDocType("부가세과세표준증명", "fs")).toBe("부가세과세표준증명");
    expect(pickDocType("신분증", "biz")).toBe("사업자등록증");
    expect(fullDate("19.03.02", 2024)).toBe("2019.03.02");
    expect(fullDate("98.01.05", 2024)).toBe("1998.01.05");
  });

  it("읽은 조각 → 제안(두 인식 결과 합치기 포함)", () => {
    const r = suggestionsFromPieces(
      [
        { name: "fs.pdf", docType: "재무제표", text: FS_2024, altText: FS_2024 },
        { name: "vat.pdf", docType: "부가세과세표준증명", text: VAT },
      ],
      base,
    );
    expect(r.suggestions.some((s) => s.target.kind === "year" && s.target.col === "과세표준")).toBe(true);
    expect(r.suggestions.some((s) => s.target.kind === "year" && s.target.col === "영업이익")).toBe(true);
  });
});
