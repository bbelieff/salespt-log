// @vitest-environment jsdom
/** 수료생 주간 목표 카드: 모바일 기본 접힘 · PC 기본 펼침 · 한 번 고르면 기억(belie 2026-11-05). */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/weekly-goals/WeeklyGoalSummary", () => ({
  default: ({ onCollapse }: { onCollapse?: () => void }) =>
    h("section", { "data-summary": "" }, h("button", { "aria-label": "주간 목표 접기", onClick: onCollapse }, "접기")),
}));

import CollapsibleGoalCard, { goalCardStorageKey } from "@/components/dashboard/CollapsibleGoalCard";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  localStorage.clear();
});

function mount(layout: "mobile" | "pc") {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(h(CollapsibleGoalCard, { layout })));
  return host;
}
const remount = (layout: "mobile" | "pc") => {
  act(() => root?.unmount());
  host?.remove();
  return mount(layout);
};

describe("CollapsibleGoalCard", () => {
  it("모바일은 처음에 접혀 있고, 펼치면 기억한다", () => {
    const el = mount("mobile");
    expect(el.querySelector("[data-summary]")).toBeNull();
    const expand = el.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')!;
    act(() => expand.click());
    expect(el.querySelector("[data-summary]")).not.toBeNull();
    expect(localStorage.getItem(goalCardStorageKey("mobile"))).toBe("1");
    expect(remount("mobile").querySelector("[data-summary]")).not.toBeNull();
  });
  it("PC 는 처음에 펼쳐 있고, 접으면 다음에도 접혀 있다", () => {
    const el = mount("pc");
    expect(el.querySelector("[data-summary]")).not.toBeNull();
    act(() => el.querySelector<HTMLButtonElement>('[aria-label="주간 목표 접기"]')!.click());
    expect(el.querySelector("[data-summary]")).toBeNull();
    expect(remount("pc").querySelector('button[aria-expanded="false"]')).not.toBeNull();
  });
  it("모바일·PC 기억은 따로다", () => {
    localStorage.setItem(goalCardStorageKey("pc"), "0");
    expect(mount("mobile").querySelector("[data-summary]")).toBeNull();
    expect(localStorage.getItem(goalCardStorageKey("mobile"))).toBeNull();
  });
});
