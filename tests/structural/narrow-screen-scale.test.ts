/**
 * 좁은 화면 비례 축소(2026-11-07 belie 「갤럭시 폴드 커버 화면에서 실무/수납·미팅예약이 잘린다」) 가드.
 * 설계 최소 폭 360px(xs) 미만에서는 360px 화면을 비율대로 줄여 보여 준다 — tokens.md §좁은 화면 비례 축소.
 *  ① 360px 미만에서만 루트 글자(rem)와 --app-px 를 화면 폭에 맞춰 줄인다(360px 이상·PC 무변경).
 *  ② 픽셀 글자 토큰(text-px-N)도 --app-px 를 곱해 함께 줄어든다.
 *  ③ globals.css 의 픽셀 글자도 --app-px 를 곱한다(PC 루트 13.5px 만 예외).
 *  ④ 폰·태블릿 본문은 카드 장식이 화면 밖으로 삐져도 가로 스크롤이 생기지 않는다.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import config from "../../tailwind.config";

const css = readFileSync("app/globals.css", "utf8");

describe("좁은 화면 비례 축소", () => {
  it("① 360px 미만에서만 rem·--app-px 를 화면 폭 비율로", () => {
    const block = css.match(/@media \(max-width: 359\.98px\) \{([^}]*\}[^}]*\})\s*\}/)?.[1] ?? "";
    expect(block).toContain("--app-px: calc(100vw / 360)");
    expect(block).toContain("font-size: calc(100vw / 22.5)"); // 360px 에서 16px
  });

  it("② text-px-N 토큰은 --app-px 를 곱한다", () => {
    const fs = (config.theme as { fontSize: Record<string, unknown> }).fontSize;
    const pxTokens = Object.entries(fs).filter(([k]) => k.startsWith("px-"));
    expect(pxTokens.length).toBeGreaterThan(0);
    for (const [k, v] of pxTokens) expect(String(Array.isArray(v) ? v[0] : v), k).toContain("var(--app-px, 1px)");
  });

  it("③ globals.css 픽셀 글자는 --app-px 를 곱한다(PC 루트만 예외)", () => {
    const fixedPx = (css.match(/calc\([0-9.]+px \* var\(--font-scale/g) ?? []);
    expect(fixedPx).toEqual(["calc(13.5px * var(--font-scale"]);
  });

  it("④ 1024px 미만 본문은 가로로 넘치지 않게 자른다", () => {
    expect(css).toMatch(/@media \(max-width: 1023\.98px\) \{ \.app-shell-main \{ overflow-x: clip; \} \}/);
  });
});
