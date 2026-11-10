/** DB생산 순서(belie 2026-11-06 폰 · 11-07 PC 도): 채널 고르기 → 바로 밑 입력 → 전체 종합. 11-10: 채널선택 → 구매목록 추가 → 구매목록 → 합계 → 전체 종합. */
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
it("puts the channel picker and its workspace before the overall card on every width", () => {
  const src = readFileSync("app/(app)/db/page.tsx", "utf8");
  expect(src).toContain('<div className="flex flex-col">');
  expect(src).not.toMatch(/pc:order-none|pc:block/);
  const overall = src.indexOf("<OverallCard"), wrap = src.lastIndexOf('<div className="order-1">', overall);
  expect(wrap).toBeGreaterThan(-1); expect(overall - wrap).toBeLessThan(40);
  const picker = src.indexOf('aria-label="입력할 채널"'), work = src.indexOf("<DbChannelWorkspace");
  expect(src.slice(picker - 40, picker)).not.toMatch(/order-/); expect(work).toBeGreaterThan(picker);
  expect(src).toContain('<div className="order-2 mt-3">');
});
it("orders add form → list → channel total", () => {
  const src = readFileSync("app/(app)/db/_components/DbChannelWorkspace.tsx", "utf8");
  const list = src.indexOf("<RowList"), total = src.indexOf("<CostSummary"), add = src.indexOf("<RowForm channel={ch} initial={addInitial}");
  expect(add).toBeGreaterThan(-1);
  expect(list).toBeGreaterThan(add);
  expect(total).toBeGreaterThan(list);
});
