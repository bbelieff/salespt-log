import { describe, it, expect } from "vitest";
import {
  COMPANY_FIELDS,
  COMPANY_FIELD_START,
  COMPANY_CUSTOM_COL,
  COMPANY_FIELDS_EXT,
  COMPANY_EXT_START,
} from "@/repo/meetings";
import { CompanyInfo, Meeting } from "@/types";

describe("업체정보 컬럼 매핑 (04 T~AN + AQ~AS)", () => {
  it("20 필드(T~AM) + 커스텀(AN). 시작 T=19, 커스텀 AN=39", () => {
    expect(COMPANY_FIELDS).toHaveLength(20);
    expect(COMPANY_FIELD_START).toBe(19); // T (A=0)
    expect(COMPANY_CUSTOM_COL).toBe(39); // AN
    // 마지막 일반 필드(대표기타메모) = AM(38), 그 다음이 커스텀 AN(39).
    expect(COMPANY_FIELD_START + COMPANY_FIELDS.length).toBe(COMPANY_CUSTOM_COL);
  });

  it("확장 3필드 = AQ(42)~AS — AO(40)/AP(41) 이월깃발 비침범 (field-grid)", () => {
    expect(COMPANY_FIELDS_EXT).toHaveLength(3);
    expect(COMPANY_EXT_START).toBe(42); // AQ — 이월(AO/AP) 바로 뒤
    expect(COMPANY_EXT_START).toBeGreaterThan(41); // AP(이월원본행id) 침범 금지
  });

  it("COMPANY_FIELDS(+EXT) 키가 CompanyInfo 스키마 키와 일치", () => {
    const ciKeys = new Set(Object.keys(CompanyInfo.parse({})));
    for (const f of [...COMPANY_FIELDS, ...COMPANY_FIELDS_EXT]) {
      expect(ciKeys.has(f)).toBe(true);
    }
  });
});

describe("CompanyInfo / Meeting 스키마", () => {
  it("CompanyInfo 빈 입력 → 전 필드 빈 문자열 default", () => {
    const ci = CompanyInfo.parse({});
    expect(ci.개업일).toBe("");
    expect(ci.대표자이름).toBe("");
    expect(ci.커스텀).toBeUndefined();
  });

  it("커스텀 JSON 파싱", () => {
    const ci = CompanyInfo.parse({
      대표자이름: "김대표",
      커스텀: { 업체: { 비고: "VIP" }, 대표자: {} },
    });
    expect(ci.대표자이름).toBe("김대표");
    expect(ci.커스텀?.업체?.비고).toBe("VIP");
  });

  it("Meeting 에 업체정보 optional — 없어도 통과", () => {
    const base = {
      id: "x",
      예약일: "2026-06-10",
      예약시각: "10:00",
      미팅날짜: "2026-06-11",
      미팅시간: "14:00",
      channel: "매입DB",
      업체명: "A업체",
      장소: "사무실",
    };
    expect(Meeting.parse(base).업체정보).toBeUndefined();
    const withCi = Meeting.parse({ ...base, 업체정보: { 개업일: "2020-01-01" } });
    expect(withCi.업체정보?.개업일).toBe("2020-01-01");
  });
});
