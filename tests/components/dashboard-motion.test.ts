// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import CountUp from "@/components/motion/CountUp";
import { usePlayOnOpen } from "@/components/motion/useMotion";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { React?: typeof React }).React = React;

function mount(node: ReturnType<typeof h>) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const root = createRoot(el);
  act(() => root.render(node));
  return { el, unmount: () => act(() => root.unmount()) };
}

describe("대시보드 움직임", () => {
  beforeEach(() => {
    sessionStorage.clear();
    document.body.innerHTML = "";
  });

  it("등장 효과는 화면을 열 때마다 돈다", () => {
    const seen: boolean[] = [];
    const Probe = () => { seen.push(usePlayOnOpen("probe")); return null; };
    const a = mount(h(Probe));
    a.unmount();
    mount(h(Probe));
    expect(seen[0]).toBe(true);
    expect(seen[seen.length - 1]).toBe(true);
  });

  it("동작 줄이기가 켜져 있으면 등장 효과를 틀지 않는다", () => {
    const mm = vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
    const seen: boolean[] = [];
    const Probe = () => { seen.push(usePlayOnOpen("probe")); return null; };
    mount(h(Probe));
    expect(seen[0]).toBe(false);
    mm.mockRestore();
  });

  it("동작 줄이기가 켜져 있으면 숫자는 바로 최종 값", () => {
    const mm = vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
    const { el } = mount(h(CountUp, { value: 1234, play: true }));
    expect(el.textContent).toBe("1,234");
    mm.mockRestore();
  });

  it("화면낭독기는 움직이는 중에도 최종 값을 읽는다", () => {
    const { el } = mount(h(CountUp, { value: 50, play: true, format: (n: number) => `${n}%` }));
    expect(el.querySelector("[aria-label]")!.getAttribute("aria-label")).toBe("50%");
  });
});
