/**
 * 공지 HTML 소독 (notice-rich-editor / ADR-0017).
 *
 * 리치 에디터(tiptap) 출력 = HTML. MarkdownView 가 막아주던 XSS 경로가 이제
 * 열리므로 DOMPurify 소독이 **유일한 방어선**. 태그/속성/스타일 화이트리스트를
 * 엄격히 유지한다(클라 렌더 + 서버 저장 양쪽에서 호출 — 심층 방어).
 *
 * isomorphic 이라 브라우저/Node(테스트·API) 모두 동작.
 */
import DOMPurify from "isomorphic-dompurify";

/** 허용 태그 — 서식/목록/링크/이미지/제목까지. script·iframe·table 등은 비허용. */
const ALLOWED_TAGS = [
  "p", "br", "strong", "b", "em", "i", "u", "s", "mark", "span",
  "a", "ul", "ol", "li", "h1", "h2", "h3", "img",
];
const ALLOWED_ATTR = ["href", "target", "rel", "src", "alt", "style"];

/** style 은 color / background-color 만 허용 — 그 외(position·url()·expression 등)
 *  전부 제거해 CSS injection 차단. 값은 hex·rgb(a)·hsl(a)·named 만. */
const STYLE_DECL =
  /^(color|background-color)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([\d.,\s%]+\)|hsla?\([\d.,\s%]+\)|[a-zA-Z]+)$/;

function safeStyle(raw: string): string {
  return raw
    .split(";")
    .map((d) => d.trim())
    .filter((d) => STYLE_DECL.test(d))
    .join("; ");
}

let hooked = false;
function ensureHooks(): void {
  if (hooked) return;
  hooked = true;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    const el = node as Element;
    // style: color/background-color 만 남김
    if (el.getAttribute && el.hasAttribute?.("style")) {
      const cleaned = safeStyle(el.getAttribute("style") ?? "");
      if (cleaned) el.setAttribute("style", cleaned);
      else el.removeAttribute("style");
    }
    // 링크는 항상 안전한 외부 열기 (target+rel 강제, javascript: 는 DOMPurify 가 차단)
    if (el.tagName === "A") {
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer nofollow");
    }
  });
}

/** 공지 HTML 소독 — 허용 화이트리스트 외 전부 제거. */
export function sanitizeNoticeHtml(html: string): string {
  if (!html) return "";
  ensureHooks();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // 기본 URI 정책 유지(javascript:·vbscript: 등 차단). data: 이미지는 비허용 기본.
  });
}

/** HTML 콘텐츠 여부 — 태그가 하나라도 있으면 HTML(리치), 아니면 마크다운(레거시). */
export function isHtmlContent(s: string): boolean {
  return /<[a-z][\s\S]*>/i.test(s ?? "");
}
