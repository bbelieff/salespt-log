// @vitest-environment jsdom
/** 글자 크기 [− 가 +] — 범위별 저장·단계 한계·박스 변수 적용(2026-09-29). */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import FontScaleControl from "@/components/FontScaleControl";
import { useFontStep } from "@/components/font-scale/useFontStep";
import { clampFontStep, fontScaleOf, fontStepStorageKey } from "@/util/font-scale";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

function Box() {
  const [step, setStep] = useFontStep("company-info");
  return h("div", { "data-box": true, style: { "--font-scale": String(fontScaleOf(step)) } },
    h(FontScaleControl, { step, onChange: setStep, label: "업체정보" }));
}

let root: Root | undefined;
let el: HTMLDivElement | undefined;
beforeEach(() => window.localStorage.clear());
afterEach(() => { act(() => root?.unmount()); el?.remove(); });

const click = (node: Element, label: string) =>
  act(() => (node.querySelector(`[aria-label="${label}"]`) as HTMLButtonElement).click());

describe("FontScaleControl", () => {
  it("+ 세 번까지 커지고 저장되며, 끝에서 버튼이 잠긴다", () => {
    el = document.createElement("div"); document.body.append(el); root = createRoot(el);
    act(() => root?.render(h(Box)));
    const box = el.querySelector("[data-box]") as HTMLDivElement;
    expect(box.style.getPropertyValue("--font-scale")).toBe("1");
    for (let i = 0; i < 3; i++) click(el, "업체정보 글자 크게");
    expect(box.style.getPropertyValue("--font-scale")).toBe("1.3");
    expect(window.localStorage.getItem(fontStepStorageKey("company-info"))).toBe("3");
    expect((el.querySelector('[aria-label="업체정보 글자 크게"]') as HTMLButtonElement).disabled).toBe(true);
    click(el, "업체정보 글자 작게");
    expect(box.style.getPropertyValue("--font-scale")).toBe("1.2");
  });

  it("저장된 단계로 시작하고, 이상한 값은 기본", () => {
    window.localStorage.setItem(fontStepStorageKey("company-info"), "2");
    el = document.createElement("div"); document.body.append(el); root = createRoot(el);
    act(() => root?.render(h(Box)));
    expect((el.querySelector("[data-box]") as HTMLDivElement).style.getPropertyValue("--font-scale")).toBe("1.2");
    expect(clampFontStep("abc")).toBe(0);
    expect(clampFontStep(9)).toBe(3);
  });
});
