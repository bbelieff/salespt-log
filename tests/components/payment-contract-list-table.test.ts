// @vitest-environment jsdom
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ContractPayment } from "@/types";
import ContractListTable from "@/app/(app)/payment/_components/ContractListTable";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
const slot = (over: Record<string, unknown> = {}) => ({ 진행기관: "", 진행상품: "", 진행률: "", 현황: "", 승인금액: 0, 수납액: 0, 수납일: "", 메모: "", ...over });
const cp = (over: Record<string, unknown> = {}): ContractPayment => ({
  row: 3, 계약일: "2026-09-04", 업체명: "한빛상사", 수임비: 5_000_000, 계약비고: "",
  공동인증서: false, 임대차계약서: false, 신분증: false, 드라이브업로드: false,
  사업계획서초안발송: false, 컨설팅5종서류발송: false, 플러그이관: false,
  수납1: slot({ 진행기관: "미소재단", 진행률: "80%", 수납액: 1_200_000 }),
  수납2: slot(), 수납3: slot(), 로드맵메모: "", 해지일: "", 해지사유: "", 반환액: 0, 해지숨김: false, ...over,
} as ContractPayment);

let root: Root | undefined;
let el: HTMLDivElement | undefined;
function renderList(props: React.ComponentProps<typeof ContractListTable>) {
  el = document.createElement("div"); document.body.append(el); root = createRoot(el);
  act(() => root?.render(h(ContractListTable, props))); return el;
}
afterEach(() => { act(() => root?.unmount()); el?.remove(); root = undefined; el = undefined; });

describe("ContractListTable 1뎁스 카드", () => {
  it("업체명·계약일/수임비·수수료·진행만 compact하게 표시한다", () => {
    const node = renderList({ rows: [cp()], selectedRow: 3, onSelect: vi.fn() });
    expect(node.querySelector('[role="listbox"]')).not.toBeNull();
    expect(node.textContent).toContain("한빛상사");
    expect(node.textContent).toContain("9/4 · 수임비 ₩5,000,000");
    expect(node.textContent).toContain("수수료 ₩1,200,000");
    expect(node.textContent).toContain("진행 80%");
    expect(node.textContent).toContain("조회 중");
    expect(node.querySelector("table")).toBeNull();
  });
  it("선택 대비를 유지하고 다른 업체만 선택 콜백을 부른다", () => {
    const onSelect = vi.fn(); const second = cp({ row: 4, 업체명: "두리상회" });
    const node = renderList({ rows: [cp(), second], selectedRow: 3, onSelect });
    const selected = node.querySelector('[role="option"][aria-selected="true"]') as HTMLButtonElement;
    expect(selected.dataset.row).toBe("3"); expect(selected.className).toContain("from-blue-100");
    act(() => selected.click()); expect(onSelect).not.toHaveBeenCalled();
    act(() => (node.querySelector('[data-row="4"]') as HTMLButtonElement).click());
    expect(onSelect).toHaveBeenCalledWith(4);
  });
  it("빈 진행은 0%로 명시한다", () => {
    const bare = cp({ 수납1: slot(), 수납2: slot(), 수납3: slot() });
    const node = renderList({ rows: [bare], selectedRow: 3, onSelect: vi.fn() });
    expect(node.textContent).toContain("수수료 ₩0"); expect(node.textContent).toContain("진행 0%");
  });
});

describe("payment PC workspace 배선", () => {
  const src = readFileSync(join(process.cwd(), "app/(app)/payment/page.tsx"), "utf8");
  it("목록과 상세를 리사이즈 가능한 2열로 두고 각각 독립 스크롤한다", () => {
    expect(src).toContain("gridTemplateColumns: `${masterWidth}px 8px minmax(0, 1fr)`");
    expect(src).toContain("aria-label=\"목록과 상세 너비 조절\"");
    expect((src.match(/max-h-\[calc\(100vh-230px\)\] overflow-y-auto/g) ?? []).length).toBe(2);
  });
  it("선택 업체명 배너와 성과 요약을 사용한다", () => {
    expect(src).toContain("<PaymentPerformanceSummary"); expect(src).toContain("{selectedCp.업체명}");
    expect(src).toContain("from-blue-100/95 via-indigo-50/95 to-white/95");
  });
  it("모바일은 기존 ContractRow 목록을 유지한다", () => {
    expect(src).toContain("visibleRows.map((cp, i) =>"); expect((src.match(/<ContractRow/g) ?? []).length).toBe(2);
  });
});
