import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// 화면 마감 v2(2026-11-10 승인): 공용 클래스가 있고, 세 화면이 실제로 쓴다.
const css = readFileSync("app/surfaces.css", "utf8");
const has = (f: string, cls: string) => readFileSync(f, "utf8").includes(cls);

describe("화면 마감 v2", () => {
  it("공용 클래스가 정의돼 있고 layout 이 불러온다", () => {
    for (const c of [".surface-hero", ".section-head", ".stat-split", ".stat-split-pc", ".list-row", ".bar-brand", ".btn-depth-blue", ".btn-depth-red"]) expect(css).toContain(c);
    expect(readFileSync("app/layout.tsx", "utf8")).toContain('import "./surfaces.css"');
  });
  it("광택·유리 재질을 쓰지 않는다", () => {
    expect(css).not.toMatch(/backdrop-filter|inset 0 1px 0 rgb\(255/);
  });
  it("대시보드·STEP 1·STEP 3 맨 위 요약이 surface-hero", () => {
    expect(has("app/(app)/dashboard/page.tsx", "surface-hero")).toBe(true);
    expect(has("app/(app)/db/_components/OverallCard.tsx", "surface-hero")).toBe(true);
    expect(has("app/(app)/schedule/_components/SummaryBar.tsx", "surface-hero")).toBe(true);
  });
});
