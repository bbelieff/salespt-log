/**
 * 공지 HTML 소독 (notice-rich-editor / ADR-0017) — XSS 방어선 단위 테스트.
 * script·on*·javascript:·style injection 제거 + 허용 서식 보존 + isHtmlContent.
 */
import { describe, expect, it } from "vitest";
import { isHtmlContent, sanitizeNoticeHtml } from "@/lib/notice-html";

describe("sanitizeNoticeHtml — XSS 제거", () => {
  it("<script> 제거", () => {
    const out = sanitizeNoticeHtml('<p>안녕</p><script>alert(1)</script>');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert(1)");
    expect(out).toContain("안녕");
  });

  it("img onerror 등 이벤트 핸들러 제거", () => {
    const out = sanitizeNoticeHtml('<img src="x" onerror="alert(1)">');
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("alert");
  });

  it("javascript: 링크 제거 (href 무력화)", () => {
    const out = sanitizeNoticeHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain("javascript:");
  });

  it("onclick 속성 제거", () => {
    const out = sanitizeNoticeHtml('<p onclick="steal()">x</p>');
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("steal");
  });

  it("style 은 color/background-color 만 허용, 그 외 제거", () => {
    const out = sanitizeNoticeHtml(
      '<span style="color:#d71617;background-color:yellow;position:fixed;background:url(x)">v</span>',
    );
    expect(out).toContain("color:#d71617");
    expect(out).toContain("background-color:yellow");
    expect(out).not.toContain("position");
    expect(out).not.toContain("url(");
  });

  it("style expression()/javascript 인젝션 제거", () => {
    const out = sanitizeNoticeHtml(
      '<span style="color:expression(alert(1));width:expression(1)">v</span>',
    );
    expect(out).not.toContain("expression");
  });
});

describe("sanitizeNoticeHtml — 허용 서식 보존", () => {
  it("굵게·기울임·밑줄·삭선·하이라이트·목록 유지", () => {
    const html =
      "<p><strong>b</strong><em>i</em><u>u</u><s>s</s><mark>m</mark></p><ul><li>x</li></ul><ol><li>y</li></ol>";
    const out = sanitizeNoticeHtml(html);
    for (const t of ["<strong>", "<em>", "<u>", "<s>", "<mark>", "<ul>", "<ol>", "<li>"]) {
      expect(out).toContain(t);
    }
  });

  it("a 링크는 target=_blank rel 강제", () => {
    const out = sanitizeNoticeHtml('<a href="https://ex.com">x</a>');
    expect(out).toContain('href="https://ex.com"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain("noopener");
  });
});

describe("isHtmlContent", () => {
  it("태그 있으면 HTML, 없으면 마크다운(레거시)", () => {
    expect(isHtmlContent("<p>안녕</p>")).toBe(true);
    expect(isHtmlContent("**굵게** 일반 텍스트")).toBe(false);
    expect(isHtmlContent("그냥 한 줄")).toBe(false);
    expect(isHtmlContent("")).toBe(false);
  });
});
