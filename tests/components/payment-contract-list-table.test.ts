// @vitest-environment jsdom
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ContractPayment } from "@/types";
import ContractListTable from "@/app/(app)/payment/_components/ContractListTable";
import PaymentSortControl from "@/app/(app)/payment/_components/PaymentSortControl";
import { buildCompanyWorkItems } from "@/app/(app)/payment/_lib/company-work-view";
import { buildInstitutionWorkItems } from "@/app/(app)/payment/_lib/institution-view";
import PaymentSelectionBridge, { syncPaymentSelectionBridge } from "@/app/(app)/payment/_components/PaymentSelectionBridge";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
const slot = (over: Record<string, unknown> = {}) => ({ 진행기관: "", 진행상품: "", 진행률: "", 현황: "", 승인금액: 0, 수납액: 0, 수납일: "", 메모: "", ...over });
const cp = (over: Record<string, unknown> = {}): ContractPayment => ({
  row: 3, 계약일: "2026-09-04", 업체명: "한빛상사", 수임비: 5_000_000, 계약비고: "",
  공동인증서: false, 임대차계약서: false, 신분증: false, 드라이브업로드: false,
  사업계획서초안발송: false, 컨설팅5종서류발송: false, 플러그이관: false,
  수납1: slot({ 진행기관: "미소재단", 진행률: "80%", 수납액: 1_200_000 }),
  수납2: slot(), 수납3: slot(), 로드맵메모: "", 해지일: "", 해지사유: "", 반환액: 0, 해지숨김: false, ...over,
} as ContractPayment);
const itemsFor = (rows: ContractPayment[]) => buildCompanyWorkItems(rows, buildInstitutionWorkItems(rows));

let root: Root | undefined;
let el: HTMLDivElement | undefined;
function renderList(props: React.ComponentProps<typeof ContractListTable>) {
  el = document.createElement("div"); document.body.append(el); root = createRoot(el);
  act(() => root?.render(h(ContractListTable, props))); return el;
}
afterEach(() => { act(() => root?.unmount()); el?.remove(); root = undefined; el = undefined; });

describe("ContractListTable 1뎁스 카드", () => {
  it("업체명·진행 슬롯·계약일/수임비·수수료를 compact하게 표시한다", () => {
    const node = renderList({ items: itemsFor([cp()]), selectedKey: "3-1", onSelect: vi.fn() });
    expect(node.querySelector('[role="listbox"]')).not.toBeNull();
    expect(node.textContent).toContain("한빛상사");
    expect(node.textContent).toContain("9/4 · 수임비 ₩5,000,000");
    expect(node.textContent).toContain("수수료 ₩1,200,000");
    expect(node.textContent).toContain("진행 80%");
    expect(node.textContent).toContain("진행 1 · 미소재단");
    expect(node.querySelector("table")).toBeNull();
  });
  it("선택 대비를 유지하고 다른 업체만 선택 콜백을 부른다", () => {
    const onSelect = vi.fn(); const second = cp({ row: 4, 업체명: "두리상회" });
    const node = renderList({ items: itemsFor([cp(), second]), selectedKey: "3-1", onSelect });
    const selected = node.querySelector('[role="option"][aria-selected="true"]') as HTMLButtonElement;
    expect(selected.dataset.row).toBe("3"); expect(selected.className).toContain("from-blue-100");
    act(() => selected.click()); expect(onSelect).not.toHaveBeenCalled();
    act(() => (node.querySelector('[data-row="4"]') as HTMLButtonElement).click());
    expect(onSelect.mock.calls[0]?.[0].key).toBe("4-1");
  });
  it("진행 없는 업체는 한 행으로 남기고 D-??와 구별한다", () => {
    const bare = cp({ 수납1: slot(), 수납2: slot(), 수납3: slot() });
    const node = renderList({ items: itemsFor([bare]), selectedKey: "3-1", onSelect: vi.fn() });
    expect(node.textContent).toContain("수수료 ₩0"); expect(node.textContent).toContain("진행 0%");
    expect(node.textContent).toContain("진행 없음"); expect(node.textContent).not.toContain("D-??");
  });
  it("진행마다 Todo 날짜를 따로 표시한다", () => {
    const items = itemsFor([cp({ 수납2: slot({ 진행기관: "소진공" }) })]);
    items[0]!.work = { ...items[0]!.work, activityKind: "todo", activityDate: "2026-09-28", activityLabel: "D-00" };
    const node = renderList({ items, selectedKey: "3-1", onSelect: vi.fn(), activityState: "ready" });
    expect(node.textContent).toContain("Todo D-00");
    expect(node.querySelector('[aria-label="미완료 Todo D-00"]')).not.toBeNull();
    expect(node.querySelectorAll('[role="option"]')).toHaveLength(2);
    expect(node.querySelector('[data-work-key="3-2"]')?.textContent).toContain("D-??");
  });
  it("활동 조회 중에는 미기록으로 표시하지 않는다", () => {
    const node = renderList({ items: itemsFor([cp()]), selectedKey: "3-1", onSelect: vi.fn(), activityState: "loading" });
    expect(node.querySelector('[aria-label="활동 불러오는 중"]')).not.toBeNull();
    expect(node.textContent).not.toContain("D-??");
  });
  it("모바일에서 선택한 진행 행 바로 아래에 상세가 열린다", () => {
    const node = renderList({ items: itemsFor([cp()]), selectedKey: "3-1", onSelect: vi.fn(), renderDetail: () => h("div", null, "진행 상세") });
    expect(node.querySelector('[data-work-key="3-1"]')?.getAttribute("aria-expanded")).toBe("true");
    expect(node.querySelector('#payment-company-detail-3-1')?.textContent).toBe("진행 상세");
  });
});

