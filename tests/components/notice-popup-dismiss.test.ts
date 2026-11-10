// @vitest-environment jsdom
/** 새소식 팝업: 배경 탭·Esc 는 닫기만, 「본 것」 기록은 직접 누른 ✕·[확인]만 (2026-11-10 UI 점검). 가상 값만. */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import NoticePopup from "@/components/announcements/NoticePopup";
import type { Notice } from "@/types";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; });

const notice = { id: "n1", title: "가상 공지", bodyMd: "가상 내용", pinned: false, displayMode: "once" } as unknown as Notice;
function mount() {
  const onConfirm = vi.fn(), onDismiss = vi.fn();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(h(NoticePopup, { notices: [notice], updates: [], onConfirm, onDismiss })));
  return { onConfirm, onDismiss, backdrop: host.firstElementChild as HTMLElement };
}

describe("NoticePopup 닫기", () => {
  it("★배경을 누르면 닫기만 하고 읽음 처리하지 않는다", () => {
    const { onConfirm, onDismiss, backdrop } = mount();
    act(() => backdrop.click());
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it("Esc 도 닫기만 한다", () => {
    const { onConfirm, onDismiss } = mount();
    act(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it("[확인]·✕ 은 읽음 처리한다", () => {
    const { onConfirm, onDismiss } = mount();
    const btns = [...document.querySelectorAll("button")];
    act(() => btns.find((b) => b.textContent === "확인")!.click());
    act(() => btns.find((b) => b.getAttribute("aria-label") === "닫기")!.click());
    expect(onConfirm).toHaveBeenCalledTimes(2);
    expect(onDismiss).not.toHaveBeenCalled();
  });
  it("대화상자로 읽히고 초점이 팝업으로 간다", () => {
    mount();
    const dialog = document.querySelector("[role=dialog]") as HTMLElement;
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(dialog);
  });
});
