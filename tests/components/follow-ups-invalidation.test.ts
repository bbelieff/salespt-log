// @vitest-environment jsdom
/**
 * 대시보드 「오늘 챙길 일」 새로고침 경로 — 일정·실무/수납에서 저장하고 돌아오면 칩이 바로 줄어야 한다.
 * 미팅 뮤테이션 5종은 ['month'](월 미팅)와 cpKey(계약 cascade)를, 계약 핵심필드 수정·행 삭제는
 * ['todos']·['month']를 무효화한다. 죽은 키 ['payments']는 더 쓰지 않는다.
 */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useAppendMeeting,
  usePatchMeeting,
  useRemoveMeeting,
  useRevertMeeting,
  useReviveCaseClosure,
} from "@/lib/query/contact-hooks";
import { useEditContractLinkedFields, useRemoveContractPayment } from "@/lib/query/contract-payment-hooks";
import { meeting } from "./follow-ups-factories";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

let root: Root;
let host: HTMLDivElement;
let client: QueryClient;

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, id: "x", failures: [] }) })));
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

type Hooks = {
  append: ReturnType<typeof useAppendMeeting>;
  patch: ReturnType<typeof usePatchMeeting>;
  revert: ReturnType<typeof useRevertMeeting>;
  revive: ReturnType<typeof useReviveCaseClosure>;
  remove: ReturnType<typeof useRemoveMeeting>;
  editLinked: ReturnType<typeof useEditContractLinkedFields>;
  removeContract: ReturnType<typeof useRemoveContractPayment>;
};

function mount(): Hooks {
  const hooks = {} as Hooks;
  function Probe() {
    hooks.append = useAppendMeeting();
    hooks.patch = usePatchMeeting();
    hooks.revert = useRevertMeeting();
    hooks.revive = useReviveCaseClosure();
    hooks.remove = useRemoveMeeting();
    hooks.editLinked = useEditContractLinkedFields();
    hooks.removeContract = useRemoveContractPayment();
    return null;
  }
  act(() => root.render(h(QueryClientProvider, { client }, h(Probe))));
  return hooks;
}

async function keysInvalidatedBy(run: () => Promise<unknown>): Promise<string[]> {
  const spy = vi.spyOn(client, "invalidateQueries");
  await act(async () => { await run(); });
  const keys = spy.mock.calls.map(([filters]) => JSON.stringify((filters as { queryKey?: unknown })?.queryKey));
  spy.mockRestore();
  return keys;
}

describe("미팅 뮤테이션 → 월 미팅·계약 무효화", () => {
  const cases: Array<[string, (hooks: Hooks) => Promise<unknown>]> = [
    ["useAppendMeeting", (x) => x.append.mutateAsync({ date: "2026-10-12", meeting: meeting() })],
    ["usePatchMeeting", (x) => x.patch.mutateAsync({ date: "", weekStart: "2026-10-09", id: "m1", partial: { 상태: "완료" } })],
    ["useRevertMeeting", (x) => x.revert.mutateAsync({ id: "m1", weekStart: "2026-10-09" })],
    ["useReviveCaseClosure", (x) => x.revive.mutateAsync({ id: "m1" })],
    ["useRemoveMeeting", (x) => x.remove.mutateAsync({ date: "2026-10-12", id: "m1" })],
  ];
  for (const [name, run] of cases) {
    it(`${name} 성공 시 ['month']와 ['contract-payment']를 무효화하고 죽은 ['payments']는 쓰지 않는다`, async () => {
      const hooks = mount();
      const keys = await keysInvalidatedBy(() => run(hooks));
      expect(keys).toContain('["month"]');
      expect(keys).toContain('["meeting-follow-ups"]');
      expect(keys).toContain('["contract-payment"]');
      expect(keys).not.toContain('["payments"]');
    });
  }
});

describe("계약 재연결·삭제 cascade → 할 일·월 미팅 무효화", () => {
  it("useEditContractLinkedFields", async () => {
    const hooks = mount();
    const keys = await keysInvalidatedBy(() => hooks.editLinked.mutateAsync({ old: { 계약일: "2026-09-01", 업체명: "샘플상사" }, next: { 업체명: "샘플 새이름상사" } }));
    expect(keys).toEqual(expect.arrayContaining(['["contract-payment"]', '["todos"]', '["month"]']));
  });
  it("useRemoveContractPayment", async () => {
    const hooks = mount();
    const keys = await keysInvalidatedBy(() => hooks.removeContract.mutateAsync({ row: 3, cascade: true }));
    expect(keys).toEqual(expect.arrayContaining(['["contract-payment"]', '["todos"]', '["month"]']));
  });
});
