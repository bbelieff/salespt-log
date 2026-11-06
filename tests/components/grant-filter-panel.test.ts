// @vitest-environment jsdom
/** 공고필터 버튼·펼침(belie 2026-11-05): 늘 보이는 버튼, 펼침에 지역·업종·규모·특성, 빈 조건은 채우기. 값은 모두 가상. */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GrantFilterButton, GrantFilterPanel } from "@/components/company-info/GrantFilterPanel";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});
function render(el: React.ReactElement) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(el));
  return host;
}
const full = { 소재지: "울산광역시 남구 삼산로 1", 업태: "제조", 사대보험직원: "4명" } as never;

describe("GrantFilterButton", () => {
  it("세 조건이 다 맞아도 숨기지 않는다(✓), 모자라면 n/3", () => {
    expect(render(h(GrantFilterButton, { draft: full, open: false, onToggle: () => {}, controlsId: "g" })).textContent).toContain("공고필터 ✓");
    act(() => root!.render(h(GrantFilterButton, { draft: {} as never, open: false, onToggle: () => {}, controlsId: "g" })));
    expect(host!.textContent).toContain("0/3");
    expect(host!.querySelector("button")!.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("GrantFilterPanel", () => {
  it("지역·업종·규모·특성 한곳에서 — 다 맞으면 채우기 없음", () => {
    const el = render(h(GrantFilterPanel, { draft: full, id: "g", onPatch: () => {}, onFill: () => {} }));
    expect(el.querySelector<HTMLSelectElement>('[aria-label="시·도"]')!.value).toBe("울산");
    expect(el.querySelector<HTMLSelectElement>('[aria-label="대분류"]')!.value).toBe("제조업");
    expect(el.textContent).toContain("소상공인");
    expect(el.querySelector('[aria-label="공고 특성"]')).not.toBeNull();
    expect(el.textContent).not.toContain("채우기");
  });
  it("빈 조건의 「채우기 →」는 그 칸으로", () => {
    const onFill = vi.fn();
    const el = render(h(GrantFilterPanel, { draft: {} as never, id: "g", onPatch: () => {}, onFill }));
    const fills = [...el.querySelectorAll("button")].filter((b) => b.textContent === "채우기 →");
    expect(fills).toHaveLength(3);
    act(() => fills[0]!.click());
    expect(onFill).toHaveBeenCalledWith("소재지");
  });
  it("[기업정보] 칸 사이에서는 대분류·시·도·공고 특성을 그리지 않는다", () => {
    const item = readFileSync("components/company-info/CompanyInfoItem.tsx", "utf8");
    expect(item).not.toMatch(/IndustryLine|FeatureChips|RegionSelects|RegionAddress|KsicLine/);
    const editor = readFileSync("components/CompanyInfoEditor.tsx", "utf8");
    expect(editor).toContain("<GrantFilterButton");
    expect(editor).toContain("<GrantFilterPanel");
  });
});

describe("산업분류(KsicLine) — 공고필터 업종 아래, 버튼은 「바꾸기」 하나(belie 2026-11-06)", () => {
  const settle = () => act(async () => { await import("@/config/ksic11"); await new Promise((r) => setTimeout(r, 0)); });
  const buttons = (el: Element) => [...el.querySelectorAll("button")];
  it("자동 1순위 + 코드 누르면 복사 · 「바꾸기」 → 후보 줄을 누르면 저장하고 닫힘", async () => {
    const onPatch = vi.fn();
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    const el = render(h(GrantFilterPanel, { draft: { ...(full as object), 업종주생산품목: "한식" } as never, id: "g", onPatch, onFill: () => {} }));
    await settle();
    const line = el.querySelector("[data-ksic-line]")!;
    expect(line).not.toBeNull();
    expect(line.textContent).toContain("자동");
    expect(line.textContent).not.toMatch(/고르기|후보|자동으로|복사/);
    const [codeBtn, change] = buttons(line);
    expect(codeBtn!.textContent).toMatch(/^\d{5}$/);
    expect(change!.textContent).toBe("바꾸기");
    await act(async () => { codeBtn!.click(); await Promise.resolve(); });
    expect(writeText).toHaveBeenCalledWith(codeBtn!.textContent);
    expect(el.textContent).toContain("복사됨");
    act(() => change!.click());
    const choice = buttons(line).find((b) => /^\d{5}/.test(b.textContent ?? "") && b !== codeBtn)!;
    act(() => choice.click());
    expect(onPatch).toHaveBeenCalledWith({ 표준산업분류: expect.stringMatching(/^\d{5} \S/) });
    expect(line.querySelector('[aria-label="표준산업분류 찾기"]')).toBeNull();
  });
  it("고른 값이 있으면 펼친 목록 맨 위 「자동 추천으로 두기」 → 빈값 저장", async () => {
    const onPatch = vi.fn();
    const el = render(h(GrantFilterPanel, { draft: { ...(full as object), 표준산업분류: "00000 가상 분류" } as never, id: "g", onPatch, onFill: () => {} }));
    await settle();
    const line = el.querySelector("[data-ksic-line]")!;
    expect(line.textContent).toContain("가상 분류");
    act(() => buttons(line).find((b) => b.textContent === "바꾸기")!.click());
    const auto = buttons(line).find((b) => b.textContent?.startsWith("자동 추천으로 두기"))!;
    const autoCode = auto.textContent!.match(/\d{5}/)![0];
    expect(buttons(line).filter((b) => b.textContent?.includes(autoCode))).toHaveLength(1); // 1순위가 두 번 나오지 않는다
    act(() => auto.click());
    expect(onPatch).toHaveBeenCalledWith({ 표준산업분류: "" });
  });
});
