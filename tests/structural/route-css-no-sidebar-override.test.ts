/**
 * 사이드탭(DesktopNav) 모양은 globals.css 한 곳에서만 정한다.
 *
 * 2026-11-22 belie: 「DB관리 탭은 사이드바가 STEP 1·3·4 와 다른 폼」 — 원인은
 * app/(app)/db-sheet/db-sheet.css 의 `body.db-sheet-route .desktop-nav ...` 옛 규칙
 * (머리 칸 60px·STEP 줄 간격·글자 칸 58px)이 그 화면에서만 사이드탭을 다시 칠한 것.
 * 화면 전용 CSS 가 사이드탭을 건드리면 단계마다 모양이 달라지므로 막는다.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return cssFiles(p);
    return p.endsWith(".css") ? [p] : [];
  });
}

describe("화면 전용 CSS 는 사이드탭을 다시 칠하지 않는다", () => {
  const files = [...cssFiles("app"), ...cssFiles("components")].filter(
    (f) => !f.split(String.fromCharCode(92)).join("/").endsWith("app/globals.css"),
  );

  it("app·components 의 CSS(globals.css 제외)에 .desktop-nav 규칙이 없다", () => {
    const offenders = files.filter((f) => /\.desktop-nav\b/.test(readFileSync(f, "utf8")));
    expect(
      offenders,
      "사이드탭 모양은 app/globals.css 의 .desktop-shell .desktop-nav 에서만 바꾸세요 — 화면 전용 CSS 에서 덮으면 그 화면만 사이드탭이 달라집니다.",
    ).toEqual([]);
  });
});
