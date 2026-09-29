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
    { key: "3-1", contractKey: "row:3", row: 3, slot: 1, company: "한빛상사", institution: "소진공", product: "혁신성장", progress: 60, muted: false, activityKind: "todo", activityDate: "2026-09-28", activityLabel: "D-00" },
    { key: "4-2", contractKey: "row:4", row: 4, slot: 2, company: "두리상사", institution: "소진공", product: "일반형", progress: 20, muted: false, activityKind: "none", activityDate: "", activityLabel: "D-??" },
  ] },
  { institution: "신보", count: 1, items: [
    { key: "5-1", contractKey: "row:5", row: 5, slot: 1, company: "가온상사", institution: "신보", product: "", progress: 0, muted: false, activityKind: "history", activityDate: "2026-09-27", activityLabel: "D+01" },
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
    const activeHeader = node.querySelector('section > [data-active-institution="true"]') as HTMLButtonElement;
    // 선택된 진행건이 든 기관은 눌러도 접히지 않는다(belie 2026-09-29).
    act(() => activeHeader.click());
    expect(activeHeader.getAttribute("aria-expanded")).toBe("true");
    expect(node.querySelector('[data-work-key="3-1"]')).not.toBeNull();
    expect(activeHeader.className).toContain("bg-red-50");
  });

  it("모바일 선택 행 바로 아래에 상세를 붙이고 접어도 편집기를 마운트 상태로 보존한다", () => {
    node = document.createElement("div"); document.body.append(node); root = createRoot(node);
    const onSelect = vi.fn();
    const onToggleDetail = vi.fn();
    const props = { groups, selectedKey: "3-1", onSelect, onToggleDetail, renderDetail: () => h("div", { "data-editor": true }, "업체정보 · 계약정보") };
    act(() => root?.render(h(InstitutionWorkList, { ...props, detailExpanded: true })));
    const selected = node.querySelector('[data-work-key="3-1"]') as HTMLButtonElement;
    const detail = node.querySelector('#payment-inline-detail-3-1') as HTMLDivElement;
    expect(selected.nextElementSibling).toBe(detail);
    expect(detail.hidden).toBe(false);
    expect(selected.textContent).toContain("D-00");
    act(() => selected.click());
    expect(onToggleDetail).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
    act(() => root?.render(h(InstitutionWorkList, { ...props, detailExpanded: false })));
    expect((node.querySelector('#payment-inline-detail-3-1') as HTMLDivElement).hidden).toBe(true);
    expect(node.querySelector('[data-editor]')).not.toBeNull();
    act(() => (node?.querySelector('section > button') as HTMLButtonElement).click());
    expect((node.querySelector('[role="group"]') as HTMLDivElement).hidden).toBe(false);
    expect(node.querySelector('[data-editor]')).not.toBeNull();
    act(() => root?.render(h(InstitutionWorkList, { ...props, detailExpanded: true, activityState: "loading" })));
    expect(node.querySelector('[data-work-key="3-1"]')?.textContent).not.toContain("D-00");
  });
});
