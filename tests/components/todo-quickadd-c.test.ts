// @vitest-environment jsdom
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Todo } from "@/types";
import TodoSection from "@/app/(app)/payment/_components/TodoSection";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
const mocks = vi.hoisted(() => ({ seeds: [] as unknown[], create: vi.fn(), patch: vi.fn(), pending: false }));
vi.mock("@/query/todos-hooks", () => ({
  newTodoOperationId: () => "11111111-1111-4111-8111-111111111111",
  useCreateTodo: () => ({ mutateAsync: mocks.create, isPending: mocks.pending }),
  usePatchTodo: () => ({ mutate: mocks.patch }),
  useRemoveTodo: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/app/(app)/payment/_components/TodoFormModal", () => ({ default: ({ initial }: { initial: unknown }) => { mocks.seeds.push(initial); return h("div", { "data-testid": "detail-modal" }, JSON.stringify(initial)); } }));

let root: Root | undefined; let el: HTMLDivElement | undefined;
function render(todos: Todo[] = [], extra: Record<string, unknown> = {}) { el = document.createElement("div"); document.body.append(el); root = createRoot(el); act(() => root?.render(h(TodoSection, { contractRef: "2026-07-10|가나상사", institutionRef: "미소재단", companyName: "가나상사", todos, slot: 2, ...extra }))); return el; }
function input(label: string) { return el?.querySelector(`[aria-label="${label}"]`) as HTMLInputElement; }
function setValue(node: HTMLInputElement, value: string) { act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(node, value); node.dispatchEvent(new Event("input", { bubbles: true })); }); }
function button(text: string) { return [...(el?.querySelectorAll("button") ?? [])].find((b) => b.textContent === text) as HTMLButtonElement; }
async function pressEnter(node: HTMLInputElement) { await act(async () => { node.form?.requestSubmit(); }); }
const kst = (days: number) => new Date(Date.now() + days * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

beforeEach(() => { mocks.seeds.length = 0; mocks.create.mockReset().mockResolvedValue({ ok: true, todo: { id: "new-1" } }); mocks.patch.mockReset(); mocks.pending = false; });
afterEach(() => { act(() => root?.unmount()); el?.remove(); root = undefined; el = undefined; });

describe("Todo 및 History 바로 추가", () => {
  it("Enter 로 팝업 없이 바로 저장하고(진행건·기관·계약 연결) 입력칸에 다시 포커스", async () => {
    const node = render(); setValue(input("기록 제목"), "담당자 통화"); setValue(input("기록 날짜"), "2026-09-28");
    await pressEnter(input("기록 제목"));
    expect(node.querySelector('[data-testid="detail-modal"]')).toBeNull();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create.mock.calls[0]?.[0]).toMatchObject({ contractRef: "2026-07-10|가나상사", institutionRef: "미소재단", slot: 2, 업체명: "가나상사", 기록종류: "todo", 제목: "담당자 통화", 예정일자: "2026-09-28", 예정시각: "09:00", operationId: "11111111-1111-4111-8111-111111111111" });
    expect(input("기록 제목").value).toBe("");
    expect(document.activeElement).toBe(input("기록 제목"));
  });
  it("「추가」 버튼도 같은 바로 저장 · 날짜를 비우면 내일(KST)", async () => {
    render(); setValue(input("기록 제목"), "재무제표 받기"); setValue(input("기록 날짜"), "");
    await act(async () => { button("추가").click(); });
    expect(mocks.create.mock.calls[0]?.[0]).toMatchObject({ 예정일자: kst(1), 기록종류: "todo" });
  });
  it("History 는 기본 날짜가 오늘이고 같은 바로 저장 경로를 쓴다", async () => {
    render(); act(() => button("History").click());
    expect(input("기록 날짜").value).toBe(kst(0));
    setValue(input("기록 제목"), "현장 미팅 완료"); await pressEnter(input("기록 제목"));
    expect(mocks.create.mock.calls[0]?.[0]).toMatchObject({ 기록종류: "history", 예정일자: kst(0) });
  });
  it("저장 실패면 제목을 남기고 이유를 보여준다", async () => {
    mocks.create.mockRejectedValueOnce(new Error("네트워크 오류"));
    const node = render(); setValue(input("기록 제목"), "담당자 통화"); await pressEnter(input("기록 제목"));
    expect(input("기록 제목").value).toBe("담당자 통화");
    expect(node.querySelector('[role="alert"]')?.textContent).toContain("네트워크 오류");
  });
  it("「자세히」는 적은 제목·날짜로 상세 팝업을 연다(바로 저장 안 함)", () => {
    const node = render(); setValue(input("기록 제목"), "담당자 통화"); setValue(input("기록 날짜"), "2026-09-28");
    act(() => button("자세히").click());
    expect(node.querySelector('[data-testid="detail-modal"]')).not.toBeNull();
    expect(mocks.seeds.at(-1)).toMatchObject({ 기록종류: "todo", 제목: "담당자 통화", 예정일자: "2026-09-28", hour: "09", minute: "00" });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("「+ 다음」은 같은 진행건(계약·기관·번호)에 새 할 일을 만들고 원래 기록 id 를 prevId 로 남긴다", async () => {
    const src = { id: "hist-1", contractRef: "2026-07-10|가나상사", institutionRef: "미소재단", 업체명: "가나상사", type: "기타", 제목: "상담", 예정일자: "2026-10-20", 예정시각: "09:00", 장소: "", 상세: "", showOnCalendar: true, 완료여부: false, 생성시각: "", 분류: "", 기록종류: "history", slot: 2, result: "", prevId: "" } as const;
    const node = render([src as Todo]);
    act(() => (node.querySelector('[aria-label="상담 다음 할 일 적기"]') as HTMLButtonElement).click());
    setValue(input("다음 할 일"), "서류 받기");
    await act(async () => { input("다음 할 일").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
    expect(mocks.create.mock.calls[0]?.[0]).toMatchObject({ contractRef: "2026-07-10|가나상사", institutionRef: "미소재단", slot: 2, 기록종류: "todo", 제목: "서류 받기", 예정일자: kst(1), prevId: "hist-1" });
  });
  it("제목이 비면 추가하지 않는다", async () => {
    render(); await pressEnter(input("기록 제목"));
    expect(mocks.create).not.toHaveBeenCalled(); expect(button("추가").disabled).toBe(true);
  });
  it("History에는 완료 체크박스를 표시하지 않고 Todo에는 표시한다", () => {
    const base = { id: "1", contractRef: "c", institutionRef: "i", 업체명: "가나", type: "기타", 예정일자: "2026-09-28", 예정시각: "09:00", 장소: "", 상세: "", showOnCalendar: true, 완료여부: false, 생성시각: "2026-09-27T00:00:00Z", 분류: "기타", slot: null, result: "", prevId: "" } as const;
    const node = render([{ ...base, 제목: "할 일", 기록종류: "todo" }, { ...base, id: "2", 제목: "한 일", 기록종류: "history" }] as Todo[]);
    expect(node.querySelectorAll('input[aria-label="완료 토글"]')).toHaveLength(1); expect(node.textContent).toContain("Todo"); expect(node.textContent).toContain("History");
  });
});
