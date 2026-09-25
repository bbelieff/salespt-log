// @vitest-environment jsdom
/**
 * Payment desktop master — ContractListTable focused regression.
 *
 * 실제 DOM 렌더(React createRoot + act)로 검증한다:
 *  ① 실제 업체명/계약일/수임비/수납액/진행률이 기존 의미 그대로 렌더된다
 *     (수납액=슬롯 수납액 합, 진행률=contractProgress, 금액=formatMoney).
 *  ② 행 선택이 동작하고 선택 하이라이트(aria-selected)가 따라간다.
 *  ③ 정렬(행 순서 변경)해도 선택이 유지되고 onSelect 오발사 없음
 *     (= 상세 ContractRow 리마운트 없는 조건).
 *  ④ 행마다 시맨틱 <button>이 있어 키보드(Enter/Space) 선택 가능.
 *  ⑤ page 배선 구조 가드: 데스크탑 마스터는 테이블 1개 + 상세 1개뿐이고
 *     (중복 전체행 제거), 검색/정렬/선택이 guardedNav를 경유하며,
 *     합계는 전체 rows 기준을 유지하고 모바일 분기는 그대로다.
 *  ⑥ 워크스페이스 레이아웃: 1024~1399 스택, 1440+ 균등 2열(gap 12px),
 *     구 seam(음수 마진·한쪽 보더) 제거·중립 full rounded, sticky는 1440+만.
 *  ⑦ DirtyProvider 하네스: 실제 PaymentPage 렌더에서 dirty 상세 편집 후
 *     행선택/검색이 가드 모달을 띄우고, 취소는 값·선택을 유지하며,
 *     저장-이동은 저장 완료를 기다렸다가 전환한다.
 */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ContractPayment } from "@/types";
import { contractProgress } from "@/app/(app)/payment/_lib/payment-progress";
import { formatMoney } from "@/lib/format/money";
import ContractListTable from "@/app/(app)/payment/_components/ContractListTable";
import PaymentPage from "@/app/(app)/payment/page";
import DirtyProvider from "@/components/DirtyGuard";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

// PaymentPage 하네스용 목 — 쿼리 훅만 교체, ContractRow·가드·테이블은 실제품.
const harness = vi.hoisted(() => ({
  rows: [] as unknown[],
  patch: vi.fn(async () => ({})),
  remove: vi.fn(async () => ({})),
  terminate: vi.fn(async () => ({})),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/components/TopHeader", () => ({ default: () => null }));
vi.mock("@/components/CompanyInfoContractSection", () => ({ default: () => null }));
vi.mock("@/query/todos-hooks", () => ({
  useTodosByContract: () => ({ data: { todos: [] } }),
  usePatchTodo: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(async () => ({})),
    isPending: false,
  }),
  useRemoveTodo: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(async () => ({})),
    isPending: false,
  }),
  useCreateTodo: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(async () => ({})),
    isPending: false,
  }),
  newTodoOperationId: () => "test-op-id",
}));
vi.mock("@/query/me-hook", () => ({
  useMe: () => ({
    data: { courseStartISO: "", cohort: "", feedbackFolderId: "", driveLinkStatus: "" },
  }),
}));
vi.mock("@/query/contract-payment-hooks", () => ({
  useContractPayments: () => ({
    data: { rows: harness.rows },
    isLoading: false,
    isError: false,
  }),
  usePatchContractPayment: () => ({ mutateAsync: harness.patch }),
  useRemoveContractPayment: () => ({ mutateAsync: harness.remove }),
  useTerminateContract: () => ({ mutateAsync: harness.terminate }),
  useEditContractLinkedFields: () => ({ mutateAsync: vi.fn(async () => ({})) }),
  useAddPriorContract: () => ({ mutateAsync: vi.fn(async () => ({})) }),
}));

function slot(over: Record<string, string | number> = {}) {
  return {
    진행기관: "",
    진행률: "",
    현황: "",
    승인금액: 0,
    수납액: 0,
    수납일: "",
    메모: "",
    ...over,
  };
}

