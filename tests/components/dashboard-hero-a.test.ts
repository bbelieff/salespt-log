// @vitest-environment jsdom
/**
 * 대시보드 맨 위 띠 A안(belie 2026-11-13 승인):
 *  - PC: 진행 줄과 기간 칩이 한 줄(진행 왼쪽·칩 오른쪽), 재무는 매출·비용·영업이익·진행건 네 칸 + 칸 아래 미리보기 두 줄.
 *  - 아래 「전체 진행건」 판은 PC 에서 숨긴다(띠로 올라감). 폰(1024 미만)은 지금 그대로 — 세 칸 숫자, 미리보기·네 번째 칸 숨김.
 */
import * as React from "react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import FinanceSummaryBoxes from "@/components/dashboard/FinanceSummaryBoxes";
import { workPreviewLines, type WorkColumnData } from "@/components/dashboard/FinanceWorkColumn";
import type { WorkStatusItem, WorkStatusKey } from "@/lib/analytics/payment-work-status";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const baseProps = {
  revenue: 2_100_000,
  cost: 5_300_000,
  feeIncome: 1_800_000,
  commissionIncome: 300_000,
  dbCostTotal: 5_000_000,
  additionalCost: 300_000 as number | null,
  onOpenExpenseLedger: () => {},
  periodLabel: "전체",
  contractCount: 2,
};

const item = (status: WorkStatusKey, i: number): WorkStatusItem =>
  ({ key: `${status}-${i}`, status, row: 10 + i, slot: 1, company: `가상상사${i}`, product: "", institution: "" }) as unknown as WorkStatusItem;
const ITEMS: WorkStatusItem[] = [
  ...Array.from({ length: 9 }, (_, i) => item("progress", i)),
  item("collected", 20),
  ...Array.from({ length: 6 }, (_, i) => item("longterm", 30 + i)),
];
const work = (over: Partial<WorkColumnData> = {}): WorkColumnData => ({ items: ITEMS, failed: false, onRetry: vi.fn(), onNavigate: vi.fn(), ...over });

let root: Root | undefined;
let container: HTMLDivElement | undefined;
function render(props: Record<string, unknown> = {}) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(createElement(FinanceSummaryBoxes, { ...baseProps, ...props })));
  return container;
}
afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});
const byId = (id: string) => document.getElementById(id) as HTMLButtonElement;

