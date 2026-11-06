// @vitest-environment jsdom
/** 📜 대본 보기(2026-11-07 belie 모바일 기획 2판) — 통화 줄 버튼으로 열고, 📞 로 건 뒤 거는 창이 닫히면 열려 있다. 가상 업체·번호·글만. */
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { blank } from "@/app/(app)/db-sheet/_components/model";
import { useCallUi } from "@/app/(app)/db-sheet/_components/CallUi";
import type { DbSheetLead } from "@/types/db-sheet";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement, root: Root;
const row = { ...blank(), id: "00000000-0000-4000-8000-000000000031", company: "가상상사", owner: "김가상", phone: "010-0000-3131" };

function Harness() {
  const ui = useCallUi([row] as unknown as DbSheetLead[], () => {});
  return h("div", null, ui.bar(row), ui.slot(row).button, ui.layer);
}

beforeEach(() => {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  HTMLDialogElement.prototype.showModal = vi.fn(); HTMLDialogElement.prototype.close = vi.fn();
  localStorage.clear(); sessionStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/calls" && init?.method === "POST") return new Response(JSON.stringify({ id: "call-31" }));
    if (url === "/api/calls") return new Response(JSON.stringify({ calls: [] }));
    if (url.startsWith("/api/contact-script")) return new Response(JSON.stringify({ script: "가상 통화 대본", sms: "가상 문자", custom: false }));
    return new Response("{}", { status: 404 });
  }));
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const flush = () => act(async () => { for (let t = 0; t < 5; t++) { for (let i = 0; i < 5; i++) await Promise.resolve(); await new Promise(r => setTimeout(r, 0)); } });
const settle = async (done: () => boolean) => { for (let i = 0; i < 100 && !done(); i++) await flush(); };
const button = (text: string) => [...host.querySelectorAll("button")].find(b => b.textContent === text);
const mount = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => root.render(h(QueryClientProvider, { client: qc }, h(Harness))));
  await settle(() => !!button("대본 보기"));
};

it("통화 줄의 「대본 보기」를 누르면 내 대본 창이 열리고, 닫기로 원래 화면", async () => {
  await mount();
  expect(host.querySelector('dialog[aria-label="가상상사 통화 대본"]')).toBeNull();
  await act(async () => button("대본 보기")!.click());
  await settle(() => !!host.textContent?.includes("가상 통화 대본"));
  expect(host.querySelector('dialog[aria-label="가상상사 통화 대본"]')).not.toBeNull();
  expect(host.textContent).toContain("가상 통화 대본");
  await act(async () => button("닫기")!.click());
  expect(host.querySelector('dialog[aria-label="가상상사 통화 대본"]')).toBeNull();
});

it("📞 로 실제로 걸면(기본 전화 앱) 거는 창이 닫히며 대본 창이 열려 있다", async () => {
  localStorage.setItem("db-sheet-call-app", "phone");
  const assign = vi.fn();
  vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, set href(v: string) { assign(v); } } as unknown as Location);
  await mount();
  await act(async () => (host.querySelector('button[aria-label="가상상사 전화 걸기"]') as HTMLButtonElement).click());
  await settle(() => !!host.querySelector('dialog[aria-label="가상상사 통화 대본"]'));
  expect(assign).toHaveBeenCalledWith("tel:01000003131");
  expect(host.querySelector('dialog[aria-label="가상상사 통화 대본"]')).not.toBeNull();
});

it("걸지 않고 거는 창을 닫으면 대본 창은 열리지 않는다", async () => {
  await mount();
  await act(async () => (host.querySelector('button[aria-label="가상상사 전화 걸기"]') as HTMLButtonElement).click());
  expect(host.textContent).toContain("어느 앱으로 걸까요?");
  await act(async () => (host.querySelector('dialog button[aria-label="닫기"]') as HTMLButtonElement).click());
  await flush();
  expect(host.querySelector('dialog[aria-label="가상상사 통화 대본"]')).toBeNull();
});