describe("payment PC workspace 배선", () => {
  const src = readFileSync(join(process.cwd(), "app/(app)/payment/page.tsx"), "utf8");
  it("PC 작업판의 목록·상세 좌·우가 각각 스크롤하고 선택 연결부는 작업판에 둔다", () => {
    expect(src).toContain("gridTemplateColumns: `${masterWidth}px 8px minmax(0, 1fr)`");
    expect(src).toContain("aria-label=\"목록과 상세 너비 조절\"");
    expect(src).toContain("payment-list-scroll");
    expect(src).toContain("payment-detail-shell");
    expect(src).toContain("<PaymentSelectionBridge");
    expect(src).toContain("new MutationObserver(sync)");
    expect(src).not.toContain("sticky top-app-content flex h-[calc(100vh-7rem)]");
    const detail = readFileSync(join(process.cwd(), "app/(app)/payment/_components/ContractRow.tsx"), "utf8");
    expect((detail.match(/payment-detail-scroll/g) ?? []).length).toBe(2);
  });
  it("선택 업체명 배너와 성과 요약을 사용한다", () => {
    expect(src).toContain("<PaymentPerformanceSummary"); expect(src).toContain("{selectedCp.업체명}");
    expect(src).toContain("from-blue-100/95 via-indigo-50/95 to-white/95");
  });
  it("모바일 업체·기관 모드 모두 진행 행 아래의 상세와 해당 슬롯을 연결한다", () => {
    expect(src).toContain('items={companyItems} selectedKey={selectedCompanyKey}');
    expect(src).toContain('listMode === "institution" ? <InstitutionWorkList');
    expect(src).toContain('renderDetail={(item) =>');
    expect(src).toContain('forceOpen inline');
    expect(src).toContain("institution-detail-${selectedCp.row}");
    expect((src.match(/<ContractRow/g) ?? []).length).toBe(3);
    expect(src).toContain("focusedSlot={item.hasProgress ? item.work.slot : null}");
  });
});

