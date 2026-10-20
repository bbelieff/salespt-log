// @vitest-environment jsdom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import Feedback, { isPaymentFeedbackTarget, shouldCommitPaymentBlur } from "@/app/(app)/payment/_components/PaymentMobileSaveFeedback";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement, root: Root | undefined;
let props: React.ComponentProps<typeof Feedback>;
let compact = true;
const listeners = new Set<() => void>();
const toast = () => document.querySelector<HTMLElement>("[data-payment-save-toast]");
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const render = (patch: Partial<typeof props> = {}) => {
  props = { ...props, ...patch };
  act(() => root!.render(h(Feedback, props)));
};
beforeEach(() => {
  vi.useFakeTimers(); compact = true; listeners.clear();
  vi.stubGlobal("matchMedia", vi.fn(() => ({ get matches() { return compact; }, addEventListener: (_: string, fn: () => void) => listeners.add(fn), removeEventListener: (_: string, fn: () => void) => listeners.delete(fn) })));
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  props = { ownerId: ":synthetic:owner:", status: "idle", savedAt: null, dirty: false, ciSaving: false, ciDirty: false, ciError: null, resetEpoch: 0, canUndo: false, onUndo: vi.fn() };
  render();
});
afterEach(() => { act(() => root?.unmount()); host.remove(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it("does not invent an initial saved notification or add a flow element", () => {
  expect(toast()).toBeNull();
  expect(host.querySelector("[data-payment-feedback-anchor]")?.hasAttribute("hidden")).toBe(true);
  expect(host.querySelector("[data-payment-feedback-dock]")).toBeNull();
});
it("delays pending, updates one notice after ACK, fades, and retains an independent undo action", () => {
  render({ status: "pending", dirty: true }); advance(179); expect(toast()).toBeNull();
  advance(1); expect(toast()?.textContent).toBe("저장중");
  render({ status: "saved", savedAt: 1, dirty: false, canUndo: true });
  expect(document.querySelectorAll("[data-payment-save-toast]")).toHaveLength(1); expect(toast()?.textContent).toBe("저장완료");
  expect(toast()?.querySelector('.payment-save-check svg')).not.toBeNull();
  advance(1000); expect(toast()?.dataset.phase).toBe("leaving");
  advance(160); expect(toast()).toBeNull();
  const undo = document.querySelector<HTMLButtonElement>("[data-payment-feedback-undo]")!;
  expect(undo.disabled).toBe(false); expect(undo.closest("[data-payment-save-toast]")).toBeNull();
  act(() => undo.click()); expect(props.onUndo).toHaveBeenCalledOnce();
});
it("does not flicker a pending notice for a fast ACK", () => {
  render({ status: "pending", dirty: true }); advance(50);
  render({ status: "saved", savedAt: 1, dirty: false });
  expect(toast()?.dataset.kind).toBe("saved"); advance(180);
  expect(document.querySelectorAll("[data-payment-save-toast]")).toHaveLength(1);
});
it("cancels a prior success timer when a new save starts", () => {
  render({ status: "saved", savedAt: 1 }); advance(900);
  render({ status: "pending", dirty: true }); advance(400);
  expect(toast()?.dataset.kind).toBe("saving"); expect(toast()?.dataset.phase).toBe("visible");
  render({ status: "saved", savedAt: 2, dirty: false }); advance(999);
  expect(toast()?.dataset.phase).toBe("visible");
});
it("does not announce an old ACK while a newer draft is dirty", () => {
  render({ status: "pending", dirty: true }); advance(180);
  render({ status: "saved", savedAt: 1, dirty: true }); advance(2000);
  expect(toast()).toBeNull();
});
it("does not invent success when pending is cancelled without an ACK", () => {
  render({ status: "pending", dirty: true }); advance(180);
  render({ status: "idle", dirty: false }); expect(toast()).toBeNull();
});
it("handles an ACK arriving before the pending status settles", () => {
  render({ status: "pending", dirty: true }); advance(180);
  render({ savedAt: 1, dirty: false });
  render({ status: "saved" }); expect(toast()?.dataset.kind).toBe("saved");
});
it("uses a clean successful company-info completion, not an error, as success", () => {
  render({ ciSaving: true, ciDirty: true }); advance(180); expect(toast()?.dataset.kind).toBe("saving");
  render({ ciSaving: false, ciDirty: false }); expect(toast()?.dataset.kind).toBe("saved");
  render({ ciSaving: true, ciDirty: true });
  render({ ciSaving: false, ciError: "합성 오류" }); expect(toast()).toBeNull();
});
it("suppresses a company-info discard completion through the UI reset epoch", () => {
  render({ ciSaving: true, ciDirty: true }); advance(180);
  render({ ciSaving: false, ciDirty: false, resetEpoch: 1 }); advance(2000);
  expect(toast()).toBeNull();
});
it("clears transient success on failure but keeps undo discoverable and disabled", () => {
  render({ status: "saved", savedAt: 1, canUndo: true });
  render({ status: "error", dirty: true }); advance(2000);
  expect(toast()).toBeNull(); expect(document.querySelector<HTMLButtonElement>("[data-payment-feedback-undo]")?.disabled).toBe(true);
});
it("cleans its owner when the selected detail is hidden and does not replay success on reopen", async () => {
  render({ status: "pending", dirty: true }); advance(180);
  await act(async () => { host.hidden = true; await Promise.resolve(); });
  expect(document.querySelector("[data-payment-feedback-dock]")).toBeNull();
  render({ status: "saved", savedAt: 1, dirty: false });
  await act(async () => { host.hidden = false; await Promise.resolve(); });
  expect(toast()).toBeNull();
});
it("clears mobile notices on a noncompact viewport without changing callbacks", () => {
  render({ status: "pending", dirty: true }); advance(180);
  act(() => { compact = false; listeners.forEach((fn) => fn()); });
  advance(2000); expect(document.querySelector("[data-payment-feedback-dock]")).toBeNull(); expect(props.onUndo).not.toHaveBeenCalled();
});
it("cancels all timers on unmount", () => {
  render({ status: "saved", savedAt: 1 }); expect(vi.getTimerCount()).toBeGreaterThan(0);
  act(() => root!.unmount()); root = undefined; expect(vi.getTimerCount()).toBe(0);
});
it("recognizes only the exact owner attribute including colon IDs and resets an ownership change", () => {
  render({ status: "saved", savedAt: 1, canUndo: true });
  const undo = document.querySelector('[data-payment-feedback-undo]')!;
  expect(isPaymentFeedbackTarget(undo, ":synthetic:owner:")).toBe(true);
  expect(isPaymentFeedbackTarget(undo, ":foreign:owner:")).toBe(false);
  expect(isPaymentFeedbackTarget(document.body, ":synthetic:owner:")).toBe(false);
  expect(isPaymentFeedbackTarget(null, ":synthetic:owner:")).toBe(false);
  render({ ownerId: ":next:owner:", canUndo: false });
  expect(toast()).toBeNull();
  expect(document.querySelector('[data-payment-feedback-dock]')?.getAttribute('data-payment-feedback-owner')).toBe(":next:owner:");
});
it("preserves real focus/blur commits except when entering the exact owned portal", () => {
  const commit = vi.fn();
  const outside = document.createElement("button"); document.body.append(outside);
  const foreign = document.createElement("div"); foreign.setAttribute("data-payment-feedback-dock", ""); foreign.setAttribute("data-payment-feedback-owner", ":foreign:");
  const foreignButton = document.createElement("button"); foreign.append(foreignButton); document.body.append(foreign);
  act(() => root!.render(h("div", { onBlur: (event: React.FocusEvent<HTMLDivElement>) => { if (shouldCommitPaymentBlur(event.currentTarget, event.relatedTarget, props.ownerId)) commit(); } },
    h("input", { "data-scope-input": "" }), h("button", { "data-scope-inside": "" }, "inside"), h(Feedback, { ...props, canUndo: true }))));
  const input = host.querySelector<HTMLInputElement>("input")!;
  const undo = document.querySelector<HTMLButtonElement>("[data-payment-feedback-undo]")!;
  act(() => { input.focus(); undo.focus(); }); expect(commit).not.toHaveBeenCalled(); expect(document.activeElement).toBe(undo);
  act(() => outside.focus()); expect(commit).toHaveBeenCalledTimes(1);
  act(() => { input.focus(); foreignButton.focus(); }); expect(commit).toHaveBeenCalledTimes(2);
  act(() => { input.focus(); host.querySelector<HTMLButtonElement>("[data-scope-inside]")!.focus(); }); expect(commit).toHaveBeenCalledTimes(2);
  act(() => { input.focus(); input.blur(); }); expect(commit).toHaveBeenCalledTimes(3);
  outside.remove(); foreign.remove();
});
it("keeps controls out of title buttons, respects reduced motion, and removes compact flow reservations", () => {
  const css = readFileSync("app/(app)/payment/payment-company-compact.css", "utf8");
  expect(css).toContain('[data-payment-inline-detail]>[data-payment-sticky-bar]{display:none}');
  expect(css).toContain('[data-payment-mobile-compact] [data-payment-inline-detail]>[data-payment-main-content]{margin-top:0}');
  expect(css).toContain('top:calc(var(--app-header-height) + 3rem)');
  expect(css).toContain('@media(prefers-reduced-motion:reduce)'); expect(css).toContain('.payment-mobile-save-notice,.payment-save-check{animation:none;transition:none}');
  expect(css).toContain('background:var(--liquid-glass-surface)');expect(css).toContain('backdrop-filter:var(--liquid-glass-filter)');
  expect(css).toContain('gap:6px;min-height:44px;max-width:calc(100vw - 140px)');expect(css).toContain('>button{order:-1;pointer-events:auto;flex:none}');
  expect(css).toContain('flex:0 0 88px;width:88px;min-height:30px;pointer-events:none');
  const row = readFileSync("app/(app)/payment/_components/ContractRow.tsx", "utf8");
  expect(row).toContain('data-payment-inline-error'); expect(row).toContain('className="payment-mobile-feedback-retry min-h-11');
  expect(row).toContain('setFeedbackResetEpoch((value) => value + 1)');
  expect(row).toContain('shouldCommitPaymentBlur(e.currentTarget, e.relatedTarget, dirtyEntryId)');
  expect(row).not.toContain('fromFeedback');
  expect(document.querySelector('[data-payment-feedback-dock] button button')).toBeNull();
});
