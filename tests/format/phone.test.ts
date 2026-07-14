/**
 * 연락처 포맷 유틸 (PR-1 공용 부품).
 * ★핵심 회귀: ①합본 필드("(SKT)") 접미 보존 ②시트가 숫자로 먹어 날아간 선행 0 복원.
 */
import { describe, it, expect } from "vitest";
import { formatPhone, maskPhoneInput, normalizePhoneDigits } from "@/lib/format/phone";

describe("normalizePhoneDigits (숫자 추출 + 선행 0 복원)", () => {
  it("하이픈·공백 제거", () => {
    expect(normalizePhoneDigits("010-1234-5678")).toBe("01012345678");
    expect(normalizePhoneDigits("010 1234 5678")).toBe("01012345678");
  });
  it("★시트가 숫자로 먹어 선행 0 이 소실된 레거시 복원", () => {
    // "01012345678" 을 USER_ENTERED 로 쓰면 Sheets 가 숫자로 파싱 → 1012345678 (10자리)
    expect(normalizePhoneDigits("1012345678")).toBe("01012345678");
    expect(normalizePhoneDigits(1012345678)).toBe("01012345678");
    // 02 번호도 동일 (0212345678 → 212345678, 9자리)
    expect(normalizePhoneDigits("212345678")).toBe("0212345678");
  });
  it("이미 0 으로 시작하면 패딩 안 함", () => {
    expect(normalizePhoneDigits("01012345678")).toBe("01012345678");
  });
});

describe("formatPhone (표시 정규화)", () => {
  it("휴대폰 11자리", () => {
    expect(formatPhone("01012345678")).toBe("010-1234-5678");
    expect(formatPhone("010-1234-5678")).toBe("010-1234-5678"); // 멱등
  });
  it("02 지역번호 (9·10자리)", () => {
    expect(formatPhone("021234567")).toBe("02-123-4567");
    expect(formatPhone("0212345678")).toBe("02-1234-5678");
  });
  it("기타 지역번호 10자리", () => {
    expect(formatPhone("0311234567")).toBe("031-123-4567");
  });
  it("★선행 0 소실 레거시도 올바르게 (오포맷 '101-2345-678' 방지)", () => {
    expect(formatPhone("1012345678")).toBe("010-1234-5678");
  });
  it("★합본 필드 — 선행 숫자만 포맷하고 접미('(SKT)')는 보존", () => {
    expect(formatPhone("01012345678(SKT)")).toBe("010-1234-5678(SKT)");
    expect(formatPhone("010-1234-5678(KT)")).toBe("010-1234-5678(KT)");
    expect(formatPhone("01012345678 (LG U+)")).toBe("010-1234-5678 (LG U+)");
  });
  it("숫자 없으면 원본 보존", () => {
    expect(formatPhone("(SKT)")).toBe("(SKT)");
    expect(formatPhone("")).toBe("");
    expect(formatPhone(null)).toBe("");
  });
  it("부분·비정형은 숫자 그대로(깨뜨리지 않음)", () => {
    expect(formatPhone("0101234")).toBe("0101234");
  });
});

describe("maskPhoneInput (입력 마스크 — 진행형 하이픈)", () => {
  it("타이핑 진행에 따라 하이픈이 붙는다", () => {
    expect(maskPhoneInput("010")).toBe("010");
    expect(maskPhoneInput("0101")).toBe("010-1");
    expect(maskPhoneInput("01012345")).toBe("010-1234-5");
    expect(maskPhoneInput("01012345678")).toBe("010-1234-5678");
  });
  it("02 는 최대 10자리 + 지역번호 규칙", () => {
    expect(maskPhoneInput("02")).toBe("02");
    expect(maskPhoneInput("02123")).toBe("02-123");
    expect(maskPhoneInput("021234567")).toBe("02-123-4567"); // 9자리
    expect(maskPhoneInput("0212345678")).toBe("02-1234-5678"); // 10자리
  });
  it("★휴대폰(3-4-4)과 지역번호(3-3-4) 분절이 섞이지 않는다", () => {
    expect(maskPhoneInput("01012345")).toBe("010-1234-5"); // 휴대폰 3-4-…
    expect(maskPhoneInput("0311234567")).toBe("031-123-4567"); // 지역 3-3-4
  });
  it("11자리 초과 입력은 잘라낸다", () => {
    expect(maskPhoneInput("010123456789999")).toBe("010-1234-5678");
  });
  it("이미 하이픈이 있어도 멱등", () => {
    expect(maskPhoneInput("010-1234-5678")).toBe("010-1234-5678");
  });
  it("숫자 외 문자는 무시", () => {
    expect(maskPhoneInput("abc010def1234")).toBe("010-1234");
  });
});
