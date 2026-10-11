// @vitest-environment jsdom

import * as React from "react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

// belie 2026-10-12 #8 — DashboardFinance 의 한 줄 문장: 기간 칩 전환·경비장부 실패·불러오는 중·실패.
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

describe("DashboardFinance headline", () => {
  it("기본 「전체」 → 지금까지 + 영업이익, 이모지는 aria-hidden, polite 알림 자리", () => {
    render();
    const p = headline();
    expect(p?.textContent).toBe("지금까지 1,194,520원을 남겼어요 💰");
    expect(p?.getAttribute("aria-live")).toBe("polite");
    expect(p?.querySelector('span[aria-hidden="true"]')?.textContent).toBe(" 💰");
  });

  it("기간 칩을 바꾸면 같은 자리에서 접두어·금액이 바로 바뀐다", () => {
    render();
    const before = headline();
    act(() => chip("이번 달").click());
    expect(headline()?.textContent).toBe("10월에 594,520원을 남겼어요 💰");
    act(() => chip("이번 주").click());
    expect(headline()?.textContent).toBe("이번 주에 기록된 매출·비용이 없어요");
    act(() => chip("직접 설정").click());
    expect(headline()?.textContent).toBe("지금까지 1,194,520원을 남겼어요 💰"); // 날짜를 덜 고르면 전체 기간
    expect(headline()).toBe(before); // live region 은 갈아끼우지 않는다
  });

  it("경비장부를 못 읽으면 영업이익 대신 매출만 말한다", () => {
    state.ledger = "error";
    render();
    expect(headline()?.textContent).toBe("지금까지 매출 2,500,000원을 올렸어요");
  });

  it("불러오는 중엔 문장 대신 회색 줄 — 다 불러오면 같은 자리(노드)에 문장", () => {
    state.contracts = "pending";
    render();
    const p = headline();
    expect(p?.textContent).toBe("");
    expect(p?.querySelector(".fx-skeleton")).not.toBeNull();
    expect(container?.textContent).toContain("불러오는 중…");
    state.contracts = "ok";
    rerender();
    expect(headline()).toBe(p);
    expect(p?.textContent).toBe("지금까지 1,194,520원을 남겼어요 💰");
  });

  it("경비장부만 불러오는 중이어도 문장은 아직 없다", () => {
    state.ledger = "pending";
    render();
    expect(headline()?.textContent).toBe("");
  });

  it("실패하면 문장 자리 없이 「다시 시도」만", () => {
    state.contracts = "error";
    render();
    expect(headline()).toBeNull();
    expect(container?.textContent).toContain("다시 시도");
  });
});
