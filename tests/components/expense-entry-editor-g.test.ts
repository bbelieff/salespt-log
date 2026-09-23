// @vitest-environment jsdom

/**
 * Scope G — existing one-off expense inline edit (real React component).
 *
 * No write on mount; one coherent group blur/Enter produces exactly ONE
 * PATCH to /api/expenses/[stable-id]; invalid amount/date never PATCHes;
 * field-to-field focus never PATCHes; pending edits stay editable and are
 * retained; failure keeps the draft with retry; recurring rows stay explicit
 * (no inputs); legacy apportioned rows without originalAmountWon lock the
 * amount and never PATCH it; spans WITH originalAmountWon edit the original
 * total (display original, PATCH original).
 */
import * as React from "react";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExpenseLedgerTable from "@/components/dashboard/expense-ledger/ExpenseLedgerTable";
import type { ExpenseLedgerView, RecognizedExpense } from "@/types/expense-ledger";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const hoisted = vi.hoisted(() => ({ invalidateQueries: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: hoisted.invalidateQueries }) }));

const CAT_A = "11111111-1111-4111-8111-111111111111";
const CAT_B = "22222222-2222-4222-8222-222222222222";
const ENTRY_WHOLE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ENTRY_SPAN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ENTRY_RECUR = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ENTRY_ORIG = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const categories = [
  { id: CAT_A, name: "마케팅", isSystem: false, deletedAt: null, archivedAt: null, createdAt: "2026-07-01", updatedAt: "2026-07-01" },
  { id: CAT_B, name: "인건비", isSystem: false, deletedAt: null, archivedAt: null, createdAt: "2026-07-01", updatedAt: "2026-07-01" },
];

const wholeEntry: RecognizedExpense = {
  source: "one_time", id: ENTRY_WHOLE, categoryId: CAT_A, categoryName: "마케팅",
  itemName: "광고비", amountWon: 120000, periodStart: "2026-08-05", periodEnd: "2026-08-05",
};
// Multi-month span shown inside month view: amountWon here is the apportioned portion.
const spanEntry: RecognizedExpense = {
  source: "one_time", id: ENTRY_SPAN, categoryId: CAT_B, categoryName: "인건비",
  itemName: "외주비", amountWon: 30000, periodStart: "2026-07-31", periodEnd: "2026-08-02",
};
// Prorated span WITH the stored original total: recognized 500, original 1000.
const origEntry: RecognizedExpense = {
  source: "one_time", id: ENTRY_ORIG, categoryId: CAT_B, categoryName: "인건비",
  itemName: "외주비 원본", amountWon: 500, originalAmountWon: 1000,
  periodStart: "2026-07-31", periodEnd: "2026-08-02",
};
const recurEntry: RecognizedExpense = {
  source: "recurring", recurringRuleId: "rule-1", isOverride: false,
  id: ENTRY_RECUR, categoryId: CAT_B, categoryName: "인건비",
  itemName: "운영 인력", amountWon: 108000, periodStart: "2026-08-05", periodEnd: "2026-08-05",
};

function ledger(entries: RecognizedExpense[]): ExpenseLedgerView {
  return {
    view: "month", month: "2026-08", categories,
    entries, categoryTotals: [], additionalCostTotal: 0,
  };
}

let root: Root | undefined;
let container: HTMLDivElement | undefined;
let fetchMock: ReturnType<typeof vi.fn>;

function render(element: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(element));
}
function rerender(element: ReactNode) {
  act(() => root?.render(element));
}

function patchOk(expense: unknown = {}) {
  return { ok: true, status: 200, json: async () => ({ expense }) };
}
function patchFail() {
  return { ok: false, status: 500, json: async () => ({ error: "oops" }) };
}

