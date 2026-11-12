// @vitest-environment jsdom
/**
 * 간편인증 받을 서류 — 재무제표 다사업장 안내(belie 2026-11-12, A+B).
 *  ① 재무제표 칩 옆 「표준재무제표증명 설명 보기」 버튼을 누르면 말풍선(role=tooltip)에 다사업장 안내가 뜬다.
 *  ② 재무제표가 골라져 있으면(기본) 칩 아래 주의 한 줄이 보이고, 빼면 사라진다(휴대폰은 마우스 올림이 없어서).
 *  ③ 다른 서류에는 설명 버튼이 없다.
 */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import RequestForm from "@/components/simple-auth/RequestForm";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; });

function mount() {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(h(RequestForm, { onSend: async () => true, busy: false })));
  return host;
}

const CAUTION = "사업장이 1곳일 때만";

describe("재무제표 다사업장 안내", () => {
  it("① 설명 버튼을 누르면 말풍선이 뜬다", () => {
    const el = mount();
    const btn = el.querySelector<HTMLButtonElement>('button[aria-label="표준재무제표증명 설명 보기"]');
    expect(btn).not.toBeNull();
    act(() => btn!.click());
    const tip = document.querySelector('[role="tooltip"]');
    expect(tip?.textContent).toContain("사업장이 여러 곳이면 안 들어와요");
    expect(tip?.textContent).toContain("사업자별로 직접 발급");
  });

  it("② 고르면 주의 한 줄이 보이고, 빼면 사라진다", () => {
    const el = mount();
    expect(el.textContent).toContain(CAUTION);
    const fs = [...el.querySelectorAll("label")].find(l => l.textContent?.startsWith("표준재무제표증명"));
    act(() => fs!.querySelector("input")!.click());
    expect(el.textContent).not.toContain(CAUTION);
  });

  it("③ 다른 서류에는 설명 버튼이 없다", () => {
    const el = mount();
    const btns = [...el.querySelectorAll("button")].filter(b => b.getAttribute("aria-label")?.endsWith("설명 보기"));
    expect(btns.map(b => b.getAttribute("aria-label"))).toEqual(["표준재무제표증명 설명 보기"]);
  });
});
