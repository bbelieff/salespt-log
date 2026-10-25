/**
 * 서류 → 소재지(2026-10-25 맞춤공고 1b) — 사업자등록증명·부가세 과세표준증명에서도 사업장 소재지를 읽어
 * 적용하는 순간 공고용 지역(시·도/시·군·구)이 함께 잡히는지. 합성 텍스트만(예시상사, 가짜 번호).
 */
import { describe, expect, it } from "vitest";
import { parseVatCertificate } from "@/lib/document-ocr/parse-vat";
import { classifyDocumentText, parseDocument } from "@/lib/document-ocr/registry";
import { grantProfile } from "@/lib/analytics/company-grant";

const TODAY = new Date(2026, 9, 25);
const VAT = (addressLine: string) => [
  "부 가 가 치 세  과 세 표 준 증 명",
  "상호(법인명) 예시상사   사업자등록번호 123-45-67891",
  "성명(대표자) 홍길동",
  addressLine,
  "과세기간  신고구분  신고일  과세표준  납부할세액",
  "2026년 1기  정기(확정)  2026-07-24  100,000,000  9,000,000",
].filter(Boolean).join("\n");

describe("부가세 과세표준증명 — 사업장 소재지", () => {
  it("★소재지 줄을 읽고, 같은 줄 뒤 칸(업태)에서 멈춘다", () => {
    const r = parseVatCertificate(VAT("사업장 소재지 울산광역시 남구 삼산로 123, 2층   업태 제조   종목 금속가공"), { today: TODAY });
    const addr = r.fields.find((f) => f.key === "소재지");
    expect(addr?.value).toBe("울산광역시 남구 삼산로 123, 2층");
    expect(grantProfile({ 소재지: addr!.value }).region).toEqual({ 시도: "울산", 시군구: "남구" });
    // 매출 칸은 그대로 읽힌다.
    expect(r.fields.some((f) => f.key === "매출Y상")).toBe(true);
  });
  it("소재지 줄이 없으면 소재지 칸을 만들지 않는다", () => {
    const r = parseVatCertificate(VAT(""), { today: TODAY });
    expect(r.fields.some((f) => f.key === "소재지")).toBe(false);
  });
});

describe("사업자등록증명 — 사업장 소재지", () => {
  const PROOF = [
    "사 업 자 등 록 증 명",
    "상호(법인명) 예시상사",
    "사업자등록번호 123-45-67891",
    "성명(대표자) 홍길동",
    "사업장 소재지 경기도 화성시 동탄대로 1, 101호",
    "업태 제조   종목 금속가공",
    "개업일 2024년 01월 10일",
  ].join("\n");
  it("사업자등록증 판독기로 읽고 소재지·지역이 잡힌다", () => {
    expect(classifyDocumentText(PROOF)).toBe("사업자등록증");
    const r = parseDocument("사업자등록증", PROOF)!;
    const addr = r.fields.find((f) => f.key === "소재지");
    expect(addr?.value).toContain("경기도 화성시 동탄대로 1");
    expect(grantProfile({ 소재지: addr!.value }).region).toEqual({ 시도: "경기", 시군구: "화성시" });
  });
});
