// @vitest-environment jsdom
import * as React from "react";
import { act, createElement as h, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MobileTools from "@/app/(app)/payment/_components/MobileTools";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
const me = vi.hoisted(() => ({ data: { cohort: "10", feedbackFolderId: "", driveLinkStatus: "" }, refetch: vi.fn() }));
vi.mock("@/query/me-hook", () => ({ useMe: () => me }));
let root: Root;
let el: HTMLDivElement;
let hover = false;
const news = vi.fn();
const changes = vi.fn();
function Harness() {
  const [value, setValue] = useState("");
  return h(MobileTools, { value, onChange: (v: string) => { changes(v); setValue(v); }, matchCount: value ? 2 : 8, total: 8, onNews: news });
}
function getTool(id: string) { return el.querySelector<HTMLElement>(`[data-payment-tool="${id}"]`)!; }
function pointer(node: HTMLElement, type: string, kind: string) {
  const event = new MouseEvent(type, { bubbles: true });
  Object.defineProperty(event, "pointerType", { value: kind });
  act(() => { node.dispatchEvent(event); });
}
function click(node: HTMLElement, detail = 1) {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true, detail });
  act(() => { node.dispatchEvent(event); });
  return event.defaultPrevented;
}
function tap(node: HTMLElement, kind = "touch") { pointer(node, "pointerdown", kind); return click(node); }
beforeEach(() => {
  me.data.feedbackFolderId = ""; hover = false;
  vi.stubGlobal("matchMedia", () => ({ matches: hover }));
  vi.stubGlobal("fetch", vi.fn());
  el = document.createElement("div"); document.body.append(el); root = createRoot(el);
  act(() => root.render(h(Harness)));
});
afterEach(() => { act(() => root.unmount()); el.remove(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("payment mobile tools: explicit activation", () => {
  it("touch pointerenter/focus cannot arm the first tap; second opens only the existing Drive panel", () => {
    const drive = getTool("drive");
    pointer(drive, "pointerover", "touch");
    pointer(drive, "pointerdown", "touch");
    act(() => drive.focus()); click(drive);
    expect(drive.dataset.expanded).toBe("true");
    expect(el.querySelector("#drive-link-panel")).toBeNull();
    tap(drive);
    expect(el.querySelector("#drive-link-panel")).not.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    expect(news).not.toHaveBeenCalled();
  });
  it.each(["touch", "pen"])("%s news tap 1 expands and tap 2 calls the existing guarded action", (kind) => {
    tap(getTool("news"), kind); expect(news).not.toHaveBeenCalled();
    tap(getTool("news"), kind); expect(news).toHaveBeenCalledTimes(1);
  });
  it("a zero-detail touch click cannot masquerade as keyboard activation", () => {
    const button = getTool("news"); pointer(button, "pointerdown", "touch");
    click(button, 0); expect(news).not.toHaveBeenCalled();
    pointer(button, "pointerdown", "touch"); click(button, 0);
    expect(news).toHaveBeenCalledTimes(1);
  });
  it("linked Drive and manual retain native anchors but cancel first touch navigation", () => {
    me.data.feedbackFolderId = "synthetic-folder";
    act(() => root.render(h(Harness)));
    const drive = getTool("drive");
    expect(drive.tagName).toBe("A");
    expect(drive.getAttribute("href")).toBe("https://drive.google.com/drive/folders/synthetic-folder");
    expect(tap(drive)).toBe(true);
    // Observe native dispatch cancellation only; do not execute an external destination.
    expect(tap(drive)).toBe(false);
    expect(tap(getTool("manual"))).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("actual mouse hover expands without action; its first click acts", () => {
    hover = true;
    const button = getTool("news"); pointer(button, "pointerover", "mouse");
    expect(button.dataset.expanded).toBe("true"); expect(news).not.toHaveBeenCalled();
    tap(button, "mouse"); expect(news).toHaveBeenCalledTimes(1);
  });
  it("mouse without hover capability follows two-step activation", () => {
    const button = getTool("news"); pointer(button, "pointerover", "mouse");
    expect(button.dataset.expanded).toBe("false");
    tap(button, "mouse"); expect(news).not.toHaveBeenCalled();
  });
  it("keyboard focus exposes label, click detail 0 executes, Escape/outside collapse", () => {
    const button = getTool("news"); act(() => button.focus());
    expect(button.dataset.expanded).toBe("true"); click(button, 0);
    expect(news).toHaveBeenCalledTimes(1);
    act(() => button.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(button.dataset.expanded).toBe("false");
    tap(button); pointer(document.body, "pointerdown", "touch");
    expect(button.dataset.expanded).toBe("false");
  });
  it("keyboard Space activates the native manual anchor without hover or a first-click gate", () => {
    const manual = getTool("manual");
    const observed = vi.fn((event: Event) => event.preventDefault());
    manual.addEventListener("click", observed);
    act(() => manual.focus());
    act(() => manual.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true })));
    expect(observed).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("collapsed search has an explicit visible-state hook while its query stays applied", () => {
    act(() => root.render(h(MobileTools, { value: "긴 합성 검색어", onChange: changes, matchCount: 1, total: 8, onNews: news })));
    expect(getTool("search").dataset.queryActive).toBe("true");
    expect(getTool("search").getAttribute("title")).toContain("긴 합성 검색어");
    expect(getTool("search").dataset.expanded).toBe("false");
  });
  it("first search tap focuses input; close preserves query and explicit clear resets it", () => {
    tap(getTool("search"));
    let input = el.querySelector<HTMLInputElement>('input[aria-label="업체명 검색"]')!;
    expect(document.activeElement).toBe(input);
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "가나");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(changes).toHaveBeenLastCalledWith("가나");
    expect(el.textContent).toContain("2개 업체 일치");
    pointer(document.body, "pointerdown", "touch");
    expect(el.querySelector("input")).toBeNull();
    expect(getTool("search").dataset.queryActive).toBe("true");
    expect(getTool("search").getAttribute("aria-label")).toContain("가나");
    tap(getTool("search")); input = el.querySelector("input")!;
    expect(input.value).toBe("가나");
    click(el.querySelector<HTMLElement>('button[aria-label="검색 초기화"]')!);
    expect(input.value).toBe(""); expect(document.activeElement).toBe(input);
    pointer(document.body, "pointerdown", "touch");
    expect(getTool("search").dataset.queryActive).toBe("false");
    expect(fetch).not.toHaveBeenCalled();
  });
});
