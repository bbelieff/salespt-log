// @vitest-environment jsdom

import * as React from "react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

// belie 2026-10-13 — 문장과 빈 자리 없이 기존 기간 계산·숫자·실패 안내를 유지한다.
const slot = { 진행기관: "", 진행상품: "", 진행률: "", 현황: "", 승인금액: 0, 수납액: 0, 수납일: "", 메모: "" };
const contract = (계약일: string, 수임비: number) => ({ 계약일, 업체명: "샘플상사", 수임비, 수납1: slot, 수납2: slot, 수납3: slot, 반환액: 0, 해지일: "" });

const state = vi.hoisted(() => ({ contracts: "ok" as "ok" | "pending" | "error", ledger: "ok" as "ok" | "pending" | "error" }));

vi.mock("@/query/contract-payment-hooks", () => ({
  useContractPayments: () => ({
    data: state.contracts === "ok" ? { rows: [contract("2026-10-05", 1_500_000), contract("2026-08-10", 1_000_000)] } : undefined,
    isError: state.contracts === "error",
    refetch: vi.fn(),
  }),
}));
vi.mock("@/query/db-hooks", () => ({
  useDBOverview: () => ({
    data: { purchases: [{ 구매일: "2026-10-06", 주문금액: 905_480 }, { 구매일: "2026-08-12", 주문금액: 400_000 }], productions: [], banners: [] },
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/query/expense-ledger-hooks", () => ({
  useExpenseLedger: () => ({
    data: state.ledger === "ok" ? { entries: [] } : undefined,
    isLoading: state.ledger === "pending",
    isError: state.ledger === "error",
  }),
}));

import DashboardFinance from "@/components/dashboard/DashboardFinance";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

function render() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(createElement(DashboardFinance, { onOpenExpenseLedger: () => {} })));
  return container;
}
const rerender = () => act(() => root?.render(createElement(DashboardFinance, { onOpenExpenseLedger: () => {} })));
const headline = () => container?.querySelector<HTMLParagraphElement>("[data-card-headline]") ?? null;
const chip = (label: string) => {
  const el = [...(container?.querySelectorAll("button[aria-pressed]") ?? [])].find((b) => b.textContent === label);
  if (!(el instanceof HTMLButtonElement)) throw new Error(`chip '${label}' is missing`);
  return el;
};

beforeEach(() => {
  // KST 2026-10-15(목) 정오 — 「이번 달」=10월, 「이번 주」=10/12~10/18.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T03:00:00Z"));
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  state.contracts = "ok";
  state.ledger = "ok";
  vi.useRealTimers();
});

const amount = (name: "revenue" | "cost" | "profit") => container?.querySelector(`#fin-col-${name}`)?.textContent;

describe("DashboardFinance without the deferred headline", () => {
  it("문장·예약 공간 없이 전체 기간 매출·비용·영업이익을 표시한다", () => {
    render();
    expect(headline()).toBeNull();
    expect(amount("revenue")).toContain("₩2,500,000");
    expect(amount("cost")).toContain("₩1,305,480");
    expect(amount("profit")).toContain("₩1,194,520");
    expect(container?.querySelector(".fx-skeleton")).toBeNull();
  });

  it("기간 변경 시 세 숫자를 다시 계산하고 문장 자리를 만들지 않는다", () => {
    render();
    act(() => chip("이번 달").click());
    expect(amount("revenue")).toContain("₩1,500,000");
    expect(amount("cost")).toContain("₩905,480");
    expect(amount("profit")).toContain("₩594,520");
    act(() => chip("이번 주").click());
    for (const name of ["revenue", "cost", "profit"] as const) expect(amount(name)).toContain("₩0");
    act(() => chip("직접 설정").click());
    expect(amount("profit")).toContain("₩1,194,520"); // 날짜를 덜 고르면 전체 기간
    expect(headline()).toBeNull();
  });

  it("경비장부 실패 시 기존 매출을 유지하고 비용 상세에 확인 실패를 알린다", () => {
    state.ledger = "error";
    render();
    expect(headline()).toBeNull();
    expect(amount("revenue")).toContain("₩2,500,000");
    act(() => container?.querySelector<HTMLButtonElement>("#fin-col-cost")?.click());
    expect(container?.textContent).toContain("추가 비용을 확인하지 못했습니다");
  });

  it("불러오는 중엔 로딩 안내만, 응답 뒤 세 숫자를 표시한다", () => {
    state.contracts = "pending";
    render();
    expect(headline()).toBeNull();
    expect(container?.querySelector(".fx-skeleton")).toBeNull();
    expect(container?.textContent).toContain("불러오는 중…");
    expect(amount("revenue")).toBeUndefined();
    state.contracts = "ok";
    rerender();
    expect(headline()).toBeNull();
    expect(amount("profit")).toContain("₩1,194,520");
  });

  it("경비장부만 불러오는 중이어도 로딩 안내를 유지한다", () => {
    state.ledger = "pending";
    render();
    expect(headline()).toBeNull();
    expect(container?.textContent).toContain("불러오는 중…");
    expect(amount("cost")).toBeUndefined();
  });

  it("실패하면 숫자 대신 실패 안내와 다시 시도를 제공한다", () => {
    state.contracts = "error";
    render();
    expect(headline()).toBeNull();
    expect(amount("revenue")).toBeUndefined();
    expect(container?.textContent).toContain("매출·비용을 불러오지 못했어요.");
    expect(container?.textContent).toContain("다시 시도");
  });
});
