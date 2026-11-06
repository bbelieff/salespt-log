// @vitest-environment jsdom
/** 사전 등록 카드 「이메일 연결」 탭(2026-11-06 belie) — 기수·이름·이메일을 보내고 결과를 보인다. 가상 값만. */
import React, { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
import UnifiedPrepCard from "@/components/auth/UnifiedPrepCard";

let host: HTMLDivElement, root: Root, calls: unknown[];
beforeEach(() => {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host); calls = []; refresh.mockClear();
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const type = (label: string, value: string) => {
  const el = host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
};
async function open(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => { calls.push(JSON.parse(String(init.body))); return new Response(JSON.stringify(body), { status }); }));
  await act(async () => root.render(createElement(UnifiedPrepCard, { busy: false, onSubmitSingle: vi.fn(), onSubmitBulk: vi.fn() })));
  await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent === "이메일 연결")!.click());
  type("연결할 기수", "0"); type("연결할 이름", "코스텝"); type("연결할 이메일", "coach@example.test");
  await act(async () => { host.querySelector("form")!.requestSubmit(); await new Promise(r => setTimeout(r, 0)); });
}

describe("이메일 연결 탭", () => {
  it("기수·이름·이메일을 보내고 성공 안내 + 목록 새로고침", async () => {
    await open(200, { ok: true });
    expect(calls).toEqual([{ cohort: "0", name: "코스텝", email: "coach@example.test" }]);
    expect(host.textContent).toContain("0기 코스텝 에 coach@example.test 을 연결했어요");
    expect(refresh).toHaveBeenCalled();
  });
  it("서버가 막으면 이유를 그대로 보인다", async () => {
    await open(400, { error: "0기 코스텝 사전등록 줄을 찾지 못했어요. 먼저 사전 등록해 주세요." });
    expect(host.textContent).toContain("사전등록 줄을 찾지 못했어요");
    expect(refresh).not.toHaveBeenCalled();
  });
});
