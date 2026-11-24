// @vitest-environment jsdom
/**
 * 대시보드 맨 위 띠 A안(belie 2026-11-13 승인):
 *  - PC: 진행 줄과 기간 칩이 한 줄(진행 왼쪽·칩 오른쪽), 재무는 매출·비용·영업이익·진행건 네 칸 + 칸 아래 미리보기 두 줄.
 *    2026-11-16: 진행건 칸은 늘 펼침(버튼 아님), 연 칸의 미리보기는 숨김, 폰·태블릿 영업이익 상세는 세 칸 전체 폭.
 *  - 아래 「전체 진행건」 판은 PC 에서 숨긴다(띠로 올라감). 폰(1024 미만)은 지금 그대로 — 세 칸 숫자, 미리보기·네 번째 칸 숨김.
 */
import * as React from "react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import FinanceSummaryBoxes from "@/components/dashboard/FinanceSummaryBoxes";
import type { WorkColumnData } from "@/components/dashboard/FinanceWorkColumn";
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
  vi.unstubAllGlobals();
});
const byId = (id: string) => document.getElementById(id) as HTMLButtonElement;

/** 화면 폭 흉내 — jsdom 에는 matchMedia 가 없어 기본은 폰(1024 미만)으로 본다. */
function stubPc(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
}

