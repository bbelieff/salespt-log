/** DB생산 폰·태블릿 순서(belie 2026-11-06): 채널 고르기 → 바로 밑 입력 → 전체 종합. PC(pc:)는 원래 순서. */
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
it("puts the channel picker and its workspace before the overall card below pc, original order on pc", () => {
  const src = readFileSync("app/(app)/db/page.tsx", "utf8");
  expect(src).toContain('<div className="flex flex-col pc:block">');
  const overall = src.indexOf("<OverallCard"), wrap = src.lastIndexOf('<div className="order-1 pc:order-none">', overall);
  expect(wrap).toBeGreaterThan(-1); expect(overall - wrap).toBeLessThan(60);
  const picker = src.indexOf('aria-label="입력할 채널"'), work = src.indexOf("<DbChannelWorkspace");
  expect(src.slice(picker - 40, picker)).not.toMatch(/order-/); expect(work).toBeGreaterThan(picker);
  expect(src).toContain('<div className="order-2 mt-3 pc:order-none">');
});
