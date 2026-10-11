import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import CardHeadline, { type Headline } from "@/components/ui/CardHeadline";

vi.stubGlobal("React", React);

// belie 2026-10-12 #8 — 카드 한 줄 문장 표시 컴포넌트.
const render = (headline: Headline | null, extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(React.createElement(CardHeadline, { headline, ...extra }));

describe("CardHeadline", () => {
  it("문장과 data-card-headline 을 그리고, 이모지는 화면낭독기에서 숨긴다", () => {
    const html = render({ text: "지금까지 594,520원을 남겼어요", emoji: "💰", tone: "profit" });
    expect(html).toContain("data-card-headline");
    expect(html).toContain("지금까지 594,520원을 남겼어요");
    expect(html).toContain('<span aria-hidden="true"> 💰</span>');
  });

  it.each([
    ["profit", "text-blue-700"],
    ["loss", "text-violet-600"],
    ["done", "text-green-700"],
    ["neutral", "text-slate-800"],
  ] as const)("tone %s → %s", (tone, cls) => {
    expect(render({ text: "문장", tone })).toContain(cls);
  });

  it("말줄임·잘림 없이 어절 단위 줄바꿈", () => {
    const html = render({ text: "문장", tone: "neutral" });
    expect(html).toContain("break-keep");
    expect(html).not.toMatch(/truncate|line-clamp|text-ellipsis/);
  });

  it("문장 없음·불러오는 중에도 자리(p)는 남는다 — 불러오는 중엔 회색 줄", () => {
    expect(render(null)).toMatch(/^<p data-card-headline=""[^>]*><\/p>$/);
    const loading = render(null, { loading: true });
    expect(loading).toContain("fx-skeleton");
    expect(loading).toContain('aria-busy="true"');
  });

  it("aria-live 는 넘긴 경우에만", () => {
    expect(render({ text: "문장", tone: "neutral" }, { "aria-live": "polite" })).toContain('aria-live="polite"');
    expect(render({ text: "문장", tone: "neutral" })).not.toContain("aria-live");
  });
});