function cp(over: Record<string, unknown> = {}): ContractPayment {
  return {
    row: 3,
    계약일: "",
    업체명: "",
    수임비: 0,
    공동인증서: false,
    임대차계약서: false,
    신분증: false,
    드라이브업로드: false,
    사업계획서초안발송: false,
    컨설팅5종서류발송: false,
    플러그이관: false,
    수납1: slot(),
    수납2: slot(),
    수납3: slot(),
    로드맵메모: "",
    해지일: "",
    해지사유: "",
    반환액: 0,
    해지숨김: false,
    ...over,
  } as ContractPayment;
}

const ROW_A = cp({
  row: 3,
  계약일: "2026-09-04",
  업체명: "한빛상사",
  수임비: 5000000,
  수납1: slot({ 진행기관: "미소재단", 진행률: "80%", 승인금액: 2000000, 수납액: 1200000, 수납일: "2026-09-10" }),
});

const ROW_B = cp({
  row: 4,
  계약일: "2026-09-06",
  업체명: "두리상회",
  수임비: 3000000,
  수납1: slot({ 진행기관: "신보", 진행률: "100%", 승인금액: 1000000, 수납액: 1000000 }),
  수납2: slot({ 진행기관: "기보", 진행률: "0%", 승인금액: 500000, 수납액: 200000 }),
});

let root: Root | undefined;
let el: HTMLDivElement | undefined;

function renderTable(props: React.ComponentProps<typeof ContractListTable>) {
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
  act(() => {
    root?.render(h(ContractListTable, props));
  });
  return el;
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  el?.remove();
  root = undefined;
  el = undefined;
  vi.restoreAllMocks();
});

const rowsOf = (node: HTMLElement) =>
  Array.from(node.querySelectorAll("tbody tr[data-row]")) as HTMLTableRowElement[];
const selectedOf = (node: HTMLElement) => node.querySelector('tbody tr[aria-selected="true"]');

