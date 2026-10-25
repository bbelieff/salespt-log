// @vitest-environment jsdom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ContractPayment } from "@/types";
import { contract, slot } from "./follow-ups-factories";
import ContractRow from "@/app/(app)/payment/_components/ContractRow";

const guard = vi.hoisted(() => ({ id: "", save: undefined as undefined | (() => Promise<void>) }));
vi.mock("@/components/DirtyGuard", () => ({ useDirtyEntry: (id: string, dirty: boolean, save: () => Promise<void>) => { guard.id = id; guard.save = dirty ? save : undefined; } }));
vi.mock("@/query/todos-hooks", () => ({ useTodosByContract: () => ({ data: { todos: [] } }) }));
vi.mock("@/app/(app)/payment/_components/TodoSection", () => ({ default: () => null }));
vi.mock("@/app/(app)/payment/_components/GrantMatchBox", () => ({ default: () => null, grantMatchCount: () => 0 }));
vi.mock("@/app/(app)/payment/_components/LinkedFieldsEditor", () => ({ default: () => null }));
vi.mock("@/components/CompanyInfoContractSection", () => ({ default: () => null }));
vi.mock("@/app/(app)/payment/_components/useContractCompanyInfo", () => ({ useContractCompanyInfo: () => ({ ciDirty: false, ciPending: false, ciState: {}, flushCi: vi.fn(), onCiChange: vi.fn(), resetCi: vi.fn() }) }));

let host: HTMLDivElement, root: Root;
let cp: ContractPayment;
let save: ReturnType<typeof vi.fn<(next: ContractPayment) => Promise<void>>>;
const render = () => act(() => root.render(h(ContractRow, { cp, ordinal: 1, pending: false, forceOpen: true, onSave: save, onDeleteRequest: vi.fn(), onTerminateRequest: vi.fn() })));
const field = (placeholder: string) => host.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[placeholder="${placeholder}"]`)!;
const type = (input: HTMLInputElement | HTMLTextAreaElement, value: string) => act(() => {
  const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
});
const wait = (ms = 1500) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const blur = (input: HTMLElement, next: EventTarget | null = null) => act(() => input.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: next })));
beforeEach(() => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers(); guard.save = undefined;
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  cp = contract({ 수납1: slot({ 진행기관: "샘플기관" }) });
  save = vi.fn(async (_next: ContractPayment) => {}); render();
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it.each(["예: 소진공", "예: 혁신성장촉진자금 일반형", "예: 실사 진행 중", "이 기관 진행 메모", "전체 진행 로드맵", "계약 관련 특약·지급 조건"])("does not save while slowly typing into %s; saves the final value on field blur", async placeholder => {
  const input = field(placeholder);
  expect(input).not.toBeNull();
  act(() => input.focus());
  for (const value of ["ㅎ", "한", "한글 완성"]) {
    type(input, value); await wait();
    expect(save).not.toHaveBeenCalled();
  }
  expect(guard.save).toBeDefined();
  blur(input, field("예: 혁신성장촉진자금 일반형")); await wait();
  expect(save).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(save.mock.calls[0]![0])).toContain("한글 완성");
  expect(input.value).toBe("한글 완성");
});

it("keeps a composed Korean draft unsent even across a long input pause", async () => {
  const input = field("예: 소진공");
  act(() => input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true })));
  type(input, "소지"); await wait(5000); expect(save).not.toHaveBeenCalled();
  act(() => input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "소진공" })));
  type(input, "소진공"); blur(input); await wait();
  expect(save).toHaveBeenCalledTimes(1); expect(save.mock.calls[0]![0].수납1.진행기관).toBe("소진공");
});

it("does not replace the next focused draft or cursor with an older save ACK/refetch", async () => {
  let finish!: () => void;
  save.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  const first = field("예: 소진공"), second = field("예: 혁신성장촉진자금 일반형");
  type(first, "기관 최종"); blur(first, second); await wait();
  expect(save).toHaveBeenCalledTimes(1);
  act(() => second.focus()); type(second, "다음 입력"); second.setSelectionRange(2, 2);
  await act(async () => { finish(); await Promise.resolve(); });
  cp = save.mock.calls[0]![0]; render(); await wait(5000);
  expect(second.value).toBe("다음 입력"); expect(second.selectionStart).toBe(2);
  expect(document.activeElement).toBe(second); expect(save).toHaveBeenCalledTimes(1);
  blur(second); await wait();
  expect(save).toHaveBeenCalledTimes(2); expect(save.mock.calls[1]![0].수납1.진행상품).toBe("다음 입력");
});

it("retains a failed draft and saves only after explicit retry", async () => {
  save.mockRejectedValueOnce(new Error("합성 저장 실패"));
  const input = field("이 기관 진행 메모"); type(input, "보존할 메모"); blur(input); await wait();
  expect(save).toHaveBeenCalledTimes(1); expect(input.value).toBe("보존할 메모");
  expect(host.textContent).toContain("저장 실패"); await wait(5000); expect(save).toHaveBeenCalledTimes(1);
  const retry = [...document.querySelectorAll("button")].find(b => /다시 시도|재시도/.test(b.textContent ?? ""))!;
  expect(retry).toBeDefined(); act(() => retry.click()); await wait();
  expect(save).toHaveBeenCalledTimes(2); expect(save.mock.calls[1]![0].수납1.메모).toBe("보존할 메모");
});

it("flushes the final draft through the existing leave guard before switching company", async () => {
  const input = field("예: 소진공"); type(input, "전환 전 최종 기관");
  await act(async () => { await guard.save!(); });
  expect(save).toHaveBeenCalledTimes(1); expect(save.mock.calls[0]![0].row).toBe(3);
  cp = contract({ row: 9, 업체명: "샘플 두 번째 업체" }); render();
  expect(field("예: 소진공").value).toBe(""); await wait(); expect(save).toHaveBeenCalledTimes(1);
});

it("continues autosaving discrete progress choices without typing", async () => {
  const select = [...host.querySelectorAll("select")].find(s => [...s.options].some(o => o.value === "40%"))!;
  act(() => { select.value = "40%"; select.dispatchEvent(new Event("change", { bubbles: true })); }); await wait();
  expect(save).toHaveBeenCalledTimes(1); expect(save.mock.calls[0]![0].수납1.진행률).toBe("40%");
});

it("does not commit a new draft while moving to its own undo/retry portal", async () => {
  const dock = document.createElement("div"), button = document.createElement("button");
  dock.setAttribute("data-payment-feedback-dock", ""); dock.setAttribute("data-payment-feedback-owner", guard.id);
  dock.append(button); document.body.append(dock);
  try {
    const input = field("이 기관 진행 메모"); type(input, "아직 입력 중"); blur(input, button); await wait();
    expect(save).not.toHaveBeenCalled(); expect(input.value).toBe("아직 입력 중");
  } finally { dock.remove(); }
});
