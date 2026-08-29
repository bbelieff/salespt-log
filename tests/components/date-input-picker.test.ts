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
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

  it("**모바일 경로**: native input 이 상호작용 가능해야 한다 — 숨김/비활성 금지", () => {
    // P0-2 진짜 원인: 인풋이 0×0 + opacity:0 + pointer-events:none 이라 iOS Safari·인앱
    // WKWebView 에서 showPicker 도 안 먹고 사용자가 직접 탭할 수도 없었다(달력 여는 경로 0).
    // #656 이 크기를 박스 전체로 키웠고(이 계약은 유지), BBE-81 이 pointer-events 는
    // 다시 꺼서 클릭을 JS 로만 보낸다(globals.css) — 크기·접근성 속성은 계속 이 값이어야 한다.
    const { native } = mount({
      value: "2026-08-03",
      onChange: () => {},
      ariaLabel: "미팅 날짜",
    });

    // 스크린리더/키보드에서 접근 가능해야 한다(예전엔 aria-hidden + tabIndex=-1 이었다).
    expect(native.getAttribute("aria-hidden")).toBeNull();
    expect(native.getAttribute("tabindex")).toBeNull();
    expect(native.getAttribute("aria-label")).toBeTruthy();
    // 클래스 계약 — 크기는 globals.css 가 inset:0/100%로 덮고, pointer-events:none 은
    // `--fallback` 이 없는 기본 상태에서만 적용된다.
    expect(native.className).toContain("hidden-native-date");
    expect(native.className).not.toContain("hidden-native-date--fallback");
    expect(native.disabled).toBe(false);
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

  describe("BBE-81 (2026-08-07) — 브라우저 기본 클릭-오픈에 조용히 의존하지 않는다", () => {
    // 신고: 컨택관리 미팅예약 날짜박스 클릭 시 전 수강생 무반응, 콘솔 에러 0건.
    // 실측: #656 이 native input 을 박스 전체에 깔아 "브라우저 기본 클릭-오픈"에 맡긴
    // 뒤로 그 기본 동작 자체가 조용히 안 먹는 사례가 나왔다 — 열기 경로가 그거 하나뿐이라
    // 100% 무반응이 됐다(에러가 없는 이유 = 애초에 아무 JS 도 실행 안 됨).
    // 수리: pointer-events:none 으로 클릭을 항상 JS(showPicker) 로만 보내 "브라우저가
    // 열어줄 것"이라는 가정 자체를 없앤다. showPicker 가 실패할 때만 `--fallback` 로
    // pointer-events 를 되살려 예전 경로를 최후 수단으로 남긴다 — 그때는 조용히 아무 일도
    // 안 일어나지 않고 사용자에게 "다시 눌러주세요" 가 보인다.

    it("showPicker 예외 시 fallback 클래스 부여 + 사용자에게 보이는 안내가 뜬다", () => {
      const { wrapper, native } = mount({ value: "", onChange: () => {} });
      (native as unknown as { showPicker: () => void }).showPicker = () => {
        throw new DOMException("blocked", "NotAllowedError");
      };

      const display = wrapper.querySelector(".custom-date-display")!;
      act(() => {
        display.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      expect(native.className).toContain("hidden-native-date--fallback");
      expect(wrapper.querySelector('[role="status"]')?.textContent).toContain(
        "다시 눌러주세요",
      );
    });

    it("showPicker 성공 시에는 fallback 클래스가 절대 붙지 않는다(정상 경로 회귀 방지)", () => {
      const { wrapper, native } = mount({ value: "", onChange: () => {} });
      const spy = vi.fn();
      (native as unknown as { showPicker: () => void }).showPicker = spy;

      const display = wrapper.querySelector(".custom-date-display")!;
      act(() => {
        display.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(native.className).not.toContain("hidden-native-date--fallback");
      expect(wrapper.querySelector('[role="status"]')).toBeNull();
    });
  });
});

/**
 * CSS 계약 가드 (2026-08-29, 4번째 재발 후 신설).
 *
 * 위 테스트들은 jsdom 이라 **CSS 로 인한 실패를 원리적으로 못 잡는다** — 실제 사고는
 * JS 가 아니라 스타일에서 났다. 크롬은 `opacity:0` 인 date input 에 대해 showPicker() 를
 * 예외 없이 조용히 무시한다(호출은 ok 로 반환되는데 달력이 안 뜸). 예외가 안 나므로
 * `--fallback` 도 안 켜져 사용자에겐 완전 무반응이 된다.
 *
 * 그래서 "요소는 보이는 상태로 두고 내용만 투명화" 라는 계약을 여기서 기계 검증한다.
 * 이 테스트가 깨지면 그 변경은 전 수강생 미팅예약 달력을 다시 죽인다.
 */
describe("globals.css — .hidden-native-date 가시성 계약", () => {
  // 주석을 먼저 걷어낸다 — 주석 안의 설명 문구("opacity:0 이면 …")가 선언으로 오인되면
  // 이 가드가 엉뚱하게 통과/실패한다.
  const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

  function ruleBody(selector: string): string {
    const i = css.indexOf(selector + " {");
    expect(i, `${selector} 규칙을 찾지 못했다`).toBeGreaterThan(-1);
    return css.slice(i, css.indexOf("}", i));
  }

  it("opacity 가 0 이면 안 된다 — 크롬이 showPicker() 를 조용히 무시한다", () => {
    const body = ruleBody(".hidden-native-date");
    const opacity = /opacity:\s*([^;]+);/.exec(body)?.[1]?.trim();
    expect(opacity, "opacity 선언이 사라졌다").toBeTruthy();
    expect(opacity).not.toBe("0");
    expect(Number(opacity)).toBeGreaterThan(0);
  });

  it("글자는 투명이어야 한다 — 안 그러면 네이티브 날짜가 우리 표시와 겹쳐 보인다", () => {
    expect(ruleBody(".hidden-native-date")).toMatch(/color:\s*transparent/);
  });

  it("크기는 박스 전체를 유지한다 — 0×0 은 iOS/인앱 웹뷰에서 picker 를 못 띄운다(#656)", () => {
    const body = ruleBody(".hidden-native-date");
    expect(body).toMatch(/width:\s*100%/);
    expect(body).toMatch(/height:\s*100%/);
  });

  it("표시용 span 이 native input 위에 온다 — 겹침 방지", () => {
    expect(ruleBody(".custom-date-wrapper > span")).toMatch(/z-index:\s*1/);
  });
});