describe("업체 보기 정렬 버튼", () => {
  it("등록 빠른순·등록 늦은순·D-day순만 표시한다", () => {
    el = document.createElement("div"); document.body.append(el); root = createRoot(el);
    const onChange = vi.fn();
    act(() => root?.render(h(PaymentSortControl, { value: "date-asc", onChange })));
    expect(Array.from(el.querySelectorAll("button"), (button) => button.textContent)).toEqual(["등록 빠른순", "등록 늦은순", "D-day순"]);
    act(() => (el?.querySelectorAll("button")[2] as HTMLButtonElement).click());
    expect(onChange).toHaveBeenCalledWith("dday");
  });
});

describe("선택 행과 상세의 연결부", () => {
  it("상세 외곽선에만 닿고 접힌 기관 헤더로 옮겨 붙으며 스크롤 밖에서는 숨는다", () => {
    const workspace = document.createElement("div");
    const pane = document.createElement("div");
    const row = document.createElement("button");
    const activeHeader = document.createElement("button");
    const detail = document.createElement("div");
    row.setAttribute("aria-selected", "true");
    activeHeader.dataset.activeInstitution = "true";
    detail.className = "payment-detail-shell";
    pane.append(activeHeader, row); workspace.append(pane, detail); document.body.append(workspace);
    const host = document.createElement("div"); workspace.append(host);
    const svgRoot = createRoot(host);
    act(() => svgRoot.render(h(PaymentSelectionBridge)));
    const bridge = host.querySelector("svg")!;
    const rect = (left: number, top: number, right: number, bottom: number) =>
      ({ left, top, right, bottom, width: right - left, height: bottom - top }) as DOMRect;
    vi.spyOn(workspace, "getBoundingClientRect").mockReturnValue(rect(0, 0, 800, 500));
    vi.spyOn(pane, "getBoundingClientRect").mockReturnValue(rect(0, 0, 380, 500));
    vi.spyOn(activeHeader, "getBoundingClientRect").mockReturnValue(rect(10, 30, 360, 65));
    const rowRect = vi.spyOn(row, "getBoundingClientRect").mockReturnValue(rect(10, 100, 360, 170));
    vi.spyOn(detail, "getBoundingClientRect").mockReturnValue(rect(382, 0, 800, 500));

    syncPaymentSelectionBridge(workspace, pane, bridge);
    expect(bridge.style.opacity).toBe("1");
    expect(bridge.style.left).toBe("358px"); // 박스 테두리와 2px 겹쳐 시작
    expect(bridge.style.width).toBe("26px"); // 겹침 2 + 틈 22 + 패널 외곽선 덮기 2
    expect(bridge.style.top).toBe("0px");
    expect(bridge.style.height).toBe("500px");
    expect(bridge.querySelector("[data-bridge-fill]")?.getAttribute("d")).toContain("L 26 88.5 L 26 181.5 L 24.5 181.5");
    expect(bridge.querySelector("[data-bridge-fill]")?.getAttribute("d")).not.toContain(" 500");
    // 이어지는 구간엔 세로 외곽선이 없다 — 곡선 두 개만.
    expect(bridge.querySelector("[data-bridge-edge]")?.getAttribute("d")).not.toContain(" 500");
    expect(bridge.querySelector("[data-bridge-edge]")?.getAttribute("d")).toBe("M 0 100.5 L 12.5 100.5 A 12 12 0 0 0 24.5 88.5 L 24.5 86.5 M 24.5 183.5 L 24.5 181.5 A 12 12 0 0 0 12.5 169.5 L 0 169.5");

    row.remove();
    syncPaymentSelectionBridge(workspace, pane, bridge);
    expect(bridge.style.opacity).toBe("1");
    expect(bridge.querySelector("[data-bridge-fill]")?.getAttribute("d")).toContain("M 0 30.5 ");
    expect(bridge.querySelector("[data-bridge-fill]")?.getAttribute("d")).toContain("24.5 18.5 L 26 18.5 L 26 76.5");

    pane.append(row);
    rowRect.mockReturnValue(rect(10, 520, 360, 590));
    syncPaymentSelectionBridge(workspace, pane, bridge);
    expect(bridge.style.opacity).toBe("0");
    act(() => svgRoot.unmount()); workspace.remove();
  });
});
