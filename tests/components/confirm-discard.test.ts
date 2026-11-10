// @vitest-environment jsdom
/** 적던 내용이 있는 창을 닫을 때 공용 문구로 한 번 묻는다 (2026-11-10 UI 점검). 가상 값만. */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/analytics/contract-slots", () => ({ slotTotals: () => ({ approved: 0, received: 0 }) }));
import { confirmDiscard, DISCARD_MESSAGE } from "@/components/ui/confirm-discard";
import TerminationModal from "@/app/(app)/payment/_components/TerminationModal";
import type { ContractPayment } from "@/types";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; vi.restoreAllMocks(); });

describe("confirmDiscard", () => {
  it("바꾼 게 없으면 묻지 않고 닫는다", () => {
    const spy = vi.spyOn(window, "confirm");
    expect(confirmDiscard(false)).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });
  it("바꾼 게 있으면 공용 문구로 묻고, 답을 따른다", () => {
    const spy = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    expect(confirmDiscard(true)).toBe(false);
    expect(confirmDiscard(true)).toBe(true);
    expect(spy).toHaveBeenCalledWith(DISCARD_MESSAGE);
  });
});

describe("계약 해지 창", () => {
  const cp = { 업체명: "가상상사", 수임비: 1_000_000, slots: [] } as unknown as ContractPayment;
  function mount() {
    const onClose = vi.fn();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root!.render(h(TerminationModal, { cp, pending: false, onClose, onConfirm: vi.fn() })));
    // 2026-11-10 AppDialog: 네이티브 <dialog> — 바깥(어두운 배경) 누르기 = dialog 자신을 누르기.
    const dialog = host.querySelector("dialog")!;
    const esc = () => act(() => { dialog.dispatchEvent(new Event("cancel", { cancelable: true })); });
    const backdrop = () => act(() => {
      dialog.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      dialog.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    return { onClose, esc, backdrop };
  }
  it("빈 채로 Esc 를 누르면 바로 닫힌다", () => {
    const { onClose, esc } = mount();
    esc();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it("★입력 창이라 바깥을 눌러도 안 닫힌다", () => {
    const { onClose, backdrop } = mount();
    backdrop();
    expect(onClose).not.toHaveBeenCalled();
  });
  it("★사유를 적은 뒤 Esc·취소를 누르면 묻고, 「취소」면 남는다", () => {
    const { onClose, esc } = mount();
    const ta = host!.querySelector("textarea")!;
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    act(() => { set.call(ta, "가상 사유"); ta.dispatchEvent(new Event("input", { bubbles: true })); });
    vi.spyOn(window, "confirm").mockReturnValue(false);
    esc();
    act(() => [...host!.querySelectorAll("button")].find((b) => b.textContent?.trim() === "취소")!.click());
    expect(window.confirm).toHaveBeenCalledTimes(2);
    expect(window.confirm).toHaveBeenCalledWith(DISCARD_MESSAGE);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("다른 창도 같은 문구를 쓴다", () => {
  const read = (p: string) => readFileSync(p, "utf8");
  it("DB 추가 창: Esc·✕·취소가 묻는다", () => {
    const s = read("app/(app)/db-sheet/_components/ImportDialog.tsx");
    expect(s).toContain("confirmDiscard(");
    expect(s).toContain("e.stopPropagation();close();");
    expect(s).toContain('onClick={close}>취소</button>');
  });
  it("통화 정리 확인: 고친 게 있으면 「나중에」가 묻는다", () => {
    const s = read("app/(app)/db-sheet/_components/CallConfirmScreen.tsx");
    expect(s).toContain("confirmDiscard(s !== initial.current)");
    expect(s).toContain("onClick={close}>나중에</button>");
  });
  it("일반 일정 안내창에 취소가 있다", () => {
    const s = read("app/(app)/calendar/_components/GeneralEventModal.tsx");
    expect(s).toContain("onClick={() => setHint(false)}");
  });
});
