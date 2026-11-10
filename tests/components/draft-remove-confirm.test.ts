// @vitest-environment jsdom
/** 새 미팅 카드 「✕ 삭제」 확인 (2026-11-10 UI 점검): 적은 내용이 있으면 묻고, 빈 카드는 바로 지운다. 가상 값만. */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { draftHasContent, useDraftRemoveConfirm, type DraftLike } from "@/components/meeting-safety/use-draft-remove-confirm";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
beforeAll(() => {
  // jsdom 에 showModal 이 없을 수 있다.
  if (!HTMLDialogElement.prototype.showModal) HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { this.open = true; };
});

const empty: DraftLike = { 미팅시간: "", 업체명: "", 장소: "", 예약비고: "" };

describe("draftHasContent", () => {
  it("빈 카드·공백만 있는 카드는 내용 없음", () => {
    expect(draftHasContent(empty)).toBe(false);
    expect(draftHasContent({ ...empty, 업체명: "  ", 업체정보: { 대표자: "" } })).toBe(false);
  });
  it("업체명·장소·시간·비고·업체정보 중 하나라도 있으면 내용 있음", () => {
    expect(draftHasContent({ ...empty, 업체명: "가상상사" })).toBe(true);
    expect(draftHasContent({ ...empty, 미팅시간: "14:00" })).toBe(true);
    expect(draftHasContent({ ...empty, 업체정보: { 대표자: "홍길동(가상)" } })).toBe(true);
  });
});

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; });

function mount() {
  const api: { request?: (d: DraftLike) => Promise<boolean> } = {};
  function Probe() { const c = useDraftRemoveConfirm(); api.request = c.request; return c.element; }
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(h(Probe)));
  const btn = (t: string) => [...document.body.querySelectorAll("button")].find((b) => b.textContent === t);
  return { api, btn };
}

describe("useDraftRemoveConfirm", () => {
  it("빈 카드는 묻지 않고 바로 지운다", async () => {
    const { api } = mount();
    await expect(api.request!(empty)).resolves.toBe(true);
    expect(document.querySelector("dialog")).toBeNull();
  });
  it("★내용이 있으면 묻고, 「돌아가기」면 지우지 않는다", async () => {
    const { api, btn } = mount();
    let p!: Promise<boolean>;
    act(() => { p = api.request!({ ...empty, 업체명: "가상상사" }); });
    expect(document.body.textContent).toContain("가상상사");
    act(() => btn("돌아가기")!.click());
    await expect(p).resolves.toBe(false);
  });
  it("「카드 지우기」를 눌러야 지운다", async () => {
    const { api, btn } = mount();
    let p!: Promise<boolean>;
    act(() => { p = api.request!({ ...empty, 장소: "가상카페" }); });
    act(() => btn("카드 지우기")!.click());
    await expect(p).resolves.toBe(true);
  });
});

describe("컨택 화면 연결", () => {
  it("새 카드 삭제가 확인을 거친다", () => {
    const page = readFileSync("app/(app)/contact/page.tsx", "utf8");
    expect(page).toContain("await draftConfirm.request(target)");
    expect(page).toContain("{draftConfirm.element}");
  });
});
