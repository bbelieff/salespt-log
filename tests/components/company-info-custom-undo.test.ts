// @vitest-environment jsdom
/**
 * 업체정보 사용자 추가 칸(기타) 지우기 → 되돌리기 (custom-field-undo, 2026-10-23).
 *  ① ✕ 를 누르면 칸이 사라지고 「되돌리기」 줄이 나온다.
 *  ② 되돌리기를 누르면 같은 값으로 원래 순서 자리에 돌아온다.
 *  ③ 되돌리기 줄은 10초 뒤 저절로 닫힌다.
 */
import * as React from "react";
import { act, createElement as h, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompanyInfo } from "@/types";
import CompanyInfoEditor from "@/components/CompanyInfoEditor";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

vi.mock("@/components/autosave/useAutosave", () => ({
  useAutosave: (opts: { initial: unknown }) => {
    const [draft, setDraft] = useState(opts.initial);
    return {
      draft, saved: draft, status: "idle", error: "", dirty: false, savedAt: null, canUndo: false,
      update: setDraft, stage: setDraft, commit: vi.fn(), syncServer: vi.fn(), retry: vi.fn(), flush: vi.fn(), undo: vi.fn(),
    };
  },
}));

let root: Root | undefined;
let el: HTMLDivElement | undefined;

function renderOpen() {
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
  const value = CompanyInfo.parse({ 커스텀: { 업체: { 첫칸: "가", 둘째칸: "나" }, 대표자: {} } });
  act(() => {
    root?.render(h(CompanyInfoEditor, { value, onSave: () => undefined, hideSave: true, defaultLayout: "extended" }));
  });
}
const labels = () => [...el!.querySelectorAll('button[aria-label$=" 칸 지우기"]')].map(b => b.getAttribute("aria-label")!.replace(" 칸 지우기", ""));
const undoBar = () => el!.querySelector<HTMLElement>("[data-custom-field-undo]");

afterEach(() => {
  act(() => root?.unmount());
  el?.remove();
  vi.useRealTimers();
});

describe("업체정보 사용자 추가 칸 되돌리기", () => {
  it("지우면 되돌리기 줄이 나오고, 누르면 같은 값으로 원래 자리에 돌아온다", () => {
    renderOpen();
    expect(labels()).toEqual(["첫칸", "둘째칸"]);
    act(() => el!.querySelector<HTMLButtonElement>('button[aria-label="첫칸 칸 지우기"]')!.click());
    expect(labels()).toEqual(["둘째칸"]);
    expect(undoBar()?.textContent).toContain("「첫칸」지웠어요");
    act(() => [...undoBar()!.querySelectorAll("button")].find(b => b.textContent === "되돌리기")!.click());
    expect(labels()).toEqual(["첫칸", "둘째칸"]);
    expect(undoBar()).toBeNull();
    const input = el!.querySelector('button[aria-label="첫칸 칸 지우기"]')!.closest("label")!.querySelector("input")!;
    expect(input.value).toBe("가");
  });

  it("되돌리기 줄은 10초 뒤 닫히고 칸은 지워진 채로 남는다", () => {
    vi.useFakeTimers();
    renderOpen();
    act(() => el!.querySelector<HTMLButtonElement>('button[aria-label="둘째칸 칸 지우기"]')!.click());
    expect(undoBar()).not.toBeNull();
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(undoBar()).toBeNull();
    expect(labels()).toEqual(["첫칸"]);
  });
});
