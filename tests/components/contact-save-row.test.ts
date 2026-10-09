// @vitest-environment jsdom
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import ContactSaveRow, { useFlushOnHide } from "@/app/(app)/contact/_components/ContactSaveRow";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

let unmount: (() => void) | null = null;
function mount(node: ReturnType<typeof h>) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const root = createRoot(el);
  act(() => root.render(node));
  unmount = () => act(() => root.unmount());
  return el;
}
afterEach(() => { unmount?.(); unmount = null; document.body.innerHTML = ""; });

const button = (el: HTMLElement) => el.querySelector("button:last-of-type") as HTMLButtonElement;

describe("컨택관리 저장 버튼", () => {
  it("저장 안 된 숫자가 있으면 [💾 저장] 이 보이고 누르면 저장한다", async () => {
    const onSave = vi.fn(async () => {});
    const el = mount(h(ContactSaveRow, { status: "pending", dirty: true, onSave, onRetry: () => {} }));
    expect(el.textContent).toContain("저장 안 된 숫자가 있어요");
    const btn = [...el.querySelectorAll("button")].find((b) => b.textContent?.includes("저장"))!;
    expect(btn.textContent).toContain("💾 저장");
    await act(async () => { btn.click(); });
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("저장이 실패하면 이유를 알려 준다", async () => {
    const el = mount(h(ContactSaveRow, {
      status: "error", dirty: true, onRetry: () => {},
      onSave: async () => { throw new Error("네트워크가 끊겼어요."); },
    }));
    const btn = [...el.querySelectorAll("button")].find((b) => b.textContent?.includes("💾"))!;
    await act(async () => { btn.click(); });
    expect(el.querySelector('[role="alert"]')!.textContent).toContain("네트워크가 끊겼어요.");
  });

  it("다 저장됐으면 「저장됨 ✓」", () => {
    const el = mount(h(ContactSaveRow, { status: "saved", dirty: false, onSave: async () => {}, onRetry: () => {} }));
    expect(button(el).textContent).toBe("저장됨 ✓");
  });

  it("화면이 가려지면(앱 닫기·다른 앱) 남은 숫자를 바로 보낸다", () => {
    const flush = vi.fn(async () => {});
    const Probe = ({ dirty }: { dirty: boolean }) => { useFlushOnHide(flush, dirty); return null; };
    mount(h(Probe, { dirty: true }));
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    act(() => { window.dispatchEvent(new Event("pagehide")); });
    expect(flush).toHaveBeenCalledTimes(2);
  });

  it("저장할 게 없으면 화면이 가려져도 보내지 않는다", () => {
    const flush = vi.fn(async () => {});
    const Probe = () => { useFlushOnHide(flush, false); return null; };
    mount(h(Probe));
    act(() => { window.dispatchEvent(new Event("pagehide")); });
    expect(flush).not.toHaveBeenCalled();
  });
});