describe("A안 네 칸 + 미리보기 (FinanceSummaryBoxes)", () => {
  it("진행건이 오면 PC 네 칸 균등, 네 번째 칸은 폰에서 숨는다", () => {
    const view = render({ work: work() });
    const group = view.querySelector('[role="group"][aria-label="매출·비용·영업이익"]')!;
    expect(group.className).toContain("grid-cols-3");
    expect(group.className).toContain("pc:grid-cols-4");
    expect(group.children).toHaveLength(4);
    const col = view.querySelector("[data-finance-work-column]")!;
    expect(col.className.split(" ")).toEqual(expect.arrayContaining(["hidden", "pc:flex"]));
    const btn = byId("fin-col-work");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(btn.getAttribute("aria-controls")).toBe("fin-detail-panel");
    expect(btn.textContent).toContain("진행건");
    expect(btn.textContent).toContain("16건");
  });

  it("진행건 없이 쓰면 지금처럼 세 칸(PC 네 칸 클래스 없음)", () => {
    const view = render();
    const group = view.querySelector('[role="group"][aria-label="매출·비용·영업이익"]')!;
    expect(group.className).not.toContain("pc:grid-cols-4");
    expect(group.children).toHaveLength(3);
    expect(byId("fin-col-work")).toBeNull();
  });

  it("칸 아래 미리보기 두 줄은 PC 에서만 보인다(폰 hidden)", () => {
    render({ work: work() });
    const preview = (id: string) => byId(id).querySelector<HTMLElement>("[data-finance-preview]")!;
    for (const id of ["fin-col-revenue", "fin-col-cost", "fin-col-profit", "fin-col-work"]) {
      const p = preview(id);
      expect(p, id).not.toBeNull();
      expect(p.className.split(" ")).toEqual(expect.arrayContaining(["hidden", "pc:flex"]));
      expect(p.children.length).toBe(2);
    }
    expect(preview("fin-col-revenue").textContent).toContain("수임비1,800,000원");
    expect(preview("fin-col-revenue").textContent).toContain("수수료300,000원");
    expect(preview("fin-col-cost").textContent).toContain("DB 비용5,000,000원");
    expect(preview("fin-col-cost").textContent).toContain("추가 비용300,000원");
    expect(preview("fin-col-profit").textContent).toContain("이익률-152.4%");
    expect(preview("fin-col-profit").textContent).toContain("계약2건");
    expect(preview("fin-col-work").textContent).toBe("진행 9 · 수납완료 1장기관리 6");
    // 미리보기가 있어도 칸 아래 상세 패널은 닫혀 있다.
    expect((document.querySelector("#fin-detail-panel") as HTMLElement).hidden).toBe(true);
  });

  it("추가 비용을 못 읽으면 미리보기도 0원으로 대신하지 않는다", () => {
    render({ additionalCost: null });
    const text = byId("fin-col-cost").querySelector("[data-finance-preview]")!.textContent ?? "";
    expect(text).toContain("확인 못 했어요");
    expect(text).not.toMatch(/추가 비용0원/);
  });

  it("진행건 칸을 누르면 그 칸 아래에만 실무/수납과 같은 진행 막대가 열리고, 다른 칸을 열면 닫힌다", () => {
    const view = render({ work: work() });
    act(() => byId("fin-col-work").click());
    expect(byId("fin-col-work").getAttribute("aria-expanded")).toBe("true");
    const panel = view.querySelector<HTMLElement>("#fin-detail-panel")!;
    expect(panel.getAttribute("aria-labelledby")).toBe("fin-col-work");
    expect(view.querySelector("[data-finance-work-column]")!.contains(panel)).toBe(true);
    expect(panel.querySelector("[data-work-status-bar]")).not.toBeNull();
    expect(document.querySelectorAll("button button").length).toBe(0);
    act(() => byId("fin-col-revenue").click());
    expect(byId("fin-col-work").getAttribute("aria-expanded")).toBe("false");
    expect(view.querySelector("[data-work-status-bar]")).toBeNull();
    act(() => byId("fin-col-revenue").click());
    expect((view.querySelector("#fin-detail-panel") as HTMLElement).hidden).toBe(true);
  });

  it("불러오는 중·실패도 칸을 지키고 실패면 다시 시도", () => {
    const onRetry = vi.fn();
    render({ work: work({ items: null }) });
    expect(byId("fin-col-work").textContent).toContain("—");
    act(() => root?.render(createElement(FinanceSummaryBoxes, { ...baseProps, work: work({ items: null, failed: true, onRetry }) })));
    expect(byId("fin-col-work").textContent).toContain("불러오지 못했어요");
    act(() => byId("fin-col-work").click());
    const retry = [...document.querySelectorAll<HTMLButtonElement>("#fin-detail-panel button")].find((b) => b.textContent === "다시 시도");
    act(() => retry?.click());
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("상태별 건수 두 줄 — 0건은 빼고 막대 순서", () => {
    expect(workPreviewLines([])).toEqual(["진행건 없음"]);
    expect(workPreviewLines([item("longterm", 1)])).toEqual(["장기관리 1"]);
    expect(workPreviewLines(ITEMS)).toEqual(["진행 9 · 수납완료 1", "장기관리 6"]);
  });
});

describe("A안 대시보드 배치(소스)", () => {
  const page = readFileSync("app/(app)/dashboard/page.tsx", "utf8");
  const css = readFileSync("components/dashboard/dashboard-action-overview.css", "utf8");
  const banner = readFileSync("components/dashboard/DashboardProgressBanner.tsx", "utf8");

  it("진행 줄과 기간 칩이 같은 윗줄 — 진행 왼쪽, 칩 오른쪽(PC), 폰은 선 아래 칩", () => {
    const top = page.slice(page.indexOf('data-testid="dashboard-hero-top"'), page.indexOf("<DashboardFinance"));
    expect(top.indexOf("<DashboardProgressBanner")).toBeGreaterThan(0);
    expect(top.indexOf("<PeriodPicker")).toBeGreaterThan(top.indexOf("<DashboardProgressBanner"));
    expect(page).toContain('className="pc:flex pc:flex-wrap pc:items-center" data-testid="dashboard-hero-top"');
    expect(top).toMatch(/data-testid="dashboard-period-chips"[\s\S]*border-t[\s\S]*pc:ml-auto[\s\S]*pc:border-t-0/);
    // 칩 상태는 페이지가 갖고 재무는 그 기간으로만 계산(칩 한 벌).
    expect(page).toContain("periodState={financePeriod}");
    expect(page.match(/<PeriodPicker/g)).toHaveLength(1);
    expect(page).toContain("work={work}");
  });

  it("아래 진행건 판은 PC 에서만 숨기고 폰 순서는 그대로", () => {
    expect(css).toMatch(/@media \(min-width: 1024px\) \{\s*\.dashboard-work-status-slot \{ display: none; \}/);
    const mobile = css.slice(css.indexOf("@media (max-width: 1023.98px)"));
    expect(mobile).toContain(".dashboard-work-status-slot { order: 4; }");
  });

  it("PC 진행 줄은 시작·종강총회 글을 빼고 D-day 는 남긴다", () => {
    expect(banner).toContain('<span className="text-slate-400 pc:hidden">{startDate} 시작</span>');
    expect(banner).toContain('<span className="text-slate-500 pc:hidden">🎓 {graduationDate} 종강총회</span>');
    expect(banner).toContain("<DDayBadge graduationISO={graduationISO} />");
  });
});
