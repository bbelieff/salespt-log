// @vitest-environment jsdom

import * as React from "react";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import FinanceSummaryBoxes, { calcSingleLineScale } from "@/components/dashboard/FinanceSummaryBoxes";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const baseProps = {
  revenue: 12_345_678,
  cost: 3_500_000,
  feeIncome: 10_345_678,
  commissionIncome: 2_000_000,
  dbCostTotal: 3_000_000,
  additionalCost: 500_000 as number | null,
  onOpenExpenseLedger: () => {},
  weeks: 8,
  contractCount: 12,
  carryoverRevenue: 1_000_000,
  totalRevenue: 13_345_678,
  carryoverCost: 200_000,
  totalCost: 3_700_000,
};

let root: Root | undefined;
let container: HTMLDivElement | undefined;

function render(element: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(element));
  return container;
}

function rerender(element: ReactNode) {
  act(() => root?.render(element));
}

function column(id: string) {
  const button = document.querySelector<HTMLButtonElement>(`#${id}`);
  if (!button) throw new Error(`column '${id}' is missing`);
  return button;
}

function amountOf(id: string) {
  const button = column(id);
  const amount = [...button.querySelectorAll("span")].find((s) => s.textContent?.includes("₩"));
  if (!amount) throw new Error(`amount in '${id}' is missing`);
  return amount as HTMLSpanElement;
}

function clickColumn(id: string) {
  act(() => column(id).click());
}

