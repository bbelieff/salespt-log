// @vitest-environment jsdom
/**
 * StandaloneCompanyAdd — 「영업기록 없이 업체추가」 점선 버튼·인라인 폼.
 * 업체 모드에서만 그린다 · 폼을 열면 오늘(KST) 계약일 · requestKey 를 폼당 1개 만들어
 * 재시도에도 같은 키 · 성공 시 onCreated(row) · 실패 시 입력 유지 + 인라인 오류.
 */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mutation = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
vi.mock("@/query/contract-payment-hooks", () => ({ useAddStandaloneContract: () => mutation }));

import StandaloneCompanyAdd from "@/app/(app)/payment/_components/StandaloneCompanyAdd";
import { todayKST } from "@/util/week";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let root: Root | undefined;
let el: HTMLDivElement | undefined;
function render(props: React.ComponentProps<typeof StandaloneCompanyAdd>) {
  el = document.createElement("div"); document.body.append(el); root = createRoot(el);
  act(() => root?.render(h(StandaloneCompanyAdd, props))); return el;
}
function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => { setter.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
}
const q = <T extends Element>(node: Element, sel: string) => node.querySelector(sel) as T;
async function submit(node: Element) {
  await act(async () => { q<HTMLFormElement>(node, "[data-standalone-form]").requestSubmit(); });
}

beforeEach(() => { mutation.mutateAsync.mockReset(); mutation.isPending = false; });
afterEach(() => { act(() => root?.unmount()); el?.remove(); root = undefined; el = undefined; });

describe("StandaloneCompanyAdd", () => {
  it("업체 모드에서 점선 1줄 버튼을 그린다", () => {
    const node = render({ listMode: "company", onCreated: vi.fn() });
    const btn = q<HTMLButtonElement>(node, "[data-standalone-add]");
    expect(btn.textContent).toContain("영업기록 없이 업체추가");
    expect(btn.className).toContain("border-dashed");
    expect(node.querySelector("form")).toBeNull();
  });

  it("진행기관 모드에서는 아무것도 그리지 않는다", () => {
    const node = render({ listMode: "institution", onCreated: vi.fn() });
    expect(node.innerHTML).toBe("");
  });

  it("누르면 제자리에서 폼을 펼치고 계약일 기본값은 오늘(KST), 이월 안내 문구가 보인다", () => {
    const node = render({ listMode: "company", onCreated: vi.fn() });
    act(() => q<HTMLButtonElement>(node, "[data-standalone-add]").click());
    expect(node.querySelector("[data-standalone-form]")).not.toBeNull();
    expect(q<HTMLInputElement>(node, 'input[name="계약일"]').value).toBe(todayKST());
    expect(node.textContent).toContain("계약일이 수강 시작일보다 앞이면 이월로, 이후면 이번 과정 매출로 잡혀요.");
    expect(q<HTMLButtonElement>(node, 'button[type="submit"]').disabled).toBe(true); // 업체명 필수
  });

  it("추가 → requestKey 포함 payload 로 호출하고 onCreated(row), 폼은 닫힌다", async () => {
    mutation.mutateAsync.mockResolvedValue({ ok: true, row: 21 });
    const onCreated = vi.fn();
    const node = render({ listMode: "company", onCreated });
    act(() => q<HTMLButtonElement>(node, "[data-standalone-add]").click());
    type(q(node, 'input[name="업체명"]'), "  예시상사 ");
    type(q(node, 'input[name="계약일"]'), "2026-09-10");
    type(q(node, 'input[name="수임비"]'), "3000000");
    expect(q<HTMLInputElement>(node, 'input[name="수임비"]').value).toBe("3,000,000");
    await submit(node);
    expect(mutation.mutateAsync).toHaveBeenCalledTimes(1);
    const payload = mutation.mutateAsync.mock.calls[0]![0];
    expect(payload).toMatchObject({ 계약일: "2026-09-10", 업체명: "예시상사", 수임비: 3_000_000 });
    expect(payload.requestKey).toMatch(UUID);
    expect(onCreated).toHaveBeenCalledWith(21);
    expect(node.querySelector("[data-standalone-form]")).toBeNull();
  });

  it("실패하면 입력을 유지하고 오류를 보여 주며, 재시도는 같은 requestKey 를 보낸다", async () => {
    mutation.mutateAsync.mockRejectedValueOnce(new Error("시트 오류")).mockResolvedValueOnce({ ok: true, row: 7 });
    const onCreated = vi.fn();
    const node = render({ listMode: "company", onCreated });
    act(() => q<HTMLButtonElement>(node, "[data-standalone-add]").click());
    type(q(node, 'input[name="업체명"]'), "예시상사");
    await submit(node);
    expect(node.querySelector('[role="alert"]')?.textContent).toBe("시트 오류");
    expect(q<HTMLInputElement>(node, 'input[name="업체명"]').value).toBe("예시상사");
    expect(onCreated).not.toHaveBeenCalled();
    await submit(node);
    const [first, second] = mutation.mutateAsync.mock.calls.map((c) => c[0]);
    expect(second.requestKey).toBe(first.requestKey);
    expect(onCreated).toHaveBeenCalledWith(7);
  });

  it("다시 열면 새 requestKey — 다른 업체를 같은 행으로 덮어쓰지 않는다", async () => {
    mutation.mutateAsync.mockResolvedValue({ ok: true, row: 1 });
    const node = render({ listMode: "company", onCreated: vi.fn() });
    for (const name of ["가나상사", "다라상사"]) {
      act(() => q<HTMLButtonElement>(node, "[data-standalone-add]").click());
      type(q(node, 'input[name="업체명"]'), name);
      await submit(node);
    }
    const [a, b] = mutation.mutateAsync.mock.calls.map((c) => c[0]);
    expect(a.requestKey).not.toBe(b.requestKey);
  });

  it("요청 중에는 추가 버튼이 비활성", () => {
    mutation.isPending = true;
    const node = render({ listMode: "company", onCreated: vi.fn() });
    act(() => q<HTMLButtonElement>(node, "[data-standalone-add]").click());
    type(q(node, 'input[name="업체명"]'), "예시상사");
    const btn = q<HTMLButtonElement>(node, 'button[type="submit"]');
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain("추가 중");
  });
});
