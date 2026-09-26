// @vitest-environment jsdom
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import InstitutionWorkList from "@/app/(app)/payment/_components/InstitutionWorkList";
import type { InstitutionGroup } from "@/app/(app)/payment/_lib/institution-view";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const groups: InstitutionGroup[] = [
  { institution: "소진공", count: 2, items: [
    { key: "3-1", row: 3, slot: 1, company: "한빛상사", institution: "소진공", product: "혁신성장", progress: 60, muted: false },
    { key: "4-2", row: 4, slot: 2, company: "두리상사", institution: "소진공", product: "일반형", progress: 20, muted: false },
  ] },
  { institution: "신보", count: 1, items: [
    { key: "5-1", row: 5, slot: 1, company: "가온상사", institution: "신보", product: "", progress: 0, muted: false },
  ] },
];

let root: Root | undefined;
let node: HTMLDivElement | undefined;
afterEach(() => { act(() => root?.unmount()); node?.remove(); root = undefined; node = undefined; });

describe("기관 1뎁스 목록", () => {
  it("기관을 열면 상품은 그룹이 아닌 진행건의 보조 정보로 보이고 클릭 시 정확한 건을 넘긴다", () => {
    node = document.createElement("div"); document.body.append(node); root = createRoot(node);
    const onSelect = vi.fn();
    act(() => root?.render(h(InstitutionWorkList, { groups, selectedKey: "3-1", onSelect })));
    expect(node.querySelectorAll("section")).toHaveLength(2);
    expect(node.querySelectorAll('[role="option"]')).toHaveLength(2);
    expect(node.textContent).toContain("혁신성장");
    act(() => (node?.querySelector('[data-work-key="4-2"]') as HTMLButtonElement).click());
    expect(onSelect).toHaveBeenCalledWith(groups[0]?.items[1]);
    act(() => (node?.querySelectorAll("section > button")[1] as HTMLButtonElement).click());
    expect(node.querySelector('[data-work-key="5-1"]')).not.toBeNull();
    expect(node.querySelector('[data-work-key="3-1"]')).not.toBeNull();
  });
});
