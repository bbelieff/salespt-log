/**
 * 주민등록번호 앞자리 보안 규칙 (company-info-new-fields, belie 결정 2026-09-28).
 * 앞 6자리만 "NNNNNN-" 로 저장 — 화면 정규화 + 서버 스키마(CompanyInfo transform) 이중 강제.
 */
import { describe, expect, it } from "vitest";
import { normalizeRrnFront, sanitizeRrnFrontTyping } from "@/util/rrn-front";
import { CompanyInfo, Meeting } from "@/types";
import { companyInfoToArchiveRow } from "@/repo/company-info-archive";
import { meetingToRow } from "@/repo/meetings-rows";

describe("normalizeRrnFront (저장 정규화)", () => {
  it.each([
    ["800101-1234567", "800101-"],
    ["8001011234567", "800101-"],
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
    expect(normalizeRrnFront(8001011234567)).toBe("800101-");
  });
});

describe("sanitizeRrnFrontTyping (입력 중 정규화)", () => {
  it("6자리 미만은 그대로 — 타이핑 방해 없음", () => {
    expect(sanitizeRrnFrontTyping("8")).toBe("8");
    expect(sanitizeRrnFrontTyping("80010")).toBe("80010");
  });
  it("6자리 초과(뒷자리 입력·붙여넣기) → 즉시 앞자리만", () => {
    expect(sanitizeRrnFrontTyping("800101-1")).toBe("800101-");
    expect(sanitizeRrnFrontTyping("8001011234567")).toBe("800101-");
    expect(sanitizeRrnFrontTyping("800101-1234567")).toBe("800101-");
  });
  it("정확히 6자리는 하이픈 지우기를 허용(되돌려 붙이지 않음)", () => {
    expect(sanitizeRrnFrontTyping("800101")).toBe("800101");
    expect(sanitizeRrnFrontTyping("800101-")).toBe("800101-");
  });
  it("숫자·하이픈 외 문자는 버림", () => {
    expect(sanitizeRrnFrontTyping("8o0")).toBe("80");
  });
});

describe("서버 강제 — 전체 번호가 와도 저장 경로에 뒷자리가 닿지 않는다", () => {
  it("CompanyInfo 스키마(POST /api/company-info 파싱)가 앞자리만 남긴다", () => {
    expect(CompanyInfo.parse({ 주민등록번호: "800101-1234567" }).주민등록번호).toBe("800101-");
    expect(CompanyInfo.parse({ 주민등록번호: "8001011" }).주민등록번호).toBe("800101-");
    expect(CompanyInfo.parse({}).주민등록번호).toBe("");
  });

  it("미팅 PATCH 본문 스키마(Meeting.omit.partial)도 중첩 업체정보를 자른다", () => {
    const PatchBody = Meeting.omit({ id: true }).partial();
    const out = PatchBody.parse({ 업체정보: { 주민등록번호: "8001011234567" } });
    expect(out.업체정보?.주민등록번호).toBe("800101-");
  });

  it("스키마를 우회한 객체도 04·06 코덱이 한 번 더 자른다", () => {
    const leaky = { ...CompanyInfo.parse({}), 주민등록번호: "800101-1234567" } as CompanyInfo;
    const archive = companyInfoToArchiveRow("예시상사", "2026-09-28", leaky, "T");
    expect(archive.join("|")).not.toContain("1234567");
    expect(archive).toContain("'800101-");
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
    expect(row.join("|")).not.toContain("1234567");
    expect(row).toContain("'800101-");
  });
});
