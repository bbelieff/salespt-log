/** 대시보드 차트 기준 — 2026-11-10 UI 점검으로 넣은 안내 문구는 2026-11-11 belie 요청으로 뺐다(각 차트 머리 「N주 누적」 유지). */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("대시보드 차트 기준 표시", () => {
  const page = readFileSync("app/(app)/dashboard/page.tsx", "utf8");
  it("★차트 위 기준 안내 문구는 없다(2026-11-11 belie 「삭제」) — 기준은 각 차트 머리의 「N주 누적」으로 보인다", () => {
    expect(page).not.toContain("dashboard-chart-basis");
    expect(page).not.toContain("코스 전체 누적");
  });
  it("채널별 성과 도넛 가운데는 「누적 비용」", () => {
    expect(readFileSync("components/dashboard/ChannelPerformance.tsx", "utf8")).toContain('centerLabel="누적 비용"');
  });
});
