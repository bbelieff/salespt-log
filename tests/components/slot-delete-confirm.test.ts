// @vitest-environment jsdom
/** 진행건 지우기 확인 팝업 — 번호와 적은 내용을 보여 주고, 「지우기」를 눌러야만 지운다(belie 2026-11-05). 가상 값만. */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import SlotDeleteConfirmModal from "@/app/(app)/payment/_components/SlotDeleteConfirmModal";
import type { PaymentSlot } from "@/types";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

const slot = (over: Partial<PaymentSlot> = {}): PaymentSlot => ({
  진행기관: "", 진행상품: "", 진행률: "", 현황: "", 승인금액: 0, 수납액: 0, 수납일: "", 메모: "", ...over,
});
function mount(s: PaymentSlot) {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(h(SlotDeleteConfirmModal, { n: 2, slot: s, onCancel, onConfirm })));
  const btn = (t: string) => [...document.body.querySelectorAll("button")].find((b) => b.textContent === t)!;
  return { onCancel, onConfirm, btn };
}

describe("SlotDeleteConfirmModal", () => {
  it("진행건 번호와 적은 내용을 보여 준다", () => {
    mount(slot({ 진행기관: "가상기관", 진행상품: "가상상품", 진행률: "40%", 승인금액: 3_000_000 }));
    const text = document.body.textContent ?? "";
    expect(text).toContain("진행 2번을 지울까요?");
    expect(text).toContain("가상기관");
    expect(text).toContain("가상상품");
    expect(text).toContain("40%");
  });
  it("취소는 지우지 않고, 「진행 2 지우기」만 지운다", () => {
    const { onCancel, onConfirm, btn } = mount(slot({ 진행기관: "가상기관" }));
    act(() => btn("취소").click());
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    act(() => btn("진행 2 지우기").click());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
  it("빈 진행건이면 그렇게 알려 준다", () => {
    mount(slot());
    expect(document.body.textContent).toContain("적은 내용이 없는 빈 진행건이에요.");
  });
});
