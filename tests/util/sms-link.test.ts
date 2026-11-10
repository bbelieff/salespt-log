/**
 * 문자 앱 열기(sms:) — docs/plans/completed/script-sms-open.md.
 * 번호 유무·iOS 여부에 따른 주소 모양과, 대본 패널·DB 대본 창이 번호를 넘기는지 못 박는다.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { smsHref } from "@/util/sms-link";

describe("smsHref", () => {
  it("번호가 있으면 숫자만 남기고 ?&body= 로 본문을 붙인다(안드로이드·iOS 공통)", () => {
    expect(smsHref("010-1234-5678", "안녕 & 감사", false)).toBe(
      `sms:01012345678?&body=${encodeURIComponent("안녕 & 감사")}`,
    );
    expect(smsHref("010 1234 5678", "x", true)).toBe("sms:01012345678?&body=x");
  });
  it("번호가 없으면 iOS 는 &body=, 그 밖은 ?body=", () => {
    expect(smsHref("", "가\n나", true)).toBe(`sms:&body=${encodeURIComponent("가\n나")}`);
    expect(smsHref("", "가\n나", false)).toBe(`sms:?body=${encodeURIComponent("가\n나")}`);
  });
  it("줄바꿈·특수문자는 인코딩돼 주소가 깨지지 않는다", () => {
    const href = smsHref("01000000000", "◈ 필요서류\n1. 사업자등록증 #?&=", false);
    expect(href).not.toMatch(/[\n#\s]/);
    expect(decodeURIComponent(href.split("body=")[1]!)).toBe("◈ 필요서류\n1. 사업자등록증 #?&=");
  });
});

describe("문자 앱 버튼 연결", () => {
  const panel = readFileSync("components/company-info/ContactScriptPanel.tsx", "utf8");
  const sheet = readFileSync("app/(app)/db-sheet/_components/CallScriptSheet.tsx", "utf8");
  const ui = readFileSync("app/(app)/db-sheet/_components/CallUi.tsx", "utf8");
  it("대본 패널의 문자 양식 칸에 「문자 앱」 버튼이 smsHref 로 연다", () => {
    expect(panel).toMatch(/smsHref\(phone, data\.sms/);
    expect(panel).toContain(">문자 앱</button>");
  });
  it("DB 대본 창은 그 줄의 번호를 패널에 넘긴다", () => {
    expect(ui).toMatch(/<CallScriptSheet[^>]*phone=\{script\.phone\}/);
    expect(sheet).toMatch(/<ContactScriptPanel \{\.\.\.\(phone \? \{ phone \} : \{\}\)\} \/>/);
  });
});