describe("ContractListTable 실제 렌더", () => {
  it("실제 금액·상태 필드를 기존 의미 그대로 표시한다", () => {
    const node = renderTable({ rows: [ROW_A, ROW_B], selectedRow: 3, onSelect: () => {} });
    const text = node.textContent ?? "";
    // 업체명 + 계약일(fmtDate M/D) + 수임비 + 수납액(슬롯 합) + 진행률(contractProgress)
    expect(text).toContain("한빛상사");
    expect(text).toContain("9/4");
    expect(text).toContain(`₩${formatMoney(5000000)}`);
    expect(text).toContain(`₩${formatMoney(1200000)}`);
    expect(text).toContain(`${contractProgress(ROW_A)}%`);
    // B: 수납액 = 1000000 + 200000 합(승인금액 아님)
    expect(text).toContain(`₩${formatMoney(3000000)}`);
    expect(text).toContain(`₩${formatMoney(1200000)}`);
    // 진행률은 하드코딩이 아니라 contractProgress 와 일치
    expect(text).toContain(`${contractProgress(ROW_B)}%`);
    // 헤더 5열
    const heads = Array.from(node.querySelectorAll("thead th")).map((th) => th.textContent);
    expect(heads).toEqual(["업체명", "계약일", "수임비", "수납액", "진행률"]);
  });

  it("수납액이 없으면 ₩0, 진행률 0이면 — 로 표시한다", () => {
    const bare = cp({ row: 5, 계약일: "2026-09-08", 업체명: "빈슬롯상사", 수임비: 1000000 });
    const node = renderTable({ rows: [bare], selectedRow: 5, onSelect: () => {} });
    const text = node.textContent ?? "";
    expect(text).toContain(`₩${formatMoney(1000000)}`);
    expect(text).toContain(`₩${formatMoney(0)}`);
    expect(text).toContain("—");
  });

  it("행 버튼 클릭이 해당 row 로 선택을 호출하고 선택 하이라이트가 따라간다", () => {
    const onSelect = vi.fn();
    const node = renderTable({ rows: [ROW_A, ROW_B], selectedRow: 3, onSelect });
    expect(selectedOf(node)?.getAttribute("data-row")).toBe("3");
    const btnB = node.querySelector('tr[data-row="4"] button') as HTMLButtonElement;
    expect(btnB?.getAttribute("aria-label")).toContain("두리상회");
    act(() => {
      btnB.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(4);
    // 이미 선택된 행 클릭은 재호출하지 않는다(불필요한 가드 발동 방지)
    onSelect.mockClear();
    const btnA = node.querySelector('tr[data-row="3"] button') as HTMLButtonElement;
    act(() => {
      btnA.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("정렬(순서 변경)해도 선택이 유지되고 onSelect가 발사되지 않는다", () => {
    const onSelect = vi.fn();
    const node = renderTable({ rows: [ROW_A, ROW_B], selectedRow: 4, onSelect });
    expect(selectedOf(node)?.getAttribute("data-row")).toBe("4");
    // 정렬된 순서로 리렌더 — 선택 prop 은 같은 row 유지
    act(() => {
      root?.render(h(ContractListTable, { rows: [ROW_B, ROW_A], selectedRow: 4, onSelect }));
    });
    expect(onSelect).not.toHaveBeenCalled();
    expect(selectedOf(node)?.getAttribute("data-row")).toBe("4");
    const first = rowsOf(node)[0]?.getAttribute("data-row");
    expect(first).toBe("4");
  });

  it("행마다 시맨틱 버튼이 있어 키보드로 선택할 수 있다", () => {
    const onSelect = vi.fn();
    const node = renderTable({ rows: [ROW_A, ROW_B], selectedRow: 3, onSelect });
    const buttons = Array.from(node.querySelectorAll("tbody tr[data-row] button"));
    expect(buttons.length).toBe(2);
    for (const b of buttons) {
      expect((b as HTMLElement).tagName).toBe("BUTTON");
      expect((b as HTMLElement).getAttribute("aria-label")).toMatch(/선택$/);
    }
    // 행은 ~40px 단일행 높이를 유지한다
    for (const tr of rowsOf(node)) {
      expect(tr.className).toContain("h-10");
    }
  });
});

describe("payment page 배선(가드·모바일·합계 기준)", () => {
  const src = readFileSync(join(process.cwd(), "app/(app)/payment/page.tsx"), "utf8");

  it("데스크탑 마스터는 경량 테이블 + 상세 ContractRow 1개뿐이다", () => {
    expect(src).toContain("<ContractListTable");
    // ContractRow 인스턴스는 상세(forceOpen) + 모바일 분기 2개뿐 — PC 카드리스트 중복 제거
    const instances = src.match(/<ContractRow/g) ?? [];
    expect(instances.length).toBe(2);
    expect(src).not.toContain("selectable");
  });

  it("검색·정렬·선택이 guardedNav를 경유한다(더티 상세 언마운트 방지)", () => {
    expect(src).toContain("onChange={(v) => guardedNav(() => setCompanyQuery(v))}");
    expect(src).toContain("onChange={(k) => guardedNav(() => setSortKey(k))}");
    expect(src).toContain("onSelect={(row) => guardedNav(() => setSelectedRow(row))}");
  });

  it("모바일 분기는 기존 아코디언 그대로다", () => {
    expect(src).toContain("모바일(<pc)");
    expect(src).toContain("visibleRows.map((cp, i) =>");
  });

  it("합계는 전체 rows(billable) 기준을 유지한다", () => {
    expect(src).toContain("billable.reduce");
    expect(src).not.toContain("visibleRows.reduce");
    expect(src).not.toContain("filteredRows.reduce");
  });
});

describe("payment workspace 레이아웃(스택→1440+ 2열)", () => {
  const src = readFileSync(join(process.cwd(), "app/(app)/payment/page.tsx"), "utf8");

  it("기본 1열 스택, 1440+에서 균등 2열·12px gap이다", () => {
    expect(src).toContain("grid-cols-1");
    // min-[1440px]:grid-cols-2 = repeat(2, minmax(0,1fr)) 균등 2열
    expect(src).toContain("min-[1440px]:grid-cols-2");
    expect(src).toContain("gap-3");
    // 구 3.5:6.5 분할 제거 — 520px 테이블이 35% 열에 갇혀 항상 스크롤되던 원인
    expect(src).not.toContain("3.5fr");
    expect(src).not.toContain("6.5fr");
  });

  it("구 seam(음수 마진·한쪽 보더·상태색 윤곽)이 없고 양쪽 다 중립 full rounded다", () => {
    expect(src).not.toContain("-mr-0.5");
    expect(src).not.toContain("border-r-0");
    expect(src).not.toContain("rounded-l-xl");
    expect(src).not.toContain("rounded-r-xl");
    expect(src).not.toContain("selAccent");
    const rounded = src.match(/rounded-xl border border-gray-200 bg-white shadow-sm/g) ?? [];
    expect(rounded.length).toBe(2); // 마스터 + 상세
  });

  it("상세 sticky는 1440+에서만, 좁은 스택 구간은 일반 흐름이다", () => {
    expect(src).toContain("min-[1440px]:sticky");
    expect(src).toContain("min-[1440px]:top-app-content");
    expect(src).not.toContain("sticky top-app-content");
  });
});

describe("payment dirty 하네스(DirtyProvider + 실제 page)", () => {
  function stubPc() {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: query.includes("1024"),
        media: query,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        dispatchEvent: () => false,
      }),
    });
  }

  function renderPage() {
    stubPc();
    harness.rows = [ROW_A, ROW_B];
    harness.patch.mockReset();
    harness.patch.mockResolvedValue({});
    el = document.createElement("div");
    document.body.append(el);
    root = createRoot(el);
    act(() => {
      root?.render(h(DirtyProvider, null, h(PaymentPage)));
    });
    return el;
  }

  const node = () => el as unknown as HTMLElement;
  const selRowOf = () =>
    node().querySelector('table[aria-label="계약 목록"] tbody tr[aria-selected="true"]')
      ?.getAttribute("data-row");
  const click = (b: Element | null) => {
    if (!b) throw new Error("Missing element");
    act(() => {
      (b as HTMLElement).click();
    });
  };
  const btnByText = (t: string) => {
    const b = [...node().querySelectorAll("button")].find(
      (x) => x.textContent?.trim() === t,
    );
    if (!b) throw new Error(`Missing button ${t}`);
    return b;
  };
  /** 상세 패널 첫 체크박스를 켜서 dirty 등록 — 실제 ContractRow 편집 경로. */
  function makeDirty() {
    const box = node().querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(box.checked).toBe(false);
    click(box);
    expect(box.checked).toBe(true);
    return box;
  }
  const guarded = () => node().textContent?.includes("저장하지 않고 나갈까요?") ?? false;

  it("dirty 상세에서 다른 행 선택 → 취소하면 값·선택이 유지된다", () => {
    renderPage();
    expect(selRowOf()).toBe("3");
    const box = makeDirty();
    const btnB = node().querySelector('tr[data-row="4"] button');
    click(btnB); // guardedNav → 모달
    expect(guarded()).toBe(true);
    click(btnByText("취소"));
    expect(guarded()).toBe(false);
    expect(selRowOf()).toBe("3"); // 전환 안 됨
    expect(box.checked).toBe(true); // 초안 값 유지
  });

  it("저장하고 이동은 저장 완료를 기다렸다가 전환한다", async () => {
    renderPage();
    makeDirty();
    let resolvePatch!: (v: any) => void;
    harness.patch.mockImplementationOnce(
      () => new Promise((r) => { resolvePatch = r; }),
    );
    click(node().querySelector('tr[data-row="4"] button'));
    expect(guarded()).toBe(true);
    click(btnByText("💾 저장하고 이동"));
    expect(node().textContent).toContain("저장 중…");
    // guard 저장 체인(saveForGuard→commit→flushCi/flush→patch)은 비동기
    // 큐를 거치므로 patch 호출까지 펌프한 뒤 resolve한다.
    await act(async () => {
      for (let i = 0; i < 50 && harness.patch.mock.calls.length === 0; i++) {
        await new Promise((r) => setTimeout(r, 0));
      }
    });
    expect(harness.patch).toHaveBeenCalledTimes(1);
    expect(selRowOf()).toBe("3"); // 저장 전에는 전환 금지
    await act(async () => {
      resolvePatch({});
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(harness.patch).toHaveBeenCalledTimes(1);
    expect(guarded()).toBe(false);
    expect(selRowOf()).toBe("4"); // 저장 후 전환
  });

  it("dirty 상세에서 검색어 변경 → 취소하면 검색·값이 유지된다", () => {
    renderPage();
    const box = makeDirty();
    const search = node().querySelector(
      'input[aria-label="업체명 검색"]',
    ) as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!;
      setter.call(search, "두리");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(guarded()).toBe(true);
    click(btnByText("취소"));
    expect(guarded()).toBe(false);
    expect(search.value).toBe(""); // 검색어 미적용
    expect(rowsOf(node()).length).toBe(2); // 목록 유지
    expect(box.checked).toBe(true); // 초안 값 유지
  });
});
