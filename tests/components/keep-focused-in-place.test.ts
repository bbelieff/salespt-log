// @vitest-environment jsdom
/** 자동저장으로 다시 그려질 때 적고 있는 칸이 화면에서 움직이면 그만큼 스크롤을 되돌린다(belie 2026-11-05). */
import * as React from "react";
import { act, createElement as h, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useKeepFocusedInPlace } from "@/lib/hooks/useKeepFocusedInPlace";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.restoreAllMocks();
});

/** 위에 끼어드는 줄(extra)이 생기면 입력 칸이 그 높이만큼 내려간 것처럼 보이게 한다. */
function Harness({ saved, extra }: { saved: number; extra: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useKeepFocusedInPlace(ref, [saved]);
  return h("div", { ref }, extra ? h("p", { "data-extra": "" }, "새 줄") : null, h("input", { "aria-label": "칸" }));
}

function setup() {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(h(Harness, { saved: 0, extra: false })));
  const input = host.querySelector("input")!;
  vi.spyOn(input, "getBoundingClientRect").mockImplementation(() => ({ top: host!.querySelector("[data-extra]") ? 340 : 300 }) as DOMRect);
  const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
  return { input, scrollBy };
}

describe("useKeepFocusedInPlace", () => {
  it("적고 있는 칸이 40px 밀리면 40px 스크롤해 제자리", () => {
    const { input, scrollBy } = setup();
    input.focus();
    act(() => root!.render(h(Harness, { saved: 1, extra: true })));
    expect(scrollBy).toHaveBeenCalledWith(0, 40);
  });
  it("아무 칸도 안 적고 있으면 스크롤하지 않는다", () => {
    const { scrollBy } = setup();
    act(() => root!.render(h(Harness, { saved: 1, extra: true })));
    expect(scrollBy).not.toHaveBeenCalled();
  });
  it("저장 신호(deps)가 그대로면 재지 않는다", () => {
    const { input, scrollBy } = setup();
    input.focus();
    act(() => root!.render(h(Harness, { saved: 0, extra: true })));
    expect(scrollBy).not.toHaveBeenCalled();
  });
});
