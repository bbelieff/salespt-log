import { describe, it, expect } from "vitest";
import {
  formatCompanyInfoTxt,
  companyInfoTxtFileName,
} from "@/service/company-info-txt";
import { CompanyInfo } from "@/types";

describe("업체정보 TXT 포맷", () => {
  it("파일명 = 업체정보_{업체명}.txt (trim)", () => {
    expect(companyInfoTxtFileName(" A업체 ")).toBe("업체정보_A업체.txt");
  });

  it("[업체]/[대표자] 라벨:값 줄 + 추출시각, 빈값은 '-'", () => {
    const ci = CompanyInfo.parse({ 개업일: "2020-01-01", 대표자이름: "김대표" });
    const txt = formatCompanyInfoTxt("A업체", ci, "2026-06-11T00:00:00Z");
    expect(txt).toContain("■ 업체정보 — A업체");
    expect(txt).toContain("[업체]");
    expect(txt).toContain("개업일: 2020-01-01");
    expect(txt).toContain("사업자구분: -"); // 빈값 → '-'
    expect(txt).toContain("[대표자]");
    expect(txt).toContain("대표자 이름: 김대표");
    expect(txt).toContain("(추출시각: 2026-06-11T00:00:00Z)");
  });

  it("커스텀 필드도 그룹 안에 라벨:값으로 포함", () => {
    const ci = CompanyInfo.parse({
      커스텀: { 업체: { 비고: "VIP" }, 대표자: { 취미: "" } },
    });
    const txt = formatCompanyInfoTxt("B업체", ci, "T");
    expect(txt).toContain("비고: VIP");
    expect(txt).toContain("취미: -");
  });
});
