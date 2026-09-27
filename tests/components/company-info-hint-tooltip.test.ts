// @vitest-environment jsdom
/**
 * 업체정보 칸 설명 = (?) 툴팁 (company-info-hint-tooltip).
 *  ① 라벨 아래 회색 설명 줄이 기본 렌더되지 않는다.
 *  ② 설명 있는 필드(개업일)에 "개업일 설명 보기" 버튼이 있다.
 *  ③ 누르면 role=tooltip 에 설명이 뜨고 aria-expanded/aria-describedby 가 연결된다.
 *  ④ Esc · 바깥 누르기로 닫힌다. 한 번에 하나만 열린다.
 *  ⑤ 설명 없는 필드(라벨과 같은 설명 = 이름, 사용자 추가 필드)는 버튼이 없다.
 *  ⑥ 입력칸은 htmlFor/id 로 라벨과 연결된다(버튼은 label 밖).
 */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompanyInfo } from "@/types";
import CompanyInfoEditor from "@/components/CompanyInfoEditor";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

vi.mock("@/components/autosave/useAutosave", () => ({
  useAutosave: (opts: { initial: unknown }) => ({
    draft: opts.initial,
    saved: opts.initial,
    status: "idle",
    error: "",
    dirty: false,
    savedAt: null,
    canUndo: false,
    update: vi.fn(),
    stage: vi.fn(),
    commit: vi.fn(),
    syncServer: vi.fn(),
    retry: vi.fn(),
    flush: vi.fn(),
    undo: vi.fn(),
  }),
}));

let root: Root | undefined;
let el: HTMLDivElement | undefined;

function renderOpen() {
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
  const value = CompanyInfo.parse({
    대표자이름: "홍길동",
    커스텀: { 업체: { 메모칸: "" }, 대표자: {} },
  });
  act(() => {
    root?.render(h(CompanyInfoEditor, { value, onSave: () => undefined, hideSave: true }));
  });
}

const hintBtn = (label: string) =>
  el!.querySelector<HTMLButtonElement>(`button[aria-label="${label} 설명 보기"]`);
const tooltip = () => document.body.querySelector<HTMLElement>('[role="tooltip"]');

afterEach(() => {
  act(() => root?.unmount());
  el?.remove();
  root = undefined;
  el = undefined;
});

describe("CompanyInfoEditor hint tooltip", () => {
  it("does not render the grey hint line by default", () => {
    renderOpen();
    expect(el!.textContent).toContain("개업일");
    expect(el!.textContent).not.toContain("25.01.24");
    expect(el!.textContent).not.toContain("0명 + 프리0명");
    expect(tooltip()).toBeNull();
  });

  it("shows the hint in a tooltip on click and closes on Escape", () => {
    renderOpen();
    const btn = hintBtn("개업일");
    expect(btn).not.toBeNull();
    expect(btn!.getAttribute("aria-expanded")).toBe("false");
    act(() => btn!.click());
    const tip = tooltip();
    expect(tip?.textContent).toBe("25.01.24");
    expect(btn!.getAttribute("aria-expanded")).toBe("true");
    expect(btn!.getAttribute("aria-describedby")).toBe(tip!.id);
    // portal → body 직속(overflow 부모에 안 잘림)
    expect(el!.contains(tip)).toBe(false);
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(tooltip()).toBeNull();
    expect(btn!.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes when tapping elsewhere and keeps only one open", () => {
    renderOpen();
    act(() => hintBtn("개업일")!.click());
    act(() => hintBtn("사업자구분")!.click());
    expect(document.body.querySelectorAll('[role="tooltip"]')).toHaveLength(1);
    expect(tooltip()?.textContent).toBe("개인/법인");
    act(() => {
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(tooltip()).toBeNull();
  });

  it("renders no button for fields without a distinct hint or custom fields", () => {
    renderOpen();
    expect(hintBtn("이름")).toBeNull();
    expect(hintBtn("메모칸")).toBeNull();
    expect(el!.textContent).toContain("메모칸");
  });

  it("keeps each input labelled and the button outside the label", () => {
    renderOpen();
    const btn = hintBtn("개업일")!;
    expect(btn.closest("label")).toBeNull();
    const label = [...el!.querySelectorAll("label")].find((l) => l.textContent === "개업일")!;
    const input = document.getElementById(label.htmlFor);
    expect(input?.tagName).toBe("INPUT");
  });
});