function editorOf(itemName: string): HTMLElement {
  const el = [...document.querySelectorAll("details")].find((d) => d.textContent?.includes(itemName));
  if (!el) throw new Error(`row '${itemName}' is missing`);
  return el as HTMLElement;
}
function field(row: HTMLElement, label: string): HTMLInputElement | HTMLSelectElement {
  const el = row.querySelector(`[aria-label="${label}"]`);
  if (!el) throw new Error(`field '${label}' is missing`);
  return el as HTMLInputElement;
}
function changeInput(input: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto = input.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (!setter) throw new Error("value setter is unavailable");
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event(input.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  });
}
/** Focus leaves the whole editor group (not a hop between its fields). */
function blurGroup(row: HTMLElement) {
  const outside = document.createElement("button");
  document.body.append(outside);
  const from = row.querySelector("input, select");
  if (!from) throw new Error("editor has no focusable field");
  act(() => {
    from.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: outside }));
  });
  outside.remove();
}
/** Focus hops between two fields inside the same editor group. */
function focusWithin(row: HTMLElement, fromLabel: string, toLabel: string) {
  const from = field(row, fromLabel);
  const to = field(row, toLabel);
  act(() => {
    from.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: to }));
  });
}
function pressEnterOn(input: HTMLElement) {
  act(() => {
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
}
function advance(ms: number) {
  return act(async () => { vi.advanceTimersByTime(ms); });
}
function settle() {
  return act(async () => {});
}
function lastPatch() {
  const calls = fetchMock.mock.calls.filter(([url, init]) => (init as RequestInit)?.method === "PATCH");
  if (calls.length === 0) throw new Error("no PATCH was sent");
  const [url, init] = calls.at(-1)!;
  return { url: url as string, body: JSON.parse((init as RequestInit).body as string) };
}
function patchCount() {
  return fetchMock.mock.calls.filter(([, init]) => (init as RequestInit)?.method === "PATCH").length;
}

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn(async () => patchOk());
  vi.stubGlobal("fetch", fetchMock);
  hoisted.invalidateQueries.mockResolvedValue(undefined);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("expense one-off inline edit", () => {
  it("never writes on mount, even across debounce and untouched group blur", async () => {
    render(createElement(ExpenseLedgerTable, {
      data: ledger([wholeEntry]), loading: false, error: null, mode: "month", onOpenRecord: vi.fn(),
    }));
    await advance(3000);
    blurGroup(editorOf("광고비"));
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("valid group blur sends exactly ONE PATCH to the stable expense id", async () => {
    render(createElement(ExpenseLedgerTable, {
      data: ledger([wholeEntry]), loading: false, error: null, mode: "month", onOpenRecord: vi.fn(),
    }));
    const row = editorOf("광고비");
    changeInput(field(row, "금액(원)") as HTMLInputElement, "200000");
    // Field-to-field hops must not save.
    focusWithin(row, "금액(원)", "항목 이름");
    focusWithin(row, "항목 이름", "시작일");
    await advance(3000);
    expect(patchCount()).toBe(0);
    blurGroup(row);
    await advance(3000);
    await settle();
    expect(patchCount()).toBe(1);
    const patch = lastPatch();
    expect(patch.url).toBe(`/api/expenses/${ENTRY_WHOLE}`);
    expect(patch.body).toEqual({ amountWon: 200000 });
    expect(document.body.textContent).toContain("저장됨");
  });

  it("Enter commits the group without leaving the field", async () => {
    render(createElement(ExpenseLedgerTable, {
      data: ledger([wholeEntry]), loading: false, error: null, mode: "month", onOpenRecord: vi.fn(),
    }));
    const row = editorOf("광고비");
    const name = field(row, "항목 이름") as HTMLInputElement;
    changeInput(name, "광고비 8월");
    pressEnterOn(name);
    await advance(3000);
    await settle();
    expect(patchCount()).toBe(1);
    expect(lastPatch().body).toEqual({ itemName: "광고비 8월" });
  });

  it("invalid amount or incoherent dates never PATCH and keep an error", async () => {
    render(createElement(ExpenseLedgerTable, {
      data: ledger([wholeEntry]), loading: false, error: null, mode: "month", onOpenRecord: vi.fn(),
    }));
    const row = editorOf("광고비");
    changeInput(field(row, "금액(원)") as HTMLInputElement, "0");
    blurGroup(row);
    await advance(3000);
    expect(patchCount()).toBe(0);
    expect(document.body.textContent).toContain("금액을 1원 이상 숫자로 입력해 주세요.");
    changeInput(field(row, "금액(원)") as HTMLInputElement, "120000");
    changeInput(field(row, "종료일") as HTMLInputElement, "2026-08-01");
    blurGroup(row);
    await advance(3000);
    expect(patchCount()).toBe(0);
    expect(document.body.textContent).toContain("종료일은 시작일보다 빠를 수 없습니다.");
  });

  it("inputs stay editable during the request and pending edits are retained", async () => {
    let release!: (v: unknown) => void;
    fetchMock.mockImplementationOnce(() => new Promise((res) => { release = () => res(patchOk()); }));
    render(createElement(ExpenseLedgerTable, {
      data: ledger([wholeEntry]), loading: false, error: null, mode: "month", onOpenRecord: vi.fn(),
    }));
    const row = editorOf("광고비");
    const amount = field(row, "금액(원)") as HTMLInputElement;
    changeInput(amount, "130000");
    blurGroup(row);
    await advance(3000);
    expect(patchCount()).toBe(1);
    // Still editable mid-flight; a newer deliberate group commit follows.
    expect(amount.disabled).toBe(false);
    changeInput(amount, "140000");
    blurGroup(row);
    await act(async () => { release(undefined); });
    await advance(3000);
    await settle();
    expect(patchCount()).toBe(2);
    expect(lastPatch().body).toEqual({ amountWon: 140000 });
  });

  it("failure keeps the draft and retry sends again", async () => {
    fetchMock.mockImplementationOnce(async () => patchFail());
    render(createElement(ExpenseLedgerTable, {
      data: ledger([wholeEntry]), loading: false, error: null, mode: "month", onOpenRecord: vi.fn(),
    }));
    const row = editorOf("광고비");
    changeInput(field(row, "금액(원)") as HTMLInputElement, "150000");
    blurGroup(row);
    await advance(3000);
    await settle();
    expect(patchCount()).toBe(1);
    expect(document.body.textContent).toContain("저장 실패");
    // Draft retained for retry.
    expect((field(row, "금액(원)") as HTMLInputElement).value).toBe("150000");
    const retry = [...document.querySelectorAll("button")].find((b) => b.textContent === "다시 시도");
    if (!retry) throw new Error("retry button is missing");
    await act(async () => { retry.click(); });
    await advance(3000);
    await settle();
    expect(patchCount()).toBe(2);
    expect(lastPatch().body).toEqual({ amountWon: 150000 });
    expect(document.body.textContent).toContain("저장됨");
  });

  it("recurring rows stay explicit with no inline inputs", async () => {
    render(createElement(ExpenseLedgerTable, {
      data: ledger([recurEntry]), loading: false, error: null, mode: "month", onOpenRecord: vi.fn(),
    }));
    const row = editorOf("운영 인력");
    expect(row.querySelector("input")).toBeNull();
    expect(row.querySelector("select")).toBeNull();
    expect(row.textContent).toContain("기록 화면의 반복 규칙으로 이동");
    await advance(3000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("legacy apportioned rows without original still lock the amount and never PATCH it", async () => {
    render(createElement(ExpenseLedgerTable, {
      data: ledger([spanEntry]), loading: false, error: null, mode: "month", onOpenRecord: vi.fn(),
    }));
    const row = editorOf("외주비");
    expect((field(row, "금액(원)") as HTMLInputElement).disabled).toBe(true);
    changeInput(field(row, "항목 이름") as HTMLInputElement, "외주비 8월분");
    blurGroup(row);
    await advance(3000);
    await settle();
    expect(patchCount()).toBe(1);
    const patch = lastPatch();
    expect(patch.url).toBe(`/api/expenses/${ENTRY_SPAN}`);
    expect(patch.body).toEqual({ itemName: "외주비 8월분" });
    expect(patch.body).not.toHaveProperty("amountWon");
  });

  it("prorated entry with original total shows 1000, edits to 1200 -> PATCH 1200", async () => {
    render(createElement(ExpenseLedgerTable, {
      data: ledger([origEntry]), loading: false, error: null, mode: "month", onOpenRecord: vi.fn(),
    }));
    const row = editorOf("외주비 원본");
    const amount = field(row, "금액(원)") as HTMLInputElement;
    // Editor initial amount is the stored original total (1000), not the
    // view-range recognized portion (500), and stays editable.
    expect(amount.disabled).toBe(false);
    expect(amount.value).toBe("1000");
    expect(row.textContent).toContain("전액");
    expect(row.textContent).toContain("인식액");
    changeInput(amount, "1200");
    blurGroup(row);
    await advance(3000);
    await settle();
    expect(patchCount()).toBe(1);
    const patch = lastPatch();
    expect(patch.url).toBe(`/api/expenses/${ENTRY_ORIG}`);
    expect(patch.body).toEqual({ amountWon: 1200 });
  });

  it("original-total entry writes nothing on mount and refetch", async () => {
    const props = (entries: RecognizedExpense[]) => createElement(ExpenseLedgerTable, {
      data: ledger(entries), loading: false, error: null, mode: "month", onOpenRecord: vi.fn(),
    });
    render(props([origEntry]));
    await advance(3000);
    blurGroup(editorOf("외주비 원본"));
    await settle();
    expect(patchCount()).toBe(0);
    // Refetch with a fresh object carrying identical server values: still 0 writes.
    rerender(props([{ ...origEntry }]));
    await advance(3000);
    await settle();
    expect(patchCount()).toBe(0);
    expect((field(editorOf("외주비 원본"), "금액(원)") as HTMLInputElement).value).toBe("1000");
  });

  it("each entry PATCHes its own stable id with its own payload", async () => {
    render(createElement(ExpenseLedgerTable, {
      data: ledger([wholeEntry, spanEntry]), loading: false, error: null, mode: "month", onOpenRecord: vi.fn(),
    }));
    const rowA = editorOf("광고비");
    changeInput(field(rowA, "금액(원)") as HTMLInputElement, "210000");
    blurGroup(rowA);
    await advance(3000);
    await settle();
    const rowB = editorOf("외주비");
    changeInput(field(rowB, "항목 이름") as HTMLInputElement, "외주비 확정");
    blurGroup(rowB);
    await advance(3000);
    await settle();
    expect(patchCount()).toBe(2);
    const calls = fetchMock.mock.calls.map(([url, init]) => ({
      url: url as string,
      body: JSON.parse((init as RequestInit).body as string),
    }));
    expect(calls[0]).toEqual({ url: `/api/expenses/${ENTRY_WHOLE}`, body: { amountWon: 210000 } });
    expect(calls[1]).toEqual({ url: `/api/expenses/${ENTRY_SPAN}`, body: { itemName: "외주비 확정" } });
  });

  it("ACK invalidates ledger and dashboard caches", async () => {
    render(createElement(ExpenseLedgerTable, {
      data: ledger([wholeEntry]), loading: false, error: null, mode: "month", onOpenRecord: vi.fn(),
    }));
    const row = editorOf("광고비");
    changeInput(field(row, "금액(원)") as HTMLInputElement, "220000");
    blurGroup(row);
    await advance(3000);
    await settle();
    expect(patchCount()).toBe(1);
    const keys = hoisted.invalidateQueries.mock.calls.map(([arg]) => (arg as { queryKey: string[] }).queryKey);
    expect(keys).toContainEqual(["expense-ledger"]);
    expect(keys).toContainEqual(["dashboard"]);
  });
});
