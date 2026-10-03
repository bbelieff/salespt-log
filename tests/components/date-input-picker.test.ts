// @vitest-environment jsdom
/**
 * DateInputCustom 회귀 — 미팅예약 날짜 달력.
 *
 * ## 이 파일이 지키는 것
 * 이 컴포넌트는 **네 번 연속으로 죽었다**(#654 · #656 · #730 · #897). 매번 원인이 달랐지만
 * 공통점은 하나였다 — **달력을 여는 주체가 브라우저**였고, 우리는 통제도 감지도 못 했다.
 * 특히 #897 은 `showPicker()` 가 **예외 없이 성공을 반환하면서 아무것도 안 하는** 형태라
 * 예외 기반 폴백조차 안 켜졌고, jsdom 테스트는 전부 초록이었다.
 *
 * 그래서 2026-08-30 에 **직접 그리는 달력**으로 전환했다. 여기서 고정하는 계약:
 *   ① 클릭하면 달력이 **실제 DOM 으로 뜬다** (네이티브 팝업이 아니라 검증 가능한 요소)
 *   ② 날짜를 고르면 onChange 가 그 날짜로 불리고 달력이 닫힌다
 *   ③ 달 이동·min/max·오늘 버튼이 동작한다
 *   ④ **네이티브 date picker 에 의존하지 않는다** — 회귀 방지 가드
 */
import * as React from "react";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import DateInputCustom, {
  buildGrid,
  parseIso,
  toIso,
} from "@/components/ui/DateInputCustom";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

