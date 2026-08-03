// @vitest-environment jsdom
/**
 * DateInputCustom picker 회귀 (P0-2, 2026-08-03 수강생 신고).
 *
 * 사고: 신규 미팅 슬롯의 날짜 박스가 `<label>` 로 감싸여 있었다. label 은 내부 native
 * date input 과 **자동 연결**되어 클릭을 재전달하고, 그 합성 클릭이 wrapper 로 되버블링돼
 * `showPicker()` 가 **2차 호출**된다. 2차는 user gesture 가 아니라 `NotAllowedError` 로 죽고
 * 이미 열린 picker 가 닫혀 **"날짜 선택 불가"** 가 됐다(브라우저 프로브로 실측 확인).
 *
 * 여기서 고정하는 계약:
 *  ① native input 이 target 인 클릭(=재전달분)은 **무시** — showPicker 재호출 금지.
 *  ② showPicker 가 던져도 컴포넌트가 죽지 않고 focus 로 degrade.
 *  ③ 정상 클릭(박스/표시 영역)은 showPicker 를 정확히 1회 호출.
 */
import * as React from "react";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach } from "vitest";
import DateInputCustom from "@/components/ui/DateInputCustom";

// jsdom + React 18 act 환경 (tests/components/expense-ledger-ui.test.ts 와 동일 패턴)
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

function mount(props: Parameters<typeof DateInputCustom>[0]) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(createElement(DateInputCustom, props));
  });
  const wrapper = host.querySelector<HTMLElement>(".custom-date-wrapper")!;
  const native = host.querySelector<HTMLInputElement>("input[type=date]")!;
  return { host, wrapper, native };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("DateInputCustom — picker 재호출 가드", () => {
  it("정상 클릭 → showPicker 1회", () => {
    const { wrapper, native } = mount({ value: "", onChange: () => {} });
    const spy = vi.fn();
    (native as unknown as { showPicker: () => void }).showPicker = spy;

    const display = wrapper.querySelector(".custom-date-display")!;
    act(() => {
      display.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("**native input 이 target 인 클릭은 무시** — label 재전달분이 picker 를 닫지 못한다", () => {
    const { wrapper, native } = mount({ value: "", onChange: () => {} });
    const spy = vi.fn();
    (native as unknown as { showPicker: () => void }).showPicker = spy;

    // label 이 재전달한 클릭 = target 이 native input, wrapper 로 버블링됨
    act(() => {
      native.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(spy).not.toHaveBeenCalled();
    expect(wrapper).toBeTruthy();
  });

  it("showPicker 가 NotAllowedError 를 던져도 죽지 않고 focus 로 degrade", () => {
    const { wrapper, native } = mount({ value: "", onChange: () => {} });
    (native as unknown as { showPicker: () => void }).showPicker = () => {
      throw new DOMException("requires a user gesture", "NotAllowedError");
    };
    const focusSpy = vi.spyOn(native, "focus");

    const display = wrapper.querySelector(".custom-date-display")!;
    expect(() =>
      act(() => {
        display.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }),
    ).not.toThrow();
    expect(focusSpy).toHaveBeenCalled();
  });

  it("showPicker 미지원 브라우저 → focus 폴백", () => {
    const { wrapper, native } = mount({ value: "", onChange: () => {} });
    delete (native as unknown as { showPicker?: () => void }).showPicker;
    const focusSpy = vi.spyOn(native, "focus");

    const display = wrapper.querySelector(".custom-date-display")!;
    act(() => {
      display.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(focusSpy).toHaveBeenCalled();
  });
});