function panel() {
  const region = document.querySelector<HTMLElement>("#fin-detail-panel");
  if (!region) throw new Error("detail panel is missing");
  return region;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("finance three-column row", () => {
  it("renders three equal columns in one row with labels above full untruncated amounts", () => {
    const view = render(createElement(FinanceSummaryBoxes, { ...baseProps }));
    const group = view.querySelector('[role="group"][aria-label="매출·비용·영업이익"]');
    expect(group).not.toBeNull();
    expect(group?.className).toContain("grid-cols-3");

    for (const id of ["fin-col-revenue", "fin-col-cost", "fin-col-profit"]) {
      const button = column(id);
      expect(button.getAttribute("aria-expanded")).toBe("false");
      expect(button.getAttribute("aria-controls")).toBe("fin-detail-panel");
      // 라벨이 금액보다 먼저 나온다.
      const label = [...button.querySelectorAll("span")].find((s) => ["매출", "비용", "영업이익"].includes(s.textContent ?? ""));
      const amount = [...button.querySelectorAll("span")].find((s) => s.textContent?.includes("₩"));
      expect(label).not.toBeNull();
      expect(amount).not.toBeNull();
      expect(label!.compareDocumentPosition(amount!) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    }

    // 전체 금액 그대로 — 축약·절단 없음.
    expect(view.textContent).toContain("₩12,345,678");
    expect(view.textContent).toContain("₩3,500,000");
    expect(view.textContent).toContain("₩8,845,678"); // 영업이익 = 매출 − 비용

    // 한 줄 보장: 잘라 숨기기(truncate/ellipsis/overflow-hidden) · anywhere 분할 금지.
    // 금액 자체는 white-space:nowrap 한 줄이 정본이다.
    const html = view.innerHTML;
    expect(html).not.toContain("truncate");
    expect(html).not.toContain("ellipsis");
    expect(html).not.toContain("overflow-hidden");
    expect(html).not.toContain("overflow:hidden");
    expect(html).not.toContain("anywhere");
    for (const id of ["fin-col-revenue", "fin-col-cost", "fin-col-profit"]) {
      const amount = amountOf(id);
      expect(amount.style.whiteSpace).toBe("nowrap");
      expect(amount.style.overflowWrap).toBe("normal");
      expect(amount.style.overflow).toBe("");
      expect(amount.style.textOverflow).toBe("");
      // 접근성 텍스트는 전체 금액 그대로.
      expect(amount.textContent).toMatch(/₩-?[\d,]+/);
    }
    expect(panel().hidden).toBe(true);
  });

  it("keeps the longest positive and negative amounts on one line with full text", () => {
    const view = render(
      createElement(FinanceSummaryBoxes, {
        ...baseProps,
        revenue: 99_999_999,
        cost: 99_999_999,
        carryoverRevenue: 0,
        totalRevenue: 99_999_999,
        carryoverCost: 0,
        totalCost: 99_999_999,
      }),
    );
    // 양수 최댓값 전체 표시 (₩99,999,999).
    expect(view.textContent).toContain("₩99,999,999");
    for (const id of ["fin-col-revenue", "fin-col-cost", "fin-col-profit"]) {
      expect(amountOf(id).style.whiteSpace).toBe("nowrap");
    }

    // 음수 최댓값: 매출 0 − 비용 99,999,999 = ₩-99,999,999, 부호 포함 전체.
    rerender(
      createElement(FinanceSummaryBoxes, {
        ...baseProps,
        revenue: 0,
        cost: 99_999_999,
        carryoverRevenue: 0,
        totalRevenue: 0,
        carryoverCost: 0,
        totalCost: 99_999_999,
      }),
    );
    const neg = view.querySelector("#fin-col-profit [data-profit-sign]");
    expect(neg?.getAttribute("data-profit-sign")).toBe("negative");
    expect(neg?.textContent).toContain("-99,999,999");
    expect((neg as HTMLElement).style.whiteSpace).toBe("nowrap");
    expect((neg as HTMLElement).style.overflowWrap).toBe("normal");
    // 잘라 숨기기 없음.
    expect(view.innerHTML).not.toContain("anywhere");
    expect(view.innerHTML).not.toContain("overflow-hidden");
  });

  it("keeps single-line fit when the value updates to the longest amount", () => {
    const view = render(createElement(FinanceSummaryBoxes, { ...baseProps }));
    expect(amountOf("fin-col-revenue").textContent).toContain("12,345,678");
    rerender(createElement(FinanceSummaryBoxes, { ...baseProps, revenue: 99_999_999 }));
    const amount = amountOf("fin-col-revenue");
    expect(amount.textContent).toContain("₩99,999,999");
    expect(amount.style.whiteSpace).toBe("nowrap");
    expect(view.innerHTML).not.toContain("anywhere");
  });

  it("computes the single-line scale purely: fits when narrow, keeps base when wide", () => {
    expect(calcSingleLineScale(80, 200)).toBeLessThan(1);
    expect(calcSingleLineScale(80, 200)).toBeGreaterThanOrEqual(0.55);
    expect(calcSingleLineScale(200, 80)).toBe(1);
    expect(calcSingleLineScale(0, 200)).toBe(1);
    expect(calcSingleLineScale(80, 0)).toBe(1);
  });

  it("shrinks all three amounts uniformly on observer resize and disconnects on unmount", () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    let roCallback: ResizeObserverCallback | null = null;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: ResizeObserverCallback) {
          roCallback = cb;
        }
        observe = observe;
        unobserve = vi.fn();
        disconnect = disconnect;
      },
    );
    render(createElement(FinanceSummaryBoxes, { ...baseProps }));
    // 컨테이너·컬럼·금액을 관찰한다.
    expect(observe).toHaveBeenCalled();
    expect(roCallback).not.toBeNull();

    const ids = ["fin-col-revenue", "fin-col-cost", "fin-col-profit"];
    const cols = ids.map((id) => document.getElementById(id) as HTMLElement);
    const amounts = ids.map((id) => amountOf(id));
    // 좁은 컬럼(80px)에 넓은 텍스트(200px) 강제 — Range/rect는 jsdom에서 0이므로
    // scrollWidth/clientWidth 폴백 경로로 실측한다.
    for (const col of cols) {
      Object.defineProperty(col, "clientWidth", { value: 80, configurable: true });
    }
    for (const amt of amounts) {
      Object.defineProperty(amt, "scrollWidth", { value: 200, configurable: true });
    }
    act(() => {
      roCallback?.([], {} as unknown as ResizeObserver);
    });
    const sizes = amounts.map((a) => a.style.fontSize);
    // 넘칠 때만 축소하고 3열 모두 같은 폰트로 맞춘다.
    expect(sizes.every((s) => s.endsWith("px"))).toBe(true);
    expect(new Set(sizes).size).toBe(1);
    for (const amt of amounts) {
      expect(amt.style.whiteSpace).toBe("nowrap");
      expect(amt.textContent).toMatch(/₩-?[\d,]+/);
    }

    // 정리: 관찰자 해제 (중복 unmount 방지를 위해 root 비움).
    act(() => root?.unmount());
    root = undefined;
    expect(disconnect).toHaveBeenCalled();
  });

  it("keeps the profit detail table amounts on one line up to 8 digits", () => {
    render(
      createElement(FinanceSummaryBoxes, {
        ...baseProps,
        revenue: 12_345_678,
        cost: 3_500_000,
        carryoverRevenue: 10_000_000,
        totalRevenue: 22_345_678,
        carryoverCost: 1_000_000,
        totalCost: 4_500_000,
      }),
    );
    clickColumn("fin-col-profit");
    const table = document.querySelector('[data-testid="fin-profit-table"]');
    expect(table).not.toBeNull();
    const html = table?.innerHTML ?? "";
    expect(html).not.toContain("anywhere");
    // 숫자 셀은 모두 nowrap 한 줄 + 전체 금액.
    const cells = [...(table?.querySelectorAll("span") ?? [])].filter((s) =>
      s.textContent?.includes("₩"),
    ) as HTMLSpanElement[];
    expect(cells.length).toBe(6);
    for (const cell of cells) {
      expect(cell.style.whiteSpace).toBe("nowrap");
    }
    const text = table?.textContent ?? "";
    expect(text).toContain("₩12,345,678");
    expect(text).toContain("₩10,000,000");
    expect(text).toContain("₩22,345,678");
    // 숫자열 우선 폭: 행 라벨열이 좁고 숫자 3열이 균등 분할.
    expect(table?.className).toContain("grid-cols-[2.5rem_repeat(3,minmax(0,1fr))]");
  });

  it("opens one detail panel at a time below the row and closes on second click", () => {
    render(createElement(FinanceSummaryBoxes, { ...baseProps }));

    clickColumn("fin-col-revenue");
    expect(column("fin-col-revenue").getAttribute("aria-expanded")).toBe("true");
    expect(panel().hidden).toBe(false);
    expect(panel().getAttribute("aria-labelledby")).toBe("fin-col-revenue");
    expect(panel().textContent).toContain("수임비");
    expect(panel().textContent).toContain("수수료");

    // 다른 컬럼을 열면 이전 패널은 닫힌다.
    clickColumn("fin-col-cost");
    expect(column("fin-col-revenue").getAttribute("aria-expanded")).toBe("false");
    expect(column("fin-col-cost").getAttribute("aria-expanded")).toBe("true");
    expect(panel().getAttribute("aria-labelledby")).toBe("fin-col-cost");
    expect(panel().textContent).toContain("DB 비용 합계");
    expect(panel().textContent).not.toContain("수수료");

    // 같은 컬럼을 다시 누르면 닫힌다.
    clickColumn("fin-col-cost");
    expect(column("fin-col-cost").getAttribute("aria-expanded")).toBe("false");
    expect(panel().hidden).toBe(true);
  });

  it("colors nonnegative profit blue and negative profit violet, never cost red", () => {
    const view = render(createElement(FinanceSummaryBoxes, { ...baseProps }));
    const ok = view.querySelector("#fin-col-profit [data-profit-sign]");
    expect(ok?.getAttribute("data-profit-sign")).toBe("nonnegative");
    // jsdom은 style 속성의 hex를 rgb로 정규화한다: #1d4ed8 = rgb(29, 78, 216).
    expect(ok?.getAttribute("style")).toContain("rgb(29, 78, 216)");
    // 비용 빨강과 같은 색이 아니다.
    expect(ok?.getAttribute("style")).not.toContain("red");
    expect(ok?.className).not.toContain("text-red");
  });

  it("colors negative profit violet and preserves the minus sign", () => {
    const view = render(
      createElement(FinanceSummaryBoxes, { ...baseProps, revenue: 1_000_000, cost: 7_500_000 }),
    );
    const neg = view.querySelector("#fin-col-profit [data-profit-sign]");
    expect(neg?.getAttribute("data-profit-sign")).toBe("negative");
    // #7c3aed = rgb(124, 58, 237). 0 이상 파랑 rgb(29, 78, 216)과 다르다.
    expect(neg?.getAttribute("style")).toContain("rgb(124, 58, 237)");
    expect(neg?.getAttribute("style")).not.toContain("rgb(29, 78, 216)");
    // 기존 음수 부호 유지 (₩-6,500,000).
    expect(neg?.textContent).toContain("-6,500,000");
    // 비용 컬럼은 기존 빨강 그대로.
    expect(view.querySelector("#fin-col-cost span.text-red-600")).not.toBeNull();
  });

  it("keeps margin, season/carryover/total, weeks, and contract count in the profit panel", () => {
    render(createElement(FinanceSummaryBoxes, { ...baseProps }));
    clickColumn("fin-col-profit");
    const text = panel().textContent ?? "";
    // 이익률 = (12,345,678 − 3,500,000) / 12,345,678 × 100 = 71.6%
    expect(text).toContain("이익률");
    expect(text).toContain("71.6%");
    expect(text).toContain("8주 누적");
    expect(text).toContain("계약 12건");
    expect(text).toContain("시즌");
    expect(text).toContain("이월");
    expect(text).toContain("전체");
    expect(text).toContain("₩12,345,678"); // 시즌 매출
    expect(text).toContain("₩1,000,000"); // 이월 매출
    expect(text).toContain("₩13,345,678"); // 전체 매출
    expect(text).toContain("₩200,000"); // 이월 비용
    expect(text).toContain("₩3,700,000"); // 전체 비용
  });

  it("keeps fee/commission revenue detail and the ledger entry inside cost detail", () => {
    const onOpenExpenseLedger = vi.fn();
    render(createElement(FinanceSummaryBoxes, { ...baseProps, onOpenExpenseLedger }));
    clickColumn("fin-col-revenue");
    expect(panel().textContent).toContain("₩10,345,678");
    expect(panel().textContent).toContain("₩2,000,000");

    clickColumn("fin-col-cost");
    expect(panel().textContent).toContain("DB 비용 합계 ₩3,000,000");
    const trigger = panel().querySelector<HTMLButtonElement>('button[aria-label="추가 비용: 비용 원장 열기"]');
    expect(trigger?.textContent).toContain("추가 비용");
    expect(trigger?.textContent).toContain("₩500,000");
    act(() => trigger?.click());
    expect(onOpenExpenseLedger).toHaveBeenCalledOnce();
  });

  it("shows the null additional-cost error inside cost detail without inventing zero", () => {
    render(createElement(FinanceSummaryBoxes, { ...baseProps, additionalCost: null }));
    clickColumn("fin-col-cost");
    expect(panel().textContent).toContain("추가 비용을 확인하지 못했습니다. 다시 시도해 주세요.");
    expect(panel().textContent).not.toContain("추가 비용 ₩");
  });

  it("never nests buttons and keeps focus styles on every toggle", () => {
    render(createElement(FinanceSummaryBoxes, { ...baseProps }));
    expect(document.querySelectorAll("button button").length).toBe(0);
    for (const id of ["fin-col-revenue", "fin-col-cost", "fin-col-profit"]) {
      clickColumn(id);
      expect(document.querySelectorAll("button button").length).toBe(0);
      expect(column(id).className).toContain("focus-visible:ring-2");
      clickColumn(id); // 닫고 다음으로
    }
  });
});
