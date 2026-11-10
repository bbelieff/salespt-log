// @vitest-environment jsdom
/** 간편인증 서류 조회: 처리 중엔 버튼이 잠기고, 진행 중 취소는 확인을 묻는다 (2026-11-10 UI 점검). 가상 값만. */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import RequestList from "@/components/simple-auth/RequestList";
import type { AuthRequest } from "@/components/simple-auth/view";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; });

const now = Date.now();
const d = new Date();
const mmdd = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const waiting = { id: "r1", owner: "김가상", phone: "010-0000-0000", method: "카카오톡", sentAt: `${mmdd} 10:00`, status: "waiting", deadline: now + 200_000, docs: [], progress: 0, businesses: [] } as unknown as AuthRequest;

function mount(busy: boolean) {
  const a = { detail: () => null, onApproved: vi.fn(), onResend: vi.fn(), onCancel: vi.fn(), onDelete: vi.fn() };
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(h(RequestList, { items: [waiting], now, busy, ...a })));
  const btn = (t: string) => [...host!.querySelectorAll("button")].find((b) => b.textContent?.includes(t));
  return { a, btn };
}

describe("RequestList 처리 중", () => {
  it("한가할 땐 승인 확인·다시·취소를 누를 수 있다", () => {
    const { a, btn } = mount(false);
    act(() => btn("승인 확인")!.click());
    expect(a.onApproved).toHaveBeenCalledWith("r1");
  });
  it("★처리 중엔 승인 확인·다시·취소가 잠겨 같은 요청이 두 번 가지 않는다", () => {
    const { a, btn } = mount(true);
    for (const t of ["승인 확인", "다시", "취소"]) expect(btn(t)!.disabled).toBe(true);
    act(() => btn("승인 확인")!.click());
    expect(a.onApproved).not.toHaveBeenCalled();
  });
});

describe("패널", () => {
  const s = readFileSync("components/simple-auth/SimpleAuthPanel.tsx", "utf8");
  it("★요청이 끝나기 전 두 번째 요청은 막는다(연타)", () => {
    expect(s.match(/if \(inFlight\.current\) return false;/g)).toHaveLength(2);
  });
  it("진행 중 취소는 확인을 묻는다", () => {
    expect(s).toContain('if (window.confirm("보낸 인증을 취소할까요?');
  });
  it("실패 안내는 10초 두고 직접 닫을 수 있다", () => {
    expect(s).toContain("toastError ? 10_000 : 3500");
    expect(s).toContain('aria-label="안내 닫기"');
  });
});
