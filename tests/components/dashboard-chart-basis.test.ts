/** 대시보드: 아래 차트는 코스 전체 기준임을 밝힌다 — 위 기간 선택 비용과 헷갈리지 않게(2026-11-10 UI 점검). */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("대시보드 차트 기준 표시", () => {
  const page = readFileSync("app/(app)/dashboard/page.tsx", "utf8");
  it("★차트 묶음 위에 「코스 전체 누적」 기준 안내가 있고, 최근 8주 추이면 덧붙인다", () => {
    expect(page).toContain('data-testid="dashboard-chart-basis"');
    expect(page).toContain("코스 전체 누적");
    expect(page).toContain("(추이는 최근 8주)");
    expect(page.indexOf("dashboard-chart-basis")).toBeLessThan(page.indexOf("<MobileChartCarousel"));
  });
  it("채널별 성과 도넛 가운데는 「누적 비용」", () => {
    expect(readFileSync("components/dashboard/ChannelPerformance.tsx", "utf8")).toContain('centerLabel="누적 비용"');
  });
});
