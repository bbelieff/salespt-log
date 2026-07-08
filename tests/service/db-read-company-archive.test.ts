/**
 * R2-4b 정합 대조 (db-read-company-archive): 06 업체정보 DB read 가 시트 read
 * (readCompanyInfoArchiveRow의 E..AB 매핑)와 같은 결과를 내는지 고정 —
 * payload 3형태(upsert 평탄화 / backfill 열문자 / rename 키-only) 전부.
 */
import { describe, expect, it } from "vitest";
import { COMPANY_FIELDS, COMPANY_FIELDS_EXT } from "@/repo/meetings";
import { companyInfoFromDbPayload } from "@/repo/db/read-daily";

const colName = (i: number) =>
  i < 26 ? String.fromCharCode(65 + i) : "A" + String.fromCharCode(65 + i - 26);

/** 픽스처 — 대표 필드 몇 개 채운 CompanyInfo 원본 값. */
const FILLED: Record<string, string> = {
  개업일: "2020-01-01",
  사업자구분: "법인",
  소재지: "서울 강남",
  대표자이름: "김대표",
  연락처통신사: "SKT",
  대표자생년월일: "1980-05-05", // EXT
};
// CompanyInfo.커스텀 정식 스키마 = {업체:{라벨:값}, 대표자:{라벨:값}} (types/index.ts AN)
const CUSTOM = { 업체: { 메모1: "커스텀 값" }, 대표자: {} };

/** 시트 read(readCompanyInfoArchiveRow) 결과와 같은 기대 객체. */
function expected(): Record<string, unknown> {
  const ci: Record<string, unknown> = {};
  for (const f of COMPANY_FIELDS) ci[f] = FILLED[f] ?? "";
  for (const f of COMPANY_FIELDS_EXT) ci[f] = FILLED[f] ?? "";
  ci.커스텀 = CUSTOM;
  return ci;
}

describe("R2-4b company_archive: DB payload ↔ 시트 read 정합", () => {
  it("① upsert 미러(필드 평탄화 + 커스텀 객체) == 시트 결과", () => {
    const p: Record<string, unknown> = {
      업체명: "테스트상사", 계약일: "2026-07-01",
      ...FILLED, 커스텀: CUSTOM,
    };
    expect(companyInfoFromDbPayload(p)).toEqual(expected());
  });

  it("② backfill 열문자(E..X·Y=JSON·Z..AB) == 시트 결과", () => {
    const p: Record<string, unknown> = { _backfill: true };
    COMPANY_FIELDS.forEach((f, i) => {
      if (FILLED[f]) p[colName(4 + i)] = FILLED[f]; // E..X
    });
    p[colName(4 + COMPANY_FIELDS.length)] = JSON.stringify(CUSTOM); // Y
    COMPANY_FIELDS_EXT.forEach((f, i) => {
      if (FILLED[f]) p[colName(4 + COMPANY_FIELDS.length + 1 + i)] = FILLED[f]; // Z..AB
    });
    expect(companyInfoFromDbPayload(p)).toEqual(expected());
  });

  it("③ rename 키-only payload → 전 필드 빈값 (호출부 hasCompanyInfo 가 시트 fallback 유도)", () => {
    const ci = companyInfoFromDbPayload({ _cleared: false, 업체명: "개명상사", 계약일: "2026-07-02" })!;
    expect(ci).not.toBeNull();
    for (const f of [...COMPANY_FIELDS, ...COMPANY_FIELDS_EXT]) {
      expect(ci[f as keyof typeof ci] ?? "").toBe("");
    }
    expect(ci.커스텀).toBeUndefined();
  });

  it("④ 손상 커스텀 JSON 은 무시 (시트 read 와 동일 관용)", () => {
    const p: Record<string, unknown> = { ...FILLED };
    p[colName(4 + COMPANY_FIELDS.length)] = "{깨진 json";
    const ci = companyInfoFromDbPayload(p)!;
    expect(ci.커스텀).toBeUndefined();
    expect(ci.개업일).toBe("2020-01-01");
  });
});
