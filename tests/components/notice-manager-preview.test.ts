// @vitest-environment jsdom
/** 관리자 공지(2026-11-10 belie 「추천대로」): 새 공지는 꺼짐으로 시작·「켜기」로 켬, 「미리보기」는 수강생 팝업 그대로·저장 없음. 합성 값만. */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Notice } from "@/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
// 리치 에디터(tiptap) 대신 단순 textarea
vi.mock("next/dynamic", () => ({
  default: () => function Editor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return h("textarea", { "aria-label": "본문", value, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value) });
  },
}));
import NoticeManager from "@/app/admin/popup/_components/NoticeManager";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | null = null, host: HTMLDivElement | null = null;
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; sessionStorage.clear(); vi.unstubAllGlobals(); });

const existing = { id: "n1", created: "", updated: "", title: "가상 켜진 공지", bodyMd: "가상", audience: "all", displayMode: "once", start: "", end: "", pinned: false, active: true } as Notice;
function mount(notices: Notice[] = []) {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  act(() => root!.render(h(NoticeManager, { initialNotices: notices, scopeEmail: "admin@example.test" })));
  return host;
}
const button = (el: ParentNode, text: string) => [...el.querySelectorAll("button")].find(b => b.textContent?.trim() === text);
const state = (el: ParentNode) => el.querySelector('[data-testid="notice-active-state"]')!.textContent;
function type(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("관리자 공지 — 기본 꺼짐·미리보기", () => {
  it("새 공지는 꺼짐, 「켜기」를 눌러야 켜짐 — 게시 요청에 그대로 실린다", async () => {
    const posts: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: RequestInit) => {
      const b = JSON.parse(String(init!.body)); posts.push(b);
      return new Response(JSON.stringify({ ok: true, notice: { ...b, id: "n9" } }), { status: 200 });
    }));
    const el = mount();
    expect(state(el)).toBe("꺼짐");
    act(() => type(el.querySelector<HTMLInputElement>('input[placeholder="공지 제목"]')!, "가상 새 공지"));
    await act(async () => button(el, "게시")!.click());
    expect(posts[0]!.active).toBe(false);
    expect(el.textContent).toContain("아직 꺼져 있어요");
    act(() => button(el, "켜기")!.click());
    expect(state(el)).toBe("켜짐");
    await act(async () => button(el, "게시 반영")!.click());
    expect(posts[1]!.active).toBe(true);
  });

  it("기존 공지는 저장된 켜짐 그대로", () => {
    const el = mount([existing]);
    act(() => el.querySelector<HTMLButtonElement>("li button")!.click());
    expect(state(el)).toBe("켜짐");
  });

  it("미리보기는 수강생 새소식 팝업에 지금 입력을 띄우고, 저장·게시 요청 없이 닫힌다", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const el = mount();
    expect(button(el, "미리보기")!.disabled).toBe(true); // 빈 공지는 볼 게 없다
    act(() => type(el.querySelector<HTMLInputElement>('input[placeholder="공지 제목"]')!, "가상 미리보기 제목"));
    act(() => type(el.querySelector<HTMLTextAreaElement>('textarea[aria-label="본문"]')!, "가상 본문"));
    act(() => button(el, "미리보기")!.click());
    const dialog = el.querySelector('[role="dialog"][aria-label="새소식"]')!;
    expect(dialog.textContent).toContain("가상 미리보기 제목");
    act(() => button(dialog, "확인")!.click());
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(el.querySelector<HTMLInputElement>('input[placeholder="공지 제목"]')!.value).toBe("가상 미리보기 제목");
  });
});
