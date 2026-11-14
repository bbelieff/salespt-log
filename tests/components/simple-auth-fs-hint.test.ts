// @vitest-environment jsdom
/**
 * 간편인증 받을 서류 — 재무제표 다사업장 안내(belie 2026-11-12, A+B) + 사업자번호 칸(같은 날, 사업장별 요청).
 *  ④ 재무제표를 고르면 사업자번호 칸이 보이고, 넣은 번호는 하이픈 모양으로 정리돼 요청에 실린다. 잘못 넣으면 보내지 않는다.
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

function mount(onSend: (body: Record<string, unknown>) => Promise<boolean> = async () => true) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(h(RequestForm, { onSend, busy: false })));
  return host;
}
/** React 가 알아채도록 입력 칸 값을 바꾼다. */
function type(el: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
  act(() => { el.dispatchEvent(new Event("input", { bubbles: true })); });
}

const CAUTION = "아래 칸에 사업자번호를 넣어 주세요";

describe("재무제표 다사업장 안내", () => {
  it("① 설명 버튼을 누르면 말풍선이 뜬다", () => {
    const el = mount();
    const btn = el.querySelector<HTMLButtonElement>('button[aria-label="표준재무제표증명 설명 보기"]');
    expect(btn).not.toBeNull();
    act(() => btn!.click());
    const tip = document.querySelector('[role="tooltip"]');
    expect(tip?.textContent).toContain("사업장이 여러 곳이면 사업자번호가 필요해요");
    expect(tip?.textContent).toContain("사업장마다 3년치");
  });

  it("② 고르면 주의 한 줄이 보이고, 빼면 사라진다", () => {
    const el = mount();
    expect(el.textContent).toContain(CAUTION);
    const fs = [...el.querySelectorAll("label")].find(l => l.textContent?.startsWith("표준재무제표증명"));
    act(() => fs!.querySelector("input")!.click());
    expect(el.textContent).not.toContain(CAUTION);
  });

  it("④ 사업자번호를 넣으면 요청에 실리고(하이픈 정리·중복 제거), 잘못 넣으면 보내지 않는다", async () => {
    const sent: Record<string, unknown>[] = [];
    const el = mount(async (b) => { sent.push(b); return true; });
    const text = (label: string) => [...el.querySelectorAll("label")].find(l => l.textContent?.startsWith(label))!;
    const field = (label: string) => document.getElementById(text(label).htmlFor) as HTMLInputElement;
    type(field("대표 이름"), "김가상");
    type(field("생년월일"), "19780312");
    type(el.querySelector<HTMLInputElement>('input[aria-label="대표 휴대폰"]')!, "010-0000-1234");
    const biz = field("사업자번호");
    type(biz, "214-88-7712");
    await act(async () => { el.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(sent).toHaveLength(0);
    expect(el.textContent).toContain("사업자번호 10자리를 쉼표로");
    type(biz, "2148877123, 214-12-90311 214-88-77123");
    await act(async () => { el.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(sent[0]).toMatchObject({ mode: "simple", bizNos: ["214-88-77123", "214-12-90311"] });
  });

  it("③ 다른 서류에는 설명 버튼이 없다", () => {
    const el = mount();
    const btns = [...el.querySelectorAll("button")].filter(b => b.getAttribute("aria-label")?.endsWith("설명 보기"));
    expect(btns.map(b => b.getAttribute("aria-label"))).toEqual(["표준재무제표증명 설명 보기"]);
  });
});
