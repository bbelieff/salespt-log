import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// 디자인 B(2026-11-10): 앱 회색은 slate 하나. 새 코드에 gray-* 가 다시 섞이지 않게 막는다.
const files = execSync("git ls-files app components lib", { encoding: "utf8" })
  .split(/\r?\n/)
  .filter((f) => /\.(tsx?|css)$/.test(f));

describe("디자인 B — 회색은 slate 로 통일", () => {
  it("app·components·lib 에 Tailwind gray-* 색이 없다", () => {
    const bad = files.filter((f) => /(?<![A-Za-z0-9_])gray-(50|[1-9]00|950)(?![0-9])/.test(readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });
  it("흰 글자 파란 버튼은 blue-700 이상", () => {
    const bad: string[] = [];
    for (const f of files.filter((x) => /\.tsx?$/.test(x))) {
      for (const s of readFileSync(f, "utf8").match(/"[^"\n]*"|`[^`]*`/g) ?? []) {
        if (s.includes("text-white") && /(?<![:A-Za-z-])bg-blue-(500|600)(?![0-9])/.test(s)) bad.push(f);
      }
    }
    expect(bad).toEqual([]);
  });
});
