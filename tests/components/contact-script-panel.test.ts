// @vitest-environment jsdom
/** 업체정보 팝업 「대본」 — 보기 칸 세 개, 대본·문자 보기, 수정→저장, 문자 복사. 가상 글만. */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import ContactScriptPanel from "@/components/company-info/ContactScriptPanel";
import CompanyInfoLayoutToggle from "@/components/company-info/CompanyInfoLayoutToggle";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.unstubAllGlobals();
});

function mount(el: React.ReactElement) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => root!.render(h(QueryClientProvider, { client: qc }, el)));
  return host;
}
// fetch → Response.json() → react-query 반영이 여러 틱에 걸쳐 끝난다 — 한 틱만 기다리면 부하 때 「불러오는 중」에서 멈춰 보인다(2026-11-05 CI 간헐 실패).
const flush = () => act(async () => {
  for (let t = 0; t < 5; t++) {
    for (let i = 0; i < 5; i++) await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
  }
});
/** 불러오기가 끝날 때까지(최대 2초) — 전체 시험이 함께 돌아 느릴 때 정해진 한 번의 flush 로는 모자라다. */
const settle = async (done: () => boolean) => {
  for (let i = 0; i < 100 && !done(); i++) await flush();
};
const btn = (el: HTMLElement, text: string) => [...el.querySelectorAll("button")].find((b) => b.textContent === text);

describe("보기 칸", () => {
  it("onScript 를 주면 「대본」 이 붙고, 대본을 보는 동안 보기 칸은 눌리지 않은 모양", () => {
    const onScript = vi.fn();
    const onChange = vi.fn();
    const el = mount(h(CompanyInfoLayoutToggle, { layout: "basic", onChange, scriptOn: true, onScript }));
    expect(btn(el, "대본")!.getAttribute("aria-pressed")).toBe("true");
    expect(btn(el, "기본보기")!.getAttribute("aria-pressed")).toBe("false");
    act(() => btn(el, "확장보기")!.click());
    expect(onScript).toHaveBeenCalledWith(false);
    expect(onChange).toHaveBeenCalledWith("extended");
  });
  it("onScript 가 없으면(접힌 카드) 「대본」 은 없다", () => {
    const el = mount(h(CompanyInfoLayoutToggle, { layout: "basic", onChange: () => {} }));
    expect(btn(el, "대본")).toBeUndefined();
  });
});

describe("ContactScriptPanel", () => {
  it("내 대본을 보여 주고, 수정해 저장하면 PUT 후 저장한 글로 보인다", async () => {
    const fetchMock = vi.fn(async (_u: string, init?: RequestInit) => {
      if (init?.method === "PUT") return new Response(JSON.stringify({ ...JSON.parse(String(init.body)), custom: true }));
      return new Response(JSON.stringify({ script: "가상 대본", sms: "가상 문자", custom: false }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const el = mount(h(ContactScriptPanel));
    await settle(() => !!el.textContent?.includes("가상 대본"));
    expect(el.textContent).toContain("가상 대본");
    expect(el.textContent).toContain("기본 대본이에요");
    act(() => btn(el, "수정")!.click());
    const area = el.querySelector('textarea[aria-label="컨택 대본"]') as HTMLTextAreaElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    act(() => {
      setter.call(area, "고친 대본");
      area.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => btn(el, "저장")!.click());
    await settle(() => !el.querySelector("textarea"));
    const putCall = fetchMock.mock.calls.find((c) => c[1]?.method === "PUT")!;
    expect(JSON.parse(String(putCall[1]!.body))).toEqual({ script: "고친 대본", sms: "가상 문자" });
    expect(el.querySelector("textarea")).toBeNull();
    expect(el.textContent).toContain("고친 대본");
  });
  it("「복사」 는 문자 양식을 클립보드에 넣는다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ script: "s", sms: "가상 문자", custom: true }))));
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const el = mount(h(ContactScriptPanel));
    await settle(() => !!btn(el, "복사"));
    act(() => btn(el, "복사")!.click());
    await settle(() => !!el.textContent?.includes("복사했어요"));
    expect(writeText).toHaveBeenCalledWith("가상 문자");
    expect(el.textContent).toContain("복사했어요");
  });
});
