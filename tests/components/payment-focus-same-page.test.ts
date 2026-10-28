// @vitest-environment jsdom
/** 실무/수납에 있는 채로 「오늘 챙길 일」을 눌러도 그 업체·진행건으로 간다(2026-10-28). 합성 데이터만. */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import usePaymentFocus from "@/app/(app)/payment/_components/usePaymentFocus";
import { PAYMENT_FOCUS_EVENT } from "@/util/payment-focus";
import type { ContractPayment } from "@/types";
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const rows = [{ row: 3, 해지숨김: false }, { row: 7, 해지숨김: false }] as ContractPayment[];

describe("usePaymentFocus 같은 화면 알림", () => {
  it("마운트 뒤 알림으로 새 목적지를 받는다", () => {
    window.history.pushState({}, "", "/payment?row=3&slot=1");
    const seen: unknown[] = [];
    function Probe() { const { focusPayment, safeFocusTodoId } = usePaymentFocus(rows, true); seen.push([focusPayment, safeFocusTodoId]); return null; }
    const host = document.createElement("div");
    const root = createRoot(host);
    act(() => root.render(React.createElement(Probe)));
    expect(seen.at(-1)).toEqual([{ row: 3, slot: 1 }, null]);
    act(() => { window.dispatchEvent(new CustomEvent(PAYMENT_FOCUS_EVENT, { detail: "/payment?row=7&slot=2&focus=todo-1" })); });
    expect(seen.at(-1)).toEqual([{ row: 7, slot: 2 }, "todo-1"]);
    act(() => root.unmount());
    window.history.pushState({}, "", "/");
  });
});
