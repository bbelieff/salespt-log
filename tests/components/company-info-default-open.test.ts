// @vitest-environment jsdom
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CompanyInfoEditor from "@/components/CompanyInfoEditor";
import CompanyInfoContractSection from "@/components/CompanyInfoContractSection";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
vi.mock("@/components/company-info/CompanyVaultSection", () => ({ default: () => null }));
let root: Root;
let host: HTMLDivElement;
const save = vi.fn();
const change = vi.fn();
function toggle() {
  const button = [...host.querySelectorAll("button")].find((b) => b.textContent?.startsWith("🏢 업체정보"))!;
  act(() => button.click());
}
beforeEach(() => {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ 업체정보: {} }) })));
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("shared CompanyInfoEditor initial openness", () => {
  it.each([
    [undefined, undefined, false], [true, undefined, true], [false, undefined, false],
    [true, false, false], [false, true, true], [undefined, true, true],
  ])("hideSave=%s defaultOpen=%s starts open=%s without saves", (hideSave, defaultOpen, open) => {
    act(() => root.render(h(CompanyInfoEditor, { hideSave, defaultOpen, onSave: save, onChange: change })));
    expect(!!host.querySelector('input[id$="-대표자이름"]')).toBe(open);
    expect(save).not.toHaveBeenCalled(); expect(change).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it("close/reopen retains embedded draft and adds no save, POST or onChange", () => {
    act(() => root.render(h(CompanyInfoEditor, { hideSave: true, defaultOpen: false, onSave: save, onChange: change })));
    toggle();
    const input = host.querySelector<HTMLInputElement>('input[id$="-대표자이름"]')!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "합성초안");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const edits = change.mock.calls.length;
    toggle(); toggle();
    expect(host.querySelector<HTMLInputElement>('input[id$="-대표자이름"]')!.value).toBe("합성초안");
    expect(change).toHaveBeenCalledTimes(edits); expect(save).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it("section forwards false and keyed company changes restart closed; only GET runs", async () => {
    const render = async (name: string) => {
      await act(async () => { root.render(h(CompanyInfoContractSection, { 계약일: "2026-10-17", 업체명: name, identityKey: "synthetic-stable-row", hideSave: true, defaultOpen: false })); });
    };
    await render("합성업체A"); expect(host.querySelector('input[id$="-대표자이름"]')).toBeNull();
    toggle(); expect(host.querySelector('input[id$="-대표자이름"]')).not.toBeNull();
    await render("합성업체B"); expect(host.querySelector('input[id$="-대표자이름"]')).toBeNull();
    expect(vi.mocked(fetch).mock.calls.every(([, init]) => !init?.method || init.method === "GET")).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });
});
