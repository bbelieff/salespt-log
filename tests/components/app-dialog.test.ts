// @vitest-environment jsdom
/** AppDialog 공용 팝업 규칙 (2026-11-10 결정 4): Esc·초점 복귀·적던 내용 확인·바깥 누르기. 가상 값만. */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import AppDialog, { useAppDialogClose, type AppDialogProps } from "@/components/ui/AppDialog";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
beforeAll(() => {
  // jsdom 에 showModal/close 가 없을 수 있다.
  if (!HTMLDialogElement.prototype.showModal) HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { this.open = true; };
  if (!HTMLDialogElement.prototype.close) HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) { this.open = false; };
});

let root: Root;
let host: HTMLDivElement;
let trigger: HTMLButtonElement;
beforeEach(() => {
  trigger = document.createElement("button");
  trigger.textContent = "열기";
  document.body.append(trigger);
  trigger.focus();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  trigger.remove();
  vi.restoreAllMocks();
});

function CancelButton() {
  const close = useAppDialogClose();
  return h("button", { type: "button", onClick: close }, "취소");
}

function render(props: Partial<AppDialogProps> & { onClose: () => void }) {
  act(() =>
    root.render(
      h(AppDialog, { title: "가상 창", ...props }, h("p", null, "안내"), h("input", { "aria-label": "이름" }), h(CancelButton)),
    ),
  );
  const dialog = document.querySelector("dialog")!;
  return { dialog, input: dialog.querySelector("input")!, cancel: [...dialog.querySelectorAll("button")].find((b) => b.textContent === "취소")! };
}
const esc = (d: HTMLDialogElement) => act(() => { d.dispatchEvent(new Event("cancel", { cancelable: true })); });
const backdrop = (d: HTMLDialogElement) => act(() => {
  d.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
  d.dispatchEvent(new MouseEvent("click", { bubbles: true }));
});

describe("AppDialog", () => {
  it("열리면 모달로 뜨고 첫 입력 칸에 초점", () => {
    const { dialog, input } = render({ onClose: vi.fn() });
    expect(dialog.open).toBe(true);
    expect(dialog.getAttribute("aria-label")).toBe("가상 창");
    expect(document.activeElement).toBe(input);
  });

  it("Esc 로 닫히고, 닫히면 연 버튼으로 초점이 돌아온다", () => {
    const onClose = vi.fn(() => act(() => root.render(h("div"))));
    const { dialog } = render({ onClose });
    esc(dialog);
    expect(onClose).toHaveBeenCalledOnce();
    expect(document.querySelector("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("★적던 내용이 있으면 Esc·취소 모두 묻고, 「아니오」면 안 닫는다", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const onClose = vi.fn();
    const { dialog, cancel } = render({ onClose, dirty: true });
    esc(dialog);
    act(() => cancel.click());
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(onClose).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    act(() => cancel.click());
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("적던 내용이 없으면 묻지 않고 바로 닫는다", () => {
    const confirm = vi.spyOn(window, "confirm");
    const onClose = vi.fn();
    const { cancel } = render({ onClose });
    act(() => cancel.click());
    expect(confirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("★입력 창(기본)은 바깥을 눌러도 안 닫힌다", () => {
    const onClose = vi.fn();
    const { dialog } = render({ onClose });
    backdrop(dialog);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("안내용 창(dismissOnBackdrop)은 바깥을 누르면 닫히고, 판 안 누르기는 무시", () => {
    const onClose = vi.fn();
    const { dialog, input } = render({ onClose, dismissOnBackdrop: true });
    act(() => input.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onClose).not.toHaveBeenCalled();
    backdrop(dialog);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("판 안에서 눌러 바깥에서 뗀 드래그는 닫지 않는다", () => {
    const onClose = vi.fn();
    const { dialog, input } = render({ onClose, dismissOnBackdrop: true });
    act(() => {
      input.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      dialog.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("★겹친 창: 안쪽 창의 Esc·닫힘은 바깥 창을 닫지 않는다", () => {
    const outer = vi.fn();
    const inner = vi.fn();
    act(() => root.render(h(AppDialog, { title: "바깥", onClose: outer }, h("input", { "aria-label": "칸" }), h(AppDialog, { title: "안쪽", onClose: inner, dismissOnBackdrop: true }, h("button", null, "확인")))));
    const innerDialog = document.querySelector('dialog[aria-label="안쪽"]') as HTMLDialogElement;
    esc(innerDialog);
    act(() => { innerDialog.dispatchEvent(new Event("close")); });
    backdrop(innerDialog);
    expect(inner).toHaveBeenCalled();
    expect(outer).not.toHaveBeenCalled();
  });

  it("data-autofocus 가 첫 입력 칸보다 먼저", () => {
    act(() => root.render(h(AppDialog, { title: "확인", onClose: vi.fn() }, h("input", { "aria-label": "x" }), h("button", { "data-autofocus": true }, "취소"))));
    expect((document.activeElement as HTMLElement).textContent).toBe("취소");
  });
});
