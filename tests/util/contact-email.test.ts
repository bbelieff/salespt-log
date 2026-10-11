/**
 * 업체정보 [대표자] 이메일 칸 정리·모양 검사 (company-info-email 2026-10). 합성 주소(example.com)만.
 * 정리는 최소한(대소문자 유지, "." 주변 공백 보존), 모양 검사는 막지 않는 안내용이라 느슨하다.
 */
import { describe, expect, it } from "vitest";
import { looksLikeContactEmail, tidyContactEmail } from "@/util/contact-email";

describe("tidyContactEmail", () => {
  it("앞뒤 공백·전각 ＠/．을 정리하고 대소문자는 그대로 둔다", () => {
    expect(tidyContactEmail(" CEO＠Example.com ")).toBe("CEO@Example.com");
    expect(tidyContactEmail("ceo＠example．com")).toBe("ceo@example.com");
    expect(tidyContactEmail("　ceo@example.com　")).toBe("ceo@example.com");
  });

  it("맨 앞 mailto: 를 대소문자 상관없이 뗀다", () => {
    expect(tidyContactEmail("mailto:a@b.co")).toBe("a@b.co");
    expect(tidyContactEmail("MAILTO: a@b.co")).toBe("a@b.co");
    expect(tidyContactEmail("메일 mailto:a@b.co")).toBe("메일 mailto:a@b.co"); // 맨 앞만
  });

  it("@ 가 하나일 때만 @ 양옆 공백을 붙이고, . 주변 공백은 건드리지 않는다", () => {
    expect(tidyContactEmail("ceo @ example.com")).toBe("ceo@example.com");
    expect(tidyContactEmail("ceo @ example . com")).toBe("ceo@example . com");
    // 여러 주소·문장은 합치지 않는다(적은 그대로 저장 약속).
    expect(tidyContactEmail("a@x.com. b@y.co.kr")).toBe("a@x.com. b@y.co.kr");
    expect(tidyContactEmail("회사 a @x.com , 개인 b@ y.com")).toBe("회사 a @x.com , 개인 b@ y.com");
  });

  it("빈 값은 빈 값", () => {
    expect(tidyContactEmail("   ")).toBe("");
  });
});

describe("looksLikeContactEmail", () => {
  it("빈 값은 안내 없음(true)", () => {
    expect(looksLikeContactEmail("")).toBe(true);
    expect(looksLikeContactEmail("  ")).toBe(true);
  });

  it("한 주소·여러 주소(쉼표·세미콜론·공백)를 허용한다", () => {
    expect(looksLikeContactEmail("ceo@example.com")).toBe(true);
    expect(looksLikeContactEmail("a@x.com, b@y.co.kr")).toBe(true);
    expect(looksLikeContactEmail("a@x.com;b@y.co.kr")).toBe(true);
    expect(looksLikeContactEmail("a@x.com b@y.co.kr")).toBe(true);
  });

  it("앞뒤에 남은 구분자로 생긴 빈 조각은 무시한다", () => {
    expect(looksLikeContactEmail("a@x.com,")).toBe(true);
    expect(looksLikeContactEmail("; a@x.com")).toBe(true);
    expect(looksLikeContactEmail(",")).toBe(false);
  });

  it("도메인 마디가 없거나 @ 앞뒤가 비면 모양이 아니다", () => {
    for (const v of ["ceo@example", "ceo", "@x.com", "ceo@", "ceo@.com", "ceo@example.", "a@x.com. b@y.co.kr", "ceo@@example.com"]) {
      expect(looksLikeContactEmail(v), v).toBe(false);
    }
  });

  it("tidy 뒤 판정 — 대문자·mailto 대문자 접두도 정리되면 맞는 모양", () => {
    expect(looksLikeContactEmail(tidyContactEmail("MAILTO:CEO＠Example.com"))).toBe(true);
  });
});
