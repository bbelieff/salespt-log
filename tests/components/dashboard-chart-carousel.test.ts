import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 대시보드 모바일 차트 옆으로 넘기기(인터랙션 ② 2026-10-09, belie 승인 목업).
 * 1024px 미만: 퍼널·주차 추이·채널별 성과가 가로 스냅 카드(칩+점).
 * PC: 래퍼·스크롤러가 pc:contents 로 풀려 기존 그리드 칸이 그대로다.
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const page = read("app/(app)/dashboard/page.tsx");
const car = read("components/dashboard/MobileChartCarousel.tsx");
const css = read("app/globals.css");

describe("MobileChartCarousel", () => {
  it("모바일에서 한 장씩 멈추는 가로 스크롤, PC 에서는 풀린다", () => {
    expect(car).toContain("snap-x snap-mandatory");
    expect(car).toContain("overflow-x-auto");
    // 래퍼·스크롤러 모두 PC 에서 contents → 슬라이드가 대시보드 그리드의 칸이 된다.
    expect(car.match(/className="[^"]*pc:contents[^"]*"/g)?.length).toBe(2);
    // 칩·점은 PC 에서 숨긴다.
    expect(car.match(/className=[^>]*pc:hidden/g)?.length).toBe(2);
  });
  it("칩은 현재 차트를 aria-pressed 로 알리고, 움직임 줄이기면 즉시 이동한다", () => {
    expect(car).toContain("aria-pressed={active === i}");
    expect(car).toContain('behavior: reduce ? "auto" : "smooth"');
    expect(car).toContain('aria-roledescription="carousel"');
  });
  it("스크롤바는 숨긴다", () => {
    expect(css).toContain(".chart-snap-scroller { scrollbar-width: none; }");
  });
});

describe("대시보드 배치", () => {
  it("아래 차트 3종만 넘기기에 넣는다(재무·생산성·목표 카드는 밖)", () => {
    const start = page.indexOf("<MobileChartCarousel");
    const end = page.indexOf("</MobileChartCarousel>");
    expect(start).toBeGreaterThan(0);
    const inner = page.slice(start, end);
    for (const name of ["FunnelChart", "WeeklyDualChart", "ChannelPerformance"]) expect(inner).toContain(name);
    for (const name of ["FinanceSummaryBoxes", "ProductivityIndicators", "WeeklyGoalSummary"]) expect(inner).not.toContain(name);
    expect(page).toContain('CHART_LABELS = ["영업 퍼널", "주차 추이", "채널별 성과"]');
  });
  it("슬라이드는 모바일에서 5/6 폭·스냅, PC 에서 원래 칸 크기", () => {
    expect(page).toContain('CHART_SLIDE = "min-w-0 shrink-0 basis-5/6 snap-start pc:shrink pc:basis-auto"');
    expect(page.match(/className=\{CHART_SLIDE/g)?.length).toBe(3);
  });
});
