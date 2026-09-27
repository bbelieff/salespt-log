import { describe, it, expect } from "vitest";
import {
  companyContractRef,
  companyInfoToArchiveRow,
} from "@/repo/company-info-archive";
import { COMPANY_FIELDS, COMPANY_FIELDS_EXT, COMPANY_FIELDS_EXT2 } from "@/repo/meetings";
import { CompanyInfo } from "@/types";

const CUSTOM_IDX = 4 + COMPANY_FIELDS.length; // Y

describe("06 업체정보 아카이브 행 빌더", () => {
  it("계약ref = `${계약일}|${업체명}` (05 contractRef 동일 포맷, trim)", () => {
    expect(companyContractRef("2026-06-10", " A업체 ")).toBe("2026-06-10|A업체");
  });

  it("행 = A~AV 48컬럼: 키 4 + 필드 20 + 커스텀 1 + 확장 3 + 확장2 20", () => {
    const row = companyInfoToArchiveRow("A업체", "2026-06-10", undefined, "T0");
    expect(row).toHaveLength(
      4 + COMPANY_FIELDS.length + 1 + COMPANY_FIELDS_EXT.length + COMPANY_FIELDS_EXT2.length,
    ); // 48
    expect(row).toHaveLength(48);
    expect(row[0]).toBe("A업체");
    expect(row[1]).toBe("2026-06-10");
    expect(row[2]).toBe("2026-06-10|A업체");
    expect(row[3]).toBe("T0");
    // 업체정보 없음 → 필드 전부 빈 문자열
    expect(row.slice(4).every((c) => c === "")).toBe(true);
  });

  it("필드값 apostrophe plain-text 강제 + 순서 매핑 (확장 = 커스텀 뒤 Z~AB)", () => {
    const ci = CompanyInfo.parse({
      개업일: "2020-01-01",
      대표자이름: "김대표",
      대표자생년월일: "88.01.24",
      과년도매출Y3: "23' 70백만",
    });
    const row = companyInfoToArchiveRow("B업체", "2026-06-11", ci, "T1");
    const idx = (f: string) => 4 + COMPANY_FIELDS.indexOf(f as never);
    const extIdx = (f: string) => CUSTOM_IDX + 1 + COMPANY_FIELDS_EXT.indexOf(f as never);
    expect(row[idx("개업일")]).toBe("'2020-01-01");
    expect(row[idx("대표자이름")]).toBe("'김대표");
    expect(row[idx("신용점수")]).toBe("");
    expect(row[extIdx("대표자생년월일")]).toBe("'88.01.24");
    expect(row[extIdx("과년도매출Y3")]).toBe("'23' 70백만");
  });

  it("기대출 줄바꿈(\\n) 셀 보존 — apostrophe prefix 뒤 원문 유지", () => {
    const ci = CompanyInfo.parse({ 기대출사업자: "신보 100\n재단 50" });
    const row = companyInfoToArchiveRow("E업체", "2026-06-13", ci, "T4");
    expect(row[4 + COMPANY_FIELDS.indexOf("기대출사업자")]).toBe("'신보 100\n재단 50");
  });

  it("커스텀 JSON 직렬화 (빈 {} 은 빈 셀) — 위치 = Y(커스텀), 끝 아님", () => {
    const ci = CompanyInfo.parse({
      커스텀: { 업체: { 비고: "VIP" }, 대표자: {} },
    });
    const row = companyInfoToArchiveRow("C업체", "2026-06-12", ci, "T2");
    const custom = String(row[CUSTOM_IDX]);
    expect(custom.startsWith("'")).toBe(true);
    expect(JSON.parse(custom.slice(1)).업체.비고).toBe("VIP");

    const empty = companyInfoToArchiveRow("D업체", "2026-06-12", CompanyInfo.parse({}), "T3");
    expect(empty[CUSTOM_IDX]).toBe("");
  });
});

describe("06 확장2 20필드 (AC~AV — company-info-new-fields)", () => {
  const EXT2_START = 4 + COMPANY_FIELDS.length + 1 + COMPANY_FIELDS_EXT.length; // 28 = AC

  it("확장2 = Z~AB 바로 뒤 AC(28)부터, 확정 순서 그대로", () => {
    expect(EXT2_START).toBe(28);
    expect(COMPANY_FIELDS_EXT2).toEqual([
      "과세유형", "업태", "법인등록번호", "임차보증금", "임차월세", "임차면적",
      "주민등록번호",
      "결산연도", "영업이익", "당기순이익", "이자비용", "자산총계", "부채총계", "자본총계",
      "반기별매출", "면세수입금액", "부채비율", "이자보상배율", "당기순이익률", "매출증가율",
    ]);
  });

  it("값은 apostrophe plain-text, 기존 열(Z~AB) 위치 불변", () => {
    const ci = CompanyInfo.parse({
      과년도매출Y3: "23' 70백만",
      과세유형: "일반과세자",
      주민등록번호: "800101-1234567", // 스키마가 앞자리만 남김
      매출증가율: "12%",
    });
    const row = companyInfoToArchiveRow("예시상사", "2026-09-28", ci, "T");
    expect(row[CUSTOM_IDX + 1 + COMPANY_FIELDS_EXT.indexOf("과년도매출Y3")]).toBe("'23' 70백만");
    expect(row[EXT2_START]).toBe("'일반과세자");
    expect(row[EXT2_START + COMPANY_FIELDS_EXT2.indexOf("주민등록번호")]).toBe("'800101-");
    expect(row[47]).toBe("'12%"); // AV
    expect(row.join("|")).not.toContain("1234567");
  });
});