function mount(props: Parameters<typeof DateInputCustom>[0]) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(createElement(DateInputCustom, props));
  });
  const wrapper = document.querySelector<HTMLElement>(".custom-date-wrapper")!;
  const click = (el: Element) =>
    act(() => {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  return {
    host,
    wrapper,
    click,
    pop: () => document.querySelector<HTMLElement>(".date-pop"),
    days: () => [...document.querySelectorAll<HTMLButtonElement>(".date-pop-day")],
    dayByIso: (iso: string) =>
      document.querySelector<HTMLButtonElement>(`.date-pop-day[aria-label="${iso}"]`),
  };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("순수 날짜 유틸", () => {
  it("parseIso/toIso 왕복", () => {
    expect(parseIso("2026-08-30")).toEqual([2026, 8, 30]);
    expect(toIso(2026, 8, 30)).toBe("2026-08-30");
    expect(parseIso("2026-8-3")).toBeNull();
  });

  it("buildGrid 는 항상 42칸 · 일요일 시작 · 앞뒤 달 채움", () => {
    const g = buildGrid(2026, 8);
    expect(g).toHaveLength(42);
    // 2026-08-01 은 토요일 → 앞에 일~금 6칸이 7월로 채워진다
    expect(g[0]!.inMonth).toBe(false);
    expect(g[6]!.iso).toBe("2026-08-01");
    expect(g.filter((c) => c.inMonth)).toHaveLength(31);
  });

  it("**타임존에 안 밀린다** — 문자열로만 다룬다", () => {
    // new Date("2026-08-01") 은 UTC 파싱이라 KST 에서 7/31 로 밀린다. 그 함정 고정.
    const g = buildGrid(2026, 8);
    expect(g.find((c) => c.iso === "2026-08-01")!.day).toBe(1);
  });
});

describe("DateInputCustom — 달력이 실제로 뜬다", () => {
  it("① 클릭하면 달력이 DOM 에 뜬다", () => {
    const { wrapper, click, pop, days } = mount({ value: "2026-08-30", onChange: () => {} });
    expect(pop()).toBeNull();

    click(wrapper);

    expect(pop(), "클릭했는데 달력이 안 떴다 — #897 재발").not.toBeNull();
    expect(days()).toHaveLength(42);
  });

  it("② 날짜를 고르면 onChange 가 그 날짜로 불리고 달력이 닫힌다", () => {
    const picked: string[] = [];
    const { wrapper, click, pop, dayByIso } = mount({
      value: "2026-08-30",
      onChange: (v) => picked.push(v),
    });
    click(wrapper);
    click(dayByIso("2026-08-12")!);

    expect(picked).toEqual(["2026-08-12"]);
    expect(pop(), "고르고 나면 닫혀야 한다").toBeNull();
  });

  it("③ 현재 값이 선택 표시된다", () => {
    const { wrapper, click, dayByIso } = mount({ value: "2026-08-30", onChange: () => {} });
    click(wrapper);
    expect(dayByIso("2026-08-30")!.className).toContain("is-selected");
  });

  it("④ 이전/다음 달 이동", () => {
    const { wrapper, click, dayByIso } = mount({ value: "2026-08-30", onChange: () => {} });
    click(wrapper);
    click(document.querySelector('[aria-label="다음 달"]')!);
    expect(dayByIso("2026-09-15")).not.toBeNull();
    click(document.querySelector('[aria-label="이전 달"]')!);
    click(document.querySelector('[aria-label="이전 달"]')!);
    expect(dayByIso("2026-07-15")).not.toBeNull();
  });

  it("⑤ min/max 밖 날짜는 못 고른다", () => {
    const picked: string[] = [];
    const { wrapper, click, dayByIso } = mount({
      value: "2026-08-30",
      onChange: (v) => picked.push(v),
      min: "2026-08-10",
      max: "2026-08-20",
    });
    click(wrapper);
    expect(dayByIso("2026-08-05")!.disabled).toBe(true);
    expect(dayByIso("2026-08-25")!.disabled).toBe(true);
    expect(dayByIso("2026-08-15")!.disabled).toBe(false);
  });

  it("⑥ 값이 없어도 열린다 — 오늘 기준", () => {
    const { wrapper, click, pop } = mount({ value: "", onChange: () => {} });
    click(wrapper);
    expect(pop()).not.toBeNull();
  });

  it("⑦ Esc 로 닫힌다", () => {
    const { wrapper, click, pop } = mount({ value: "2026-08-30", onChange: () => {} });
    click(wrapper);
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(pop()).toBeNull();
  });

  it("⑧ 키보드(Enter)로도 열린다 — 접근성", () => {
    const { wrapper, pop } = mount({ value: "2026-08-30", onChange: () => {} });
    act(() => {
      wrapper.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(pop()).not.toBeNull();
  });
});

describe("네이티브 date picker 회귀 가드", () => {
  // 주석은 빼고 **실행되는 코드만** 본다 — 상단 이력 주석이 `showPicker` 를 언급하기
  // 때문에, 주석까지 보면 "설명을 썼다"는 이유로 가드가 오탐한다.
  const srcRaw = readFileSync(
    resolve(process.cwd(), "components/ui/DateInputCustom.tsx"),
    "utf8",
  );
  const src = srcRaw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

  it("**`<input type=\"date\">` 를 다시 쓰지 않는다** — #654·#656·#730·#897 의 공통 원인", () => {
    const { wrapper, click } = mount({ value: "2026-08-30", onChange: () => {} });
    click(wrapper);
    expect(document.querySelectorAll('input[type="date"]')).toHaveLength(0);
  });

  it("**showPicker() 를 호출하지 않는다** — 실패해도 예외를 안 던져 감지가 불가능하다", () => {
    expect(src).not.toMatch(/showPicker/);
  });

  it("옛 네이티브 오버레이 CSS 가 되살아나지 않는다", () => {
    expect(css).not.toMatch(/hidden-native-date/);
  });

  it("모바일 터치 타깃 — 날짜 칸 높이 36px 이상", () => {
    const i = css.indexOf(".date-pop-day {");
    expect(i).toBeGreaterThan(-1);
    const body = css.slice(i, css.indexOf("}", i));
    const h = /height:\s*(\d+)px/.exec(body)?.[1];
    expect(Number(h)).toBeGreaterThanOrEqual(36);
  });
});
