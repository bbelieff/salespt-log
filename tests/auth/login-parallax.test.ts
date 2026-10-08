import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 로그인 PC 포인터 패럴랙스(인터랙션 ③ 2026-10-09, belie 승인 목업).
 * 마우스일 때만 --lp-x/y 를 쓰고, 층은 CSS translate 로 깊이만큼 움직인다. 글·버튼은 고정.
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const scene = read("components/auth/LoginScene.tsx");
const stage = read("components/auth/LoginParallaxStage.tsx");

describe("LoginParallaxStage", () => {
  it("마우스·정밀 포인터·움직임 허용일 때만 값을 쓴다", () => {
    expect(stage).toContain('"(hover: hover) and (pointer: fine)"');
    expect(stage).toContain('"(prefers-reduced-motion: reduce)"');
    expect(stage).toContain('if (e.pointerType !== "mouse" || !fine.matches || reduce.matches) return;');
    expect(stage).toContain("requestAnimationFrame(write)");
  });
  it("<main> 에 transform 을 주지 않고 변수만 쓴다(고정 배경·웹뷰 경고 보존)", () => {
    expect(stage).toContain('host.style.setProperty("--lp-x"');
    expect(stage).not.toMatch(/style\.transform|style\.translate/);
  });
});

describe("LoginScene 층 깊이", () => {
  it("배경 6 · 오라 10 · 도넛 14 · 이모지 20/26 · 로고 4px", () => {
    for (const d of ["depth(6)", "depth(10)", "depth(14)", "depth(deco ? 26 : 20)", "depth(4)"]) expect(scene).toContain(d);
    expect(scene).toContain("calc(var(--lp-x, 0) * ${px}px)");
  });
  it("글·버튼은 움직이지 않는다", () => {
    const after = scene.slice(scene.indexOf("</LoginParallaxStage>"));
    expect(after).not.toContain("depth(");
  });
  it("움직임 줄이기면 애니메이션을 끄고 이모지를 바로 보인다", () => {
    expect(scene).toContain("@media (prefers-reduced-motion: reduce)");
    expect(scene).toContain(".login-emoji { animation: none !important; opacity: 1 !important; }");
  });
});
