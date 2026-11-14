// @vitest-environment jsdom

import * as React from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import BoardPopover from "@/app/(app)/schedule/_components/board/BoardPopover";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

it("keeps a lower-row schedule popover above the viewport edge after its form grows", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let onResize: ResizeObserverCallback | undefined;
  const observe = vi.fn();
  const disconnect = vi.fn();
  vi.stubGlobal("innerWidth", 1440);
  vi.stubGlobal("innerHeight", 720);
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: ResizeObserverCallback) { onResize = callback; }
    observe = observe;
    disconnect = disconnect;
  });
  const height = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
    return this.querySelector("form") ? 360 : 160;
  });

  function Details() {
    const [open, setOpen] = React.useState(false);
    return React.createElement(React.Fragment, null,
      React.createElement("button", { onClick: () => setOpen(true) }, "결과 입력"),
      open && React.createElement("form", null, React.createElement("button", null, "저장")),
    );
  }

  try {
    React.act(() => root.render(React.createElement(BoardPopover, {
      anchor: new DOMRect(900, 520, 80, 24), label: "일정 결과", title: "일정", onClose: vi.fn(),
      children: React.createElement(Details),
    })));
    const dialog = host.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.style.top).toBe("520px");
    React.act(() => [...dialog.querySelectorAll("button")].find((button) => button.textContent === "결과 입력")!.click());
    expect(dialog.querySelector("form")).not.toBeNull();
    React.act(() => onResize?.([], {} as ResizeObserver));
    expect(parseInt(dialog.style.top, 10) + dialog.offsetHeight).toBe(window.innerHeight - 8);
    expect(observe).toHaveBeenCalledWith(dialog);
  } finally {
    React.act(() => root.unmount());
    host.remove();
    height.mockRestore();
    vi.unstubAllGlobals();
  }
  expect(disconnect).toHaveBeenCalledOnce();
});
