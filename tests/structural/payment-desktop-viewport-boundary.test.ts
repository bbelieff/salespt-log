/**
 * /payment PC viewport 경계 회귀 가드.
 *
 * 1280px 이상에서는 헤더·상단 제어부를 포함한 셸이 뷰포트 높이를 나누고,
 * 목록·상세만 내부 스크롤을 소유한다. 모바일은 기존 문서 흐름을 유지한다.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const page = () => fs.readFileSync(path.join(process.cwd(), "app/(app)/payment/page.tsx"), "utf8");

describe("payment desktop viewport boundary", () => {
  it("1280px 이상에서만 헤더부터 작업판까지 한 viewport flex shell로 묶는다", () => {
    const src = page();
    expect(src).toContain('data-payment-desktop-shell className="min-[1280px]:flex min-[1280px]:h-[100dvh] min-[1280px]:min-h-0 min-[1280px]:flex-col"');
    expect(src).toContain('className="min-[1280px]:flex min-[1280px]:h-full min-[1280px]:min-h-0 min-[1280px]:flex-col"');
    expect(src.indexOf("<TopHeader")).toBeLessThan(src.lastIndexOf("<PaymentPerformanceSummary"));
    expect(src.lastIndexOf("<PaymentPerformanceSummary")).toBeLessThan(src.indexOf("payment-workspace"));
  });

  it("PC 작업판만 남은 flex 높이를 받고 목록·상세는 내부 스크롤을 유지한다", () => {
    const src = page();
    expect(src).toContain('payment-workspace relative grid min-h-[320px] min-w-0 items-stretch min-[1280px]:min-h-0 min-[1280px]:flex-1');
    expect(src).toContain('payment-list-scroll min-h-0 min-w-0 flex-1 overflow-y-auto');
    expect(src).toContain('payment-detail-shell flex h-full min-h-0 min-w-0 flex-col overflow-y-auto overflow-x-hidden');
    expect(src).toContain('archivedRows.length > 0 && <div className="px-2 pt-2"><TerminationArchive contracts={archivedRows} /></div>');
    expect(src).toContain('rows.length === 0 ? (<div className="space-y-3 min-[1280px]:min-h-0 min-[1280px]:flex-1 min-[1280px]:overflow-y-auto">');
    expect(src).toContain('const workspace = workspaceRef.current;');
    expect(src).toContain('if (workspace) observer?.observe(workspace);');
  });

  it("문서 높이를 JS로 강제하거나 body/global overflow lock을 만들지 않는다", () => {
    const src = page();
    expect(src).not.toContain("root.style.height");
    expect(src).not.toContain("Math.max(320");
    expect(src).not.toContain("document.body.style.overflow");
    expect(src).not.toContain("min-[1280px]:overflow-hidden");
  });

  it("모바일 분기는 그대로 문서 흐름과 아코디언을 유지한다", () => {
    const src = page();
    expect(src).toContain('window.matchMedia("(min-width: 1280px)")');
    expect(src).toContain("/* 모바일(<pc): 기존 아코디언 (회귀 금지) */");
    expect(src).toContain('!isPc && rows.length > 0 && <TerminationArchive contracts={archivedRows} />');
    expect(src).toContain('className="px-4 pb-[80px] pt-3 pc:px-0 pc:pb-6 min-[1280px]:flex min-[1280px]:min-h-0 min-[1280px]:flex-1 min-[1280px]:flex-col"');
  });
});
