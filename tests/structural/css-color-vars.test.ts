/**
 * 손으로 쓴 CSS 의 색·글자 규칙 가드(2026-11-10 refactor/dbsheet-design-a, tokens.md §CSS 색·글자 변수).
 *  ① #색을 직접 쓰지 않고 globals.css 의 --ui-* 변수를 쓴다(주석 안 설명은 예외).
 *  ② 글자 크기는 px 고정값 대신 --app-px(좁은 화면 축소)·--font-scale(글자 크게)을 곱한다.
 *  ③ 쓰는 --ui-* 변수는 모두 globals.css 에 정의돼 있다.
 *  ④ 흰 바탕 글자에 slate-400(#94a3b8, 2.6:1)을 쓰지 않는다 — 비활성·끌기 중만 예외.
 *  ⑤ DB관리시트 표 열 너비 손잡이는 터치 화면(hover 없음)에서도 보인다.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const VAR_CSS_FILES = [
  "app/(app)/db-sheet/absence-link.css",
  "app/(app)/db-sheet/bulk.css",
  "app/(app)/db-sheet/call.css",
  "app/(app)/db-sheet/compact.css",
  "app/(app)/db-sheet/db-sheet.css",
  "app/(app)/db-sheet/feed.css",
  "app/(app)/db-sheet/recording.css",
  "app/(app)/db-sheet/_components/db-detail-compact.css",
  "app/(app)/db-sheet/_components/adaptive-import.css",
  "components/inbox/inbox.css",
  "components/dashboard/dashboard-follow-ups.css",
  "components/dashboard/followups-launcher.css",
  "components/dashboard/followups-table.css",
  "components/training-log/training-log.css",
  "components/bug-report/bug-report.css",
  "components/push/push.css",
];

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");
const read = (f: string) => stripComments(readFileSync(f, "utf8"));
const globals = readFileSync("app/globals.css", "utf8");

describe("손으로 쓴 CSS — 색 변수·글자 배율", () => {
  it.each(VAR_CSS_FILES)("① %s 에 #색이 없다", (f) => {
    expect(read(f).match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
  });

  it.each(VAR_CSS_FILES)("② %s 글자 크기는 --app-px·--font-scale 을 곱한다", (f) => {
    const sizes = read(f).match(/font-size\s*:\s*[^;}]+/g) ?? [];
    for (const s of sizes) {
      if (/inherit|initial|unset/.test(s)) continue;
      expect(s, `${f}: ${s}`).toMatch(/var\(--font-scale, 1\)/);
      if (/px/.test(s)) expect(s, `${f}: ${s}`).toMatch(/var\(--app-px, 1px\)/);
      // 12px 보다 작은 글자는 폰·태블릿 하한(--ui-fs-floor)을 거친다.
      const n = s.match(/calc\((?:max\()?([0-9.]+)/)?.[1];
      if (/--app-px/.test(s) && n && Number(n) < 12) expect(s, `${f}: ${s}`).toContain("var(--ui-fs-floor, 0)");
    }
  });

  it("③ 쓰는 --ui-* 변수는 globals.css 에 정의돼 있다", () => {
    const used = new Set(VAR_CSS_FILES.flatMap((f) => [...read(f).matchAll(/var\((--ui-[a-z0-9-]+)/g)].map((m) => m[1]!)));
    expect(used.size).toBeGreaterThan(20);
    for (const v of used) expect(globals, v).toMatch(new RegExp(`${v}:`));
    expect(globals).toMatch(/@media \(max-width: 1023\.98px\) \{\s*:root \{ --ui-fs-floor: 12; \}/);
  });

  it("④ 글자색에 slate-400(--ui-icon-faint)은 비활성·끌기 중에만", () => {
    for (const f of VAR_CSS_FILES) {
      for (const [, sel, body] of read(f).matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
        if (!/(^|[;\s])color\s*:\s*var\(--ui-icon-faint\)/.test(body!)) continue;
        expect(sel, `${f}: ${sel}`).toMatch(/:disabled|is-dragging|source-dragging|placeholder/);
      }
    }
  });

  it("⑤ 표 열 너비 손잡이는 터치 화면에서도 보인다", () => {
    expect(read("app/(app)/db-sheet/db-sheet.css")).toMatch(/@media\(hover:none\)\{body\.db-sheet-route \.sheet-resize\{opacity:1\}/);
  });
});
