/**
 * 대시보드 진행도 줄 — D-day·수료 판정은 종강총회일 기준(D1), 수료 뒤 "수료 후 N주"(D2). 2026-10-15 belie 결정.
 */
import { describe, expect, it, vi } from "vitest";
import { computeCourseBanner, daysBetween } from "@/app/(app)/dashboard/_lib/course-banner";
import { ceremonyISO, courseEndISO } from "@/config/cohort-dates";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DashboardProgressBanner from "@/components/dashboard/DashboardProgressBanner";

vi.stubGlobal("React", React);

const plus = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const START = "2026-08-07";

describe("computeCourseBanner — 총회일 기준", () => {
  const ceremony = ceremonyISO(START, "10");
  const courseEnd = courseEndISO(START, "10");

  it("10기: 총회일과 12주 끝이 다르면 D-day·라벨은 총회일을 본다", () => {
    expect(ceremony).not.toBe("");
    expect(daysBetween(ceremony, courseEnd)).toBeGreaterThan(0); // 전제: 총회가 12주 끝보다 앞
    const b = computeCourseBanner({ courseStartISO: START, graduationISO: "", cohort: "10", todayISO: plus(ceremony, 1), weeks: 12 });
    expect(b.hasDates && b.endISO).toBe(ceremony);
    // 총회 다음 날은 이미 수료 — 예전처럼 "D-3" 으로 남지 않는다.
    expect(b.hasDates && b.graduated).toBe(true);
  });

  it("총회 당일은 아직 수료가 아니다(D-DAY)", () => {
    const b = computeCourseBanner({ courseStartISO: START, graduationISO: "", cohort: "10", todayISO: ceremony, weeks: 12 });
    expect(b.hasDates && b.graduated).toBe(false);
    expect(b.hasDates && b.weeksAfterGraduation).toBe(0);
    expect(b.hasDates && b.progressPercent).toBe(100);
  });

  it("수료 후 N주: 다음 날~7일째 = 1주, 8일째 = 2주", () => {
    const at = (n: number) =>
      computeCourseBanner({ courseStartISO: START, graduationISO: "", cohort: "10", todayISO: plus(ceremony, n), weeks: 12 });
    const w = (n: number) => { const b = at(n); return b.hasDates ? b.weeksAfterGraduation : -1; };
    expect([w(1), w(7), w(8), w(14), w(15)]).toEqual([1, 1, 2, 2, 3]);
  });

  it("9기 이하: 시트에서 읽은 총회일(O2) 그대로", () => {
    const o2 = plus(START, 50);
    const b = computeCourseBanner({ courseStartISO: START, graduationISO: o2, cohort: "9", todayISO: START, weeks: 8 });
    expect(b.hasDates && b.endISO).toBe(ceremonyISO(START, "9") || o2);
    expect(b.hasDates && b.currentWeek).toBe(1);
  });

  it("시작일이 없으면 날짜 줄을 숨긴다", () => {
    expect(computeCourseBanner({ courseStartISO: undefined, graduationISO: "", cohort: "10", todayISO: START, weeks: 12 }).hasDates).toBe(false);
  });
});

describe("DashboardProgressBanner — 수료 후 N주 표시", () => {
  const base = { today: "10/30", weekday: "금", currentWeek: 12, startDate: "8/7", progressPercent: 100, graduationDate: "10/25" };
  it("수료 뒤에는 '수료 후 N주'", () => {
    const html = renderToStaticMarkup(React.createElement(DashboardProgressBanner, { ...base, graduated: true, weeksAfterGraduation: 2 }));
    expect(html).toContain("수료 후 2주");
  });
  it("수료 전에는 'N주차 진행중'", () => {
    const html = renderToStaticMarkup(React.createElement(DashboardProgressBanner, { ...base, graduated: false, weeksAfterGraduation: 0 }));
    expect(html).toContain("12주차 진행중");
    expect(html).not.toContain("수료 후");
  });
});
