// @vitest-environment jsdom
/**
 * 신원 가드 차단막의 층·초점 (2026-11-10 UI 점검).
 * z-50 이던 때는 저장 창(z-[300])이 열려 있으면 차단막이 그 아래 깔려 [저장]을 그대로 누를 수 있었다.
 * 합성 지문만 쓴다.
 */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import IdentityGuard, { IDENTITY_GUARD_LAYER } from "@/components/auth/IdentityGuard";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.(tsx|ts|css)$/.test(name)) out.push(p);
  }
  return out;
}

describe("차단막 층", () => {
  it("★앱의 어떤 창·로딩·팝오버보다 위에 있다 (z 값 — 기본 대화상자는 아래 showModal 시험)", () => {
    const own = Number(IDENTITY_GUARD_LAYER.match(/\d+/)![0]);
    let max = 0;
    for (const f of [...files("app"), ...files("components")]) {
      if (f.endsWith(join("components", "auth", "IdentityGuard.tsx"))) continue;
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/z-\[(\d+)\]|z-index:\s*(\d+)/g)) max = Math.max(max, Number(m[1] ?? m[2]));
    }
    expect(max).toBeGreaterThanOrEqual(300);
    expect(own).toBeGreaterThan(max);
  });
});

describe("막히면 초점을 차단막으로", () => {
  let root: Root | null = null;
  let host: HTMLElement | null = null;
  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("★뒤쪽 저장 창 입력칸에 있던 초점이 버튼으로 옮겨지고, Tab 으로 돌아가지 못한다", async () => {
    // 기본 대화상자(SheetDialog 등) 위에 오려면 차단막도 showModal 로 맨 위 층에 올라가야 한다.
    const showModal = vi.fn(function (this: HTMLDialogElement) { this.setAttribute("open", ""); });
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { value: showModal, configurable: true });
    let fp = "fp-a";
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ activeFingerprint: fp, activeMasked: "합*" }) })));
    const input = document.createElement("input");
    document.body.appendChild(input);
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root!.render(h(IdentityGuard)));
    await act(async () => {});
    expect(document.querySelector("[role=alertdialog]")).toBeNull();

    input.focus();
    fp = "fp-b";
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    await act(async () => {});
    const dialog = document.querySelector("[role=alertdialog]") as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(dialog.className).toContain(IDENTITY_GUARD_LAYER);
    expect(dialog.tagName).toBe("DIALOG");
    expect(showModal).toHaveBeenCalledTimes(1);
    const button = dialog.querySelector("button")!;
    expect(document.activeElement).toBe(button);

    const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    await act(async () => { button.dispatchEvent(tab); });
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(button);
  });
});
