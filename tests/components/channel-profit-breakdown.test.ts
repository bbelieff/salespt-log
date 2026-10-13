// @vitest-environment jsdom

// 2026-10-12 #7 — 영업이익 상세 「채널별 남은 돈」 표시: 줄 순서·표기·색·문장·링크·버튼·실패 상태.
import * as React from "react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChannelProfit, ChannelProfitTable } from "@/components/dashboard/channel-profit";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
vi.mock("next/link", () => ({ default: (props: React.ComponentProps<"a">) => React.createElement("a", props) }));

import ChannelProfitBreakdown from "@/components/dashboard/ChannelProfitBreakdown";

const b = (key: ChannelProfit["key"], contracts: number, revenue: number, cost: number): ChannelProfit => ({ key, contracts, revenue, cost, left: revenue - cost });
const table = (over: Partial<ChannelProfitTable> = {}): ChannelProfitTable => ({
  channels: [b("매입DB", 2, 3_500_000, 4_000_000), b("직접생산", 1, 500_000, 2_500_000), b("현수막", 3, 7_500_000, 2_200_000), b("콜·지·기·소", 1, 5_500_000, 0)],
  manual: b("manual", 1, 1_200_000, 0),
  unknown: b("unknown", 1, 400_000, 0),
  pending: b("pending", 0, 0, 0),
  ...over,
});
const base = { table: table(), revenue: 18_600_000, dbCost: 8_700_000, additionalCost: 600_000 as number | null, onOpenExpenseLedger: () => {} };

let root: Root | undefined;
let container: HTMLDivElement | undefined;
function render(props: Partial<typeof base> & { refreshing?: boolean } = {}) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(createElement(ChannelProfitBreakdown, { ...base, ...props })));
  return container;
}
afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

const cells = (tr: Element | null | undefined) => [...(tr?.querySelectorAll("td") ?? [])];
const shown = (td: Element | undefined) => td?.querySelector('[aria-hidden="true"]')?.textContent ?? td?.textContent;

