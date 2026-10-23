/**
 * 주민등록번호 앞자리 보안 규칙 (company-info-new-fields, belie 결정 2026-09-28).
 * 앞 6자리만 "NNNNNN-" 로 저장 — 화면 정규화 + 서버 스키마(CompanyInfo transform) 이중 강제.
 */
import { describe, expect, it } from "vitest";
import { normalizeRrn, normalizeRrnFront, sanitizeRrnFrontTyping, sanitizeRrnTyping } from "@/util/rrn-front";
import { CompanyInfo, Meeting } from "@/types";
import { companyInfoToArchiveRow } from "@/repo/company-info-archive";
import { meetingToRow } from "@/repo/meetings-rows";

describe("normalizeRrnFront (저장 정규화)", () => {
  it.each([
    ["800101-0234567", "800101-"],
    ["8001010234567", "800101-"],
    ["800101 - 1", "800101-"],
    ["800101", "800101-"],
    ["800101-", "800101-"],
    [" 800101 ", "800101-"],
  ])("%s → %s", (input, out) => {
    expect(normalizeRrnFront(input)).toBe(out);
  });

  it.each([["80010"], [""], ["abc"], ["홍길동"], ["-800101"]])("앞 6자리 숫자 아님(%s) → 빈값", (input) => {
    expect(normalizeRrnFront(input)).toBe("");
  });

  it("null·undefined·숫자도 안전", () => {
    expect(normalizeRrnFront(undefined)).toBe("");
    expect(normalizeRrnFront(null)).toBe("");
    expect(normalizeRrnFront(8001010234567)).toBe("800101-");
  });
});

describe("sanitizeRrnFrontTyping (입력 중 정규화)", () => {
  it("6자리 미만은 그대로 — 타이핑 방해 없음", () => {
    expect(sanitizeRrnFrontTyping("8")).toBe("8");
    expect(sanitizeRrnFrontTyping("80010")).toBe("80010");
  });
  it("6자리 초과(뒷자리 입력·붙여넣기) → 즉시 앞자리만", () => {
    expect(sanitizeRrnFrontTyping("800101-1")).toBe("800101-");
    expect(sanitizeRrnFrontTyping("8001010234567")).toBe("800101-");
    expect(sanitizeRrnFrontTyping("800101-0234567")).toBe("800101-");
  });
  it("정확히 6자리는 하이픈 지우기를 허용(되돌려 붙이지 않음)", () => {
    expect(sanitizeRrnFrontTyping("800101")).toBe("800101");
    expect(sanitizeRrnFrontTyping("800101-")).toBe("800101-");
  });
  it("숫자·하이픈 외 문자는 버림", () => {
    expect(sanitizeRrnFrontTyping("8o0")).toBe("80");
  });
});

describe("서버 정규화 — 13자리 NNNNNN-NNNNNNN (ADR-0035, 합성 값)", () => {
  it("CompanyInfo 스키마(POST /api/company-info 파싱)가 13자리를 그대로 남긴다", () => {
    expect(CompanyInfo.parse({ 주민등록번호: "800101-0234567" }).주민등록번호).toBe("800101-0234567");
    expect(CompanyInfo.parse({ 주민등록번호: "8001010234567" }).주민등록번호).toBe("800101-0234567");
    expect(CompanyInfo.parse({ 주민등록번호: "800101-02345679" }).주민등록번호).toBe("800101-0234567");
    expect(CompanyInfo.parse({ 주민등록번호: "800101-" }).주민등록번호).toBe("800101-");
    expect(CompanyInfo.parse({}).주민등록번호).toBe("");
  });

  it("미팅 PATCH 본문 스키마(Meeting.omit.partial)도 같은 모양으로 맞춘다", () => {
    const PatchBody = Meeting.omit({ id: true }).partial();
    const out = PatchBody.parse({ 업체정보: { 주민등록번호: "8001010234567" } });
    expect(out.업체정보?.주민등록번호).toBe("800101-0234567");
  });

  it("스키마를 우회한 객체도 04·06 코덱이 같은 모양으로 맞춘다", () => {
    const leaky = { ...CompanyInfo.parse({}), 주민등록번호: "8001010234567999" } as CompanyInfo;
    const archive = companyInfoToArchiveRow("예시상사", "2026-09-28", leaky, "T");
    expect(archive).toContain("'800101-0234567");
    expect(archive.join("|")).not.toContain("999");
    const m = Meeting.parse({
      id: "m-rrn",
      예약일: "2026-09-28",
      예약시각: "10:00",
      미팅날짜: "2026-09-29",
      미팅시간: "14:00",
      channel: "매입DB",
      업체명: "예시상사",
      장소: "사무실",
    });
    const row = meetingToRow({ ...m, 업체정보: leaky });
    expect(row).toContain("'800101-0234567");
  });
});

describe("normalizeRrn / sanitizeRrnTyping (13자리, ADR-0035, 합성 값)", () => {
  it.each([
    ["800101-0234567", "800101-0234567"],
    ["8001010234567", "800101-0234567"],
    [" 800101 - 0234567 ", "800101-0234567"],
    ["800101", "800101-"],
    ["800101-", "800101-"],
    ["800101-02345678", "800101-0234567"],
    ["80010", ""],
    ["abc", ""],
  ])("normalizeRrn(%s) → %s", (input, out) => {
    expect(normalizeRrn(input)).toBe(out);
  });
  it("입력 중: 7번째 숫자에서 하이픈, 13자리 초과 버림, 6자리는 하이픈 지우기 허용", () => {
    expect(sanitizeRrnTyping("8001010")).toBe("800101-0");
    expect(sanitizeRrnTyping("80010102345678")).toBe("800101-0234567");
    expect(sanitizeRrnTyping("800101")).toBe("800101");
    expect(sanitizeRrnTyping("800101-")).toBe("800101-");
    expect(sanitizeRrnTyping("80a01")).toBe("8001");
  });
});
