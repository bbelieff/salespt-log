// @vitest-environment jsdom
/** 주차 추이(2026-11-10 belie 「추천대로」): 이번 주 막대 brand-red·「이번 주」, 미래 주는 값 없는 점선 빈 칸, 선은 이번 주에서 끊김. 합성 값만. */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import WeeklyDualChart, { weekSlots } from "@/components/dashboard/WeeklyDualChart";

vi.mock("@/components/motion/useMotion", () => ({ usePlayOnOpen: () => false }));
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | null = null, host: HTMLDivElement | null = null;
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; });

// 12주 코스, 서버는 미래 주도 0으로 채워 보낸다
const C = [1, 0, 2], A = [10, 20, 5];
const points = Array.from({ length: 12 }, (_, i) => ({ 주차: i + 1, 계약수: C[i] ?? 0, 활동량: A[i] ?? 0 }));
function mount(props: Record<string, unknown>) {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  act(() => root!.render(h(WeeklyDualChart, { points, ...props } as never)));
  return host;
}
const texts = (el: Element, t: string) => [...el.querySelectorAll("text")].filter(x => x.textContent === t);

describe("weekSlots", () => {
  it("코스 주차는 currentWeek 기준, 최근 8주는 마지막 칸, 모르면 강조·미래 없음", () => {
    expect(weekSlots(12, false, 3).current).toBe(2);
    expect(weekSlots(12, false, 3).isFuture(3)).toBe(true);
    expect(weekSlots(12, false, 3).isFuture(2)).toBe(false);
    expect(weekSlots(8, true, 3).current).toBe(7);
    expect(weekSlots(8, true).isFuture(7)).toBe(false);
    expect(weekSlots(12, false).current).toBe(-1);
    expect(weekSlots(12, false, 0).isFuture(11)).toBe(false);
    expect(weekSlots(12, false, 99).current).toBe(11); // 범위 밖은 마지막 칸으로
  });
});

describe("주차 추이 — 이번 주·미래 주", () => {
  it("3주차: 3주차 막대만 brand-red + 「이번 주」, 4~12주는 점선 빈 칸, 선은 3점까지, 요약 「3주차까지 계약 3건」", () => {
    const el = mount({ currentWeek: 3 });
    const current = el.querySelectorAll('rect[data-slot="current"]');
    expect(current).toHaveLength(1);
    expect(current[0]!.getAttribute("class")).toContain("fill-brand-red");
    expect(el.querySelectorAll('rect[data-slot="past"]')).toHaveLength(2);
    const future = el.querySelectorAll('rect[data-slot="future"]');
    expect(future).toHaveLength(9);
    expect(future[0]!.getAttribute("stroke-dasharray")).toBe("3 3");
    expect(future[0]!.getAttribute("fill")).toBe("none");
    expect(el.querySelector("polyline")!.getAttribute("points")!.trim().split(" ")).toHaveLength(3);
    expect(el.querySelectorAll("circle")).toHaveLength(3);
    expect(texts(el, "이번 주")).toHaveLength(1);
    expect(el.querySelector('[data-testid="weekly-trend-summary"]')!.textContent).toBe("3주차까지 계약 3건");
    expect(el.querySelector("desc")!.textContent).toContain("3주(이번 주): 활동량 5건");
    expect(el.querySelector("desc")!.textContent).toContain("4주: 아직 안 옴");
    // 마지막 칸(12주)은 더 이상 강조하지 않는다
    expect(texts(el, "12주")[0]!.getAttribute("font-weight")).toBeNull();
    expect(texts(el, "3주")[0]!.getAttribute("class")).toContain("fill-brand-red");
  });

  it("현재 주를 모르면(수료·날짜 없음) 미래 칸·강조 없이 전부 그리고 누적 요약", () => {
    const el = mount({});
    expect(el.querySelectorAll('rect[data-slot="future"]')).toHaveLength(0);
    expect(el.querySelectorAll('rect[data-slot="current"]')).toHaveLength(0);
    expect(el.querySelectorAll("circle")).toHaveLength(12);
    expect(el.querySelector('[data-testid="weekly-trend-summary"]')!.textContent).toBe("누적 계약 3건");
  });

  it("최근 8주 보기: 마지막 칸이 이번 주(빨강), 미래 칸 없음, 「이번 주」 글자는 x축 라벨 하나만", () => {
    const recentPoints = points.slice(0, 8).map((p, i) => ({ ...p, startISO: `2026-09-${String(i + 1).padStart(2, "0")}` }));
    const el = mount({ points: recentPoints, period: { kind: "recent", startISO: "2026-09-01", endISO: "2026-10-26", status: "available" }, currentWeek: 3 });
    expect(el.querySelectorAll('rect[data-slot="future"]')).toHaveLength(0);
    expect(el.querySelectorAll('rect[data-slot="current"]')).toHaveLength(1);
    expect(texts(el, "이번 주")).toHaveLength(1);
    expect(el.querySelector('[data-testid="weekly-trend-summary"]')!.textContent).toBe("지난 8주 계약 3건");
  });
});