describe("ChannelProfitBreakdown", () => {
  it("문장 + 표: 4채널 고정 순서 → 영업기록 없음 → 채널 모름 → 추가 비용, 합계 줄", () => {
    const view = render();
    expect(view.querySelector("p")?.textContent).toBe("현수막에 쓴 돈의 3.4배를 벌었어요");
    const tableEl = view.querySelector('[data-testid="fin-channel-profit"]');
    expect(tableEl?.querySelector("caption")?.textContent).toBe("채널별 남은 돈");
    const order = [...(tableEl?.querySelectorAll("tbody tr") ?? [])].map((tr) => tr.getAttribute("data-channel") ?? tr.getAttribute("data-row"));
    expect(order).toEqual(["매입DB", "직접생산", "현수막", "콜·지·기·소", "manual", "unknown", "extra"]);
    const total = view.querySelector('[data-row="total"]');
    expect(cells(total).map(shown)).toEqual(["1,860만", "930만", "930만"]);
    expect(view.textContent).toContain("추가 비용은 채널에 나누지 않았어요 · 만원 단위로 반올림했어요");
  });

  it("비용 0 → 「—」, 남은 돈 색(0 이상 파랑·음수 보라), 문장 채널 줄만 bg-blue-50", () => {
    const view = render();
    const row = (ch: string) => view.querySelector(`[data-channel="${ch}"]`);
    expect(shown(cells(row("콜·지·기·소"))[1])).toBe("—");
    expect(cells(row("매입DB"))[2]?.className).toContain("text-violet-600");
    expect(shown(cells(row("매입DB"))[2])).toBe("−50만");
    expect(cells(row("현수막"))[2]?.className).toContain("text-blue-700");
    expect(row("현수막")?.className).toContain("bg-blue-50");
    expect(row("콜·지·기·소")?.className).not.toContain("bg-blue-50");
    expect(row("현수막")?.textContent).toContain("계약 3건");
  });

  it("전체 금액은 title 과 화면 읽기 글자로 함께", () => {
    const view = render();
    const left = cells(view.querySelector('[data-channel="매입DB"]'))[2];
    expect(left?.getAttribute("title")).toBe("−₩500,000");
    expect(left?.querySelector(".sr-only")?.textContent).toBe("−₩500,000");
  });

  it("영업기록 없음 › = /payment 링크, 채널 모름은 링크 없이 설명", () => {
    const view = render();
    const link = view.querySelector<HTMLAnchorElement>('[data-row="manual"] a');
    expect(link?.getAttribute("href")).toBe("/payment");
    expect(link?.getAttribute("aria-label")).toBe("영업기록 없이 추가한 계약: 실무/수납에서 영업기록 연결하기");
    expect(view.querySelector('[data-row="unknown"] a')).toBeNull();
    expect(view.querySelector('[data-row="unknown"]')?.textContent).toContain("채널 모름");
    expect(view.textContent).toContain("이전 계약 직접등록");
  });

  it("추가 비용 › 버튼이 원장을 연다 — 버튼 안에 버튼 없음", () => {
    const onOpenExpenseLedger = vi.fn();
    const view = render({ onOpenExpenseLedger });
    const button = view.querySelector<HTMLButtonElement>('[data-row="extra"] button');
    expect(button?.getAttribute("aria-label")).toBe("추가 비용(채널에 안 나눈 비용): 비용 원장 열기");
    act(() => button?.click());
    expect(onOpenExpenseLedger).toHaveBeenCalledTimes(1);
    expect(view.querySelector("button button, button a, a button")).toBeNull();
    expect(cells(view.querySelector('[data-row="extra"]')).map(shown)).toEqual(["—", "60만", "−60만"]);
  });

  it("추가 비용을 못 읽으면 「확인 못 했어요」, 합계 비용 = DB 비용만(0원으로 지어내지 않음)", () => {
    const view = render({ additionalCost: null });
    const extra = cells(view.querySelector('[data-row="extra"]'));
    expect(extra[1]?.textContent).toBe("확인 못 했어요");
    expect(shown(extra[2])).toBe("—");
    expect(cells(view.querySelector('[data-row="total"]')).map(shown)).toEqual(["1,860만", "870만", "990만"]);
  });

  it("빈 기간이면 문장만, 표 없음 — 단 추가 비용을 못 읽었으면 표를 보인다", () => {
    const zero = table({ channels: ["매입DB", "직접생산", "현수막", "콜·지·기·소"].map((k) => b(k as ChannelProfit["key"], 0, 0, 0)), manual: b("manual", 0, 0, 0), unknown: b("unknown", 0, 0, 0) });
    let view = render({ table: zero, revenue: 0, dbCost: 0, additionalCost: 0 });
    expect(view.textContent).toBe("이 기간에는 매출·비용 기록이 없어요");
    expect(view.querySelector('[data-testid="fin-channel-profit"]')).toBeNull();
    act(() => root?.unmount());
    container?.remove();
    view = render({ table: zero, revenue: 0, dbCost: 0, additionalCost: null });
    expect(view.querySelector('[data-testid="fin-channel-profit"]')).not.toBeNull();
    expect(view.querySelector('[data-row="extra"]')?.textContent).toContain("확인 못 했어요");
    expect(view.querySelector('[data-row="extra"]')?.className).toContain("border-t");
  });

  it("응답에 아직 없는 계약은 「확인 중…」(다시 불러오는 중) / 「확인 못 함」, 링크 없음", () => {
    let view = render({ table: table({ pending: b("pending", 1, 700_000, 0) }), refreshing: true });
    expect(view.querySelector('[data-row="pending"]')?.textContent).toContain("확인 중…");
    expect(view.querySelector('[data-row="pending"] a, [data-row="pending"] button')).toBeNull();
    act(() => root?.unmount());
    container?.remove();
    view = render({ table: table({ pending: b("pending", 1, 700_000, 0) }) });
    expect(view.querySelector('[data-row="pending"]')?.textContent).toContain("확인 못 함");
  });

  it("패널 글에 「이월」·「시즌」이 없고 옛 표 testid 도 없다", () => {
    const view = render();
    expect(view.textContent).not.toContain("이월");
    expect(view.textContent).not.toContain("시즌");
    expect(view.querySelector('[data-testid="fin-profit-table"]')).toBeNull();
  });
});