describe("A안 네 칸 + 미리보기 (FinanceSummaryBoxes)", () => {
  it("진행건이 오면 PC 네 칸 균등, 네 번째 칸은 폰에서 숨는다", () => {
    const view = render({ work: work() });
    const group = view.querySelector('[role="group"][aria-label="매출·비용·영업이익"]')!;
    expect(group.className).toContain("grid-cols-3");
    expect(group.className).toContain("pc:grid-cols-4");
    expect(group.children).toHaveLength(4);
    const col = view.querySelector("[data-finance-work-column]")!;
    expect(col.className.split(" ")).toEqual(expect.arrayContaining(["hidden", "pc:flex"]));
    const head = byId("fin-col-work");
    expect(head.textContent).toContain("진행건");
    expect(head.textContent).toContain("16건");
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
    for (const id of ["fin-col-revenue", "fin-col-cost", "fin-col-profit"]) {
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
    // 미리보기가 있어도 칸 아래 상세 패널은 닫혀 있다.
    expect((document.querySelector("#fin-detail-panel") as HTMLElement).hidden).toBe(true);
  });

  it("추가 비용을 못 읽으면 미리보기도 0원으로 대신하지 않는다", () => {
    render({ additionalCost: null });
    const text = byId("fin-col-cost").querySelector("[data-finance-preview]")!.textContent ?? "";
    expect(text).toContain("확인 못 했어요");
    expect(text).not.toMatch(/추가 비용0원/);
  });

  it("칸을 열면 그 칸 미리보기만 숨는다 — 같은 내용이 미리보기와 상세에 두 번 나오지 않게(2026-11-16)", () => {
    stubPc(true);
    const view = render({ work: work() });
    const has = (id: string) => byId(id).querySelector("[data-finance-preview]") !== null;
    const panelText = () => view.querySelector("#fin-detail-panel")!.textContent ?? "";
    act(() => byId("fin-col-revenue").click());
    expect([has("fin-col-revenue"), has("fin-col-cost"), has("fin-col-profit")]).toEqual([false, true, true]);
    expect(panelText()).toContain("수임비1,800,000원");
    expect(panelText()).not.toContain("DB 비용");
    act(() => byId("fin-col-cost").click());
    expect([has("fin-col-revenue"), has("fin-col-cost"), has("fin-col-profit")]).toEqual([true, false, true]);
    expect(panelText()).toContain("DB 비용 합계 5,000,000원");
    expect(panelText()).not.toContain("수임비");
    // 매출 상세와 비용 상세는 서로 다른 내용이고, 각각 자기 칸 안에 있다.
    expect(byId("fin-col-cost").parentElement!.contains(view.querySelector("#fin-detail-panel"))).toBe(true);
    act(() => byId("fin-col-cost").click());
    expect([has("fin-col-revenue"), has("fin-col-cost"), has("fin-col-profit")]).toEqual([true, true, true]);
  });

  it("영업이익 상세 — 폰·태블릿은 세 칸 아래 전체 폭, PC 는 그 칸 아래(2026-11-16)", () => {
    const detail = createElement("div", { "data-testid": "profit-detail" }, "채널 표 자리");
    // 폰(matchMedia 없음 = 1024 미만): 칸 묶음 밖, 바로 아래 형제 — 세 칸을 합친 폭.
    let view = render({ profitDetail: detail });
    let group = view.querySelector('[role="group"][aria-label="매출·비용·영업이익"]')!;
    act(() => byId("fin-col-profit").click());
    let panel = view.querySelector<HTMLElement>("#fin-detail-panel")!;
    expect(panel.getAttribute("aria-labelledby")).toBe("fin-col-profit");
    expect(panel.querySelector('[data-testid="profit-detail"]')).not.toBeNull();
    expect(group.contains(panel)).toBe(false);
    expect(group.nextElementSibling).toBe(panel);
    expect(group.children).toHaveLength(3);
    expect(view.querySelectorAll("#fin-detail-panel")).toHaveLength(1);
    // 폰에서도 매출·비용 상세는 지금처럼 누른 칸 아래.
    act(() => byId("fin-col-revenue").click());
    expect(byId("fin-col-revenue").parentElement!.contains(view.querySelector("#fin-detail-panel"))).toBe(true);
    act(() => root?.unmount());
    container?.remove();

    // PC: 영업이익 칸 안(그 칸 아래).
    stubPc(true);
    view = render({ profitDetail: detail, work: work() });
    group = view.querySelector('[role="group"][aria-label="매출·비용·영업이익"]')!;
    act(() => byId("fin-col-profit").click());
    panel = view.querySelector<HTMLElement>("#fin-detail-panel")!;
    expect(byId("fin-col-profit").parentElement!.contains(panel)).toBe(true);
    expect(group.contains(panel)).toBe(true);
    expect(view.querySelectorAll("#fin-detail-panel")).toHaveLength(1);
  });

  it("진행건 칸은 누르지 않아도 실무/수납과 같은 진행 막대가 보이고, 다른 칸을 여닫아도 그대로다(2026-11-16)", () => {
    const view = render({ work: work() });
    const col = view.querySelector("[data-finance-work-column]")!;
    const bar = () => col.querySelector("[data-work-status-bar]");
    expect(bar()).not.toBeNull();
    expect(bar()!.textContent).toContain("진행 9");
    expect(bar()!.textContent).toContain("장기관리 6");
    // 누르는 칸이 아니다 — 여닫는 버튼·미리보기 요약이 없고 상세 패널도 쓰지 않는다.
    expect(byId("fin-col-work").tagName).toBe("DIV");
    expect(col.querySelector("[aria-controls='fin-detail-panel']")).toBeNull();
    expect(col.querySelector("[data-finance-preview]")).toBeNull();
    expect((view.querySelector("#fin-detail-panel") as HTMLElement).hidden).toBe(true);
    expect(document.querySelectorAll("button button").length).toBe(0);
    act(() => byId("fin-col-revenue").click());
    expect(bar()).not.toBeNull();
    expect(col.contains(view.querySelector("#fin-detail-panel"))).toBe(false);
    act(() => byId("fin-col-revenue").click());
    expect(bar()).not.toBeNull();
  });

  it("불러오는 중·실패도 칸을 지키고 실패면 누르지 않아도 다시 시도가 보인다", () => {
    const onRetry = vi.fn();
    const view = render({ work: work({ items: null }) });
    expect(byId("fin-col-work").textContent).toContain("—");
    act(() => root?.render(createElement(FinanceSummaryBoxes, { ...baseProps, work: work({ items: null, failed: true, onRetry }) })));
    const col = view.querySelector("[data-finance-work-column]")!;
    expect(byId("fin-col-work").textContent).toContain("—");
    expect(col.textContent).toContain("불러오지 못했어요");
    const retry = [...col.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "다시 시도");
    act(() => retry?.click());
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe("A안 대시보드 배치(소스)", () => {
  const page = readFileSync("app/(app)/dashboard/page.tsx", "utf8");
  const css = readFileSync("components/dashboard/dashboard-action-overview.css", "utf8");
  const banner = readFileSync("components/dashboard/DashboardProgressBanner.tsx", "utf8");

  it("진행 줄과 기간 칩이 같은 윗줄 — 진행 왼쪽, 칩 오른쪽(PC). 폰은 칩이 매출·비용 띠의 머리(2026-11-24)", () => {
    const top = page.slice(page.indexOf('data-testid="dashboard-hero"'), page.indexOf("<DashboardFinance"));
    expect(top.indexOf("<DashboardProgressBanner")).toBeGreaterThan(0);
    expect(top.indexOf("<PeriodPicker")).toBeGreaterThan(top.indexOf("<DashboardProgressBanner"));
    // PC 윗줄 배치는 CSS(.dash-hero flex-wrap · 진행 flex 1 1 24rem)가 맡고, 칩은 오른쪽 끝으로 민다.
    expect(css).toContain(".dash-hero { display: flex; flex-wrap: wrap; align-items: center; }");
    expect(css).toContain(".dash-hero > .dash-hero-progress { flex: 1 1 24rem;");
    expect(top).toMatch(/data-testid="dashboard-period-chips"[\s\S]*pc:ml-auto[\s\S]*pc:justify-end/);
    // 칩과 재무는 폰에서 한 띠(dash-hero-money) 안에 있다.
    expect(top.indexOf("dash-hero-money")).toBeLessThan(top.indexOf('data-testid="dashboard-period-chips"'));
    // 칩 상태는 페이지가 갖고 재무는 그 기간으로만 계산(칩 한 벌).
    expect(page).toContain("periodState={financePeriod}");
    expect(page.match(/<PeriodPicker/g)).toHaveLength(1);
    expect(page).toContain("work={work}");
  });

  it("아래 진행건 판은 PC 에서만 숨기고 폰은 주간 목표 다음 자리 그대로", () => {
    expect(css).toMatch(/@media \(min-width: 1024px\) \{\s*\.dashboard-work-status-slot \{ display: none; \}/);
    const overview = readFileSync("components/dashboard/DashboardActionOverview.tsx", "utf8");
    expect(overview.indexOf("dashboard-action-goals")).toBeLessThan(overview.indexOf("dashboard-work-status-slot"));
    expect(overview.indexOf("dashboard-work-status-slot")).toBeLessThan(overview.indexOf("dashboard-action-productivity"));
  });

  it("진행 줄은 어느 폭에서도 한 줄 — 시작·종강총회 글은 빼고 D-day 는 남긴다(폰도 압축, 2026-11-24)", () => {
    expect(banner).not.toContain("{startDate} 시작");
    expect(banner).not.toContain("{graduationDate} 종강총회");
    expect(banner).toContain('className="flex items-center gap-2.5 px-3 py-2.5 pc:gap-4"');
    // 폰 순서: 주차 → 진행률 → 진행바 → D-day. PC 는 진행바가 진행률 앞.
    expect(banner).toContain("order-2 shrink-0 whitespace-nowrap text-xs font-bold text-red-700 pc:order-4");
    expect(banner).toContain("relative order-3 h-1.5 min-w-0 flex-1");
    expect(banner).toContain("<DDayBadge graduationISO={graduationISO} />");
  });
});
