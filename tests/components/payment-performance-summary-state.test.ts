// @vitest-environment jsdom
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import PaymentPerformanceSummary from "@/app/(app)/payment/_components/PaymentPerformanceSummary";
import type { ContractPayment } from "@/types";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
let host: HTMLDivElement | undefined;
type Props = React.ComponentProps<typeof PaymentPerformanceSummary>;
function render(over: Partial<Props> = {}) {
  if (!host) { host = document.createElement("div"); document.body.append(host); root = createRoot(host); }
  act(() => root!.render(h(PaymentPerformanceSummary, { rows: [], workRows: [], todos: [], onNavigate: vi.fn(), ...over })));
  return host;
}
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = undefined; host = undefined; });

describe("실무/수납 성과 요약 요청 상태", () => {
  it("첫 로딩 중에는 계약 0건·매출 0원·진행 0건을 확정 표시하지 않는다", () => {
    const el = render({ dataState: "loading", workState: "loading" });
    expect(el.textContent).toContain("계약·매출 불러오는 중…");
    expect(el.textContent).toContain("진행 현황 불러오는 중…");
    expect(el.textContent).not.toContain("0건");
    expect(el.textContent).not.toContain("₩0");
    expect(el.querySelector("[data-work-status-bar]")).toBeNull();
    expect(el.querySelector("section")!.getAttribute("aria-busy")).toBe("true");
  });
  it("확인된 빈 응답은 0건·0원으로 표시한다", () => {
    const el = render({ dataState: "ready", workState: "ready" });
    expect(el.textContent).toContain("0건");
    expect(el.textContent).toContain("₩0");
    expect(el.querySelector("[data-work-status-bar]")).not.toBeNull();
    expect(el.querySelector("section")!.getAttribute("aria-busy")).toBe("false");
  });
  it("계약을 읽었어도 투두를 읽기 전에는 미확정 진행 분류를 보여주지 않는다", () => {
    const el = render({ dataState: "ready", workState: "loading" });
    expect(el.textContent).toContain("₩0");
    expect(el.textContent).toContain("진행 현황 불러오는 중…");
    expect(el.querySelector("[data-work-status-bar]")).toBeNull();
  });
  it("실패는 0으로 숨기지 않고 재시도하며 성공 뒤 실제 합계로 바뀐다", () => {
    const retry = vi.fn();
    const el = render({ dataState: "error", onRetry: retry });
    expect(el.querySelector('[role="alert"]')?.textContent).toContain("불러오지 못했어요");
    expect(el.textContent).not.toContain("₩0");
    const button = [...el.querySelectorAll("button")].find((b) => b.textContent === "다시 시도")!;
    act(() => button.click());
    expect(retry).toHaveBeenCalledTimes(1);
    const slot = { 진행기관: "", 진행상품: "", 진행률: "", 현황: "", 승인금액: 0, 수납액: 0, 수납일: "", 메모: "" };
    const row = { row: 3, 계약일: "2026-10-01", 업체명: "예시상사", 수임비: 1200000, 반환액: 0, 해지일: "", 수납1: slot, 수납2: slot, 수납3: slot } as ContractPayment;
    render({ rows: [row], workRows: [row], dataState: "ready", workState: "ready" });
    expect(el.textContent).toContain("1건");
    expect(el.textContent).toContain("₩1,200,000");
    expect(el.querySelector('[role="alert"]')).toBeNull();
    render({rows:[row], workRows:[row], dataState:"error", onRetry:retry});
    expect(el.querySelector('[role="alert"]')).not.toBeNull();
    expect(el.textContent).not.toContain('₩1,200,000');
  });
});
