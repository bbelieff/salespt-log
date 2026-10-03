/**
 * 글자 크기 단계(2026-09-29 belie) 가드 — 박스에 건 --font-scale 이 모든 글자에 먹도록.
 *  ① 임의 픽셀 글자(text-[11px])는 배율이 안 곱해진다 → 금지, 토큰 text-px-N 을 쓴다.
 *  ② Tailwind 글자 크기 토큰은 전부 var(--font-scale) 을 곱한다.
 *  ③ globals.css 의 font-size 도 배율을 곱한다.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import config from "../../tailwind.config";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}

describe("font-scale 가드", () => {
  it("① app·components 에 임의 픽셀 글자(text-[Npx]) 없음 — text-px-N 토큰을 쓰세요(tailwind.config.ts)", () => {
    const hits = [...walk("app"), ...walk("components")].flatMap((f) =>
      (readFileSync(f, "utf8").match(/text-\[[0-9.]+(?:px|rem)\]/g) ?? []).map((m) => `${f}: ${m}`),
    );
    expect(hits).toEqual([]);
  });

  it("② Tailwind fontSize 토큰은 모두 var(--font-scale) 을 곱한다", () => {
    const fs = (config.theme as { fontSize: Record<string, unknown> }).fontSize;
    for (const [k, v] of Object.entries(fs)) {
      const size = Array.isArray(v) ? v[0] : v;
      expect(String(size), k).toContain("var(--font-scale");
    }
  });

  it("③ globals.css font-size 는 배율을 곱한다", () => {
    const css = readFileSync("app/globals.css", "utf8");
    const raw = css.match(/font-size:\s*[0-9.]+(?:px|rem)\s*;/g) ?? [];
    expect(raw).toEqual([]);
  });
});
