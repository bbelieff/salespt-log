// @vitest-environment jsdom
/** 첫걸음 스포트라이트(2026-11-11): 누르면 다음 단계, 밝힌 칸이 사라지면 다음, 다른 창이 뜨면 숨기, 나중에·다시 보지 않기. */
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Spotlight, { type SpotStep } from "@/components/onboarding/Spotlight";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement, root: Root, stage: HTMLDivElement;
const realRects = Element.prototype.getClientRects;
beforeEach(() => {
  vi.useFakeTimers();
  // jsdom 은 배치를 계산하지 않는다 — 붙어 있는 요소는 「보인다」고 친다.
  Element.prototype.getClientRects = function (this: Element) {
    return (this.isConnected ? [{}] : []) as unknown as DOMRectList;
  };
  stage = document.createElement("div");
  stage.innerHTML = '<button aria-label="미팅예약 증가">＋</button>';
  document.body.append(stage);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  stage.remove();
  Element.prototype.getClientRects = realRects;
  vi.useRealTimers();
});

const steps: SpotStep[] = [
  { target: "button[aria-label='미팅예약 증가']", title: "미팅예약 ＋", body: "누르면 카드가 생겨요", advance: "click" },
  { target: "[data-first-steps='new-meeting']", title: "예약 등록", body: "적고 등록", advance: "gone" },
];
const text = () => host.textContent ?? "";
const tick = (ms = 250) => act(() => vi.advanceTimersByTime(ms));

function render(over: Partial<React.ComponentProps<typeof Spotlight>> = {}) {
  const props = { label: "첫 미팅 예약 안내", steps, final: { title: "첫 미팅 예약을 마쳤어요", body: "끝" }, onFinish: vi.fn(), onLater: vi.fn(), onNever: vi.fn(), ...over };
  act(() => root.render(h(Spotlight, props)));
  tick();
  return props;
}

it("moves on when the lit button is pressed, then when the new card is registered", () => {
  const props = render();
  expect(text()).toContain("1 / 2");
  expect(host.querySelector("[aria-hidden='true'].fixed")).not.toBeNull();
  act(() => stage.querySelector("button")!.click());
  tick(300);
  expect(text()).toContain("2 / 2");
  expect(text()).toContain("안내할 칸이 화면에 나오면");
  const card = document.createElement("div");
  card.dataset.firstSteps = "new-meeting";
  act(() => stage.append(card));
  tick();
  expect(text()).toContain("적고 등록");
  act(() => card.remove());
  tick(400);
  tick(400);
  expect(text()).toContain("첫 미팅 예약을 마쳤어요");
  expect(props.onFinish).toHaveBeenCalledTimes(1);
});

it("hides while another modal window is open and comes back after", () => {
  render();
  const modal = document.createElement("div");
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  act(() => document.body.append(modal));
  tick();
  expect(text()).toBe("");
  act(() => modal.remove());
  tick();
  expect(text()).toContain("1 / 2");
});

it("closes for now on 나중에 / Esc and remembers on 다시 보지 않기", () => {
  const props = render();
  act(() => [...host.querySelectorAll("button")].find((b) => b.textContent === "나중에")!.click());
  expect(props.onLater).toHaveBeenCalledTimes(1);
  act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
  expect(props.onLater).toHaveBeenCalledTimes(2);
  act(() => [...host.querySelectorAll("button")].find((b) => b.textContent === "다시 보지 않기")!.click());
  expect(props.onNever).toHaveBeenCalledTimes(1);
});

it("skips a step whose skipIf is true", () => {
  render({ steps: [{ ...steps[0]!, skipIf: () => true }, steps[1]!] });
  tick();
  expect(text()).toContain("2 / 2");
});
