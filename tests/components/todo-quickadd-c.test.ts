// @vitest-environment jsdom
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Todo } from "@/types";
import TodoSection from "@/app/(app)/payment/_components/TodoSection";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
const modal = vi.hoisted(() => ({ seeds: [] as unknown[] }));
vi.mock("@/query/todos-hooks", () => ({ usePatchTodo: () => ({ mutate: vi.fn() }), useRemoveTodo: () => ({ mutate: vi.fn() }) }));
vi.mock("@/app/(app)/payment/_components/TodoFormModal", () => ({ default: ({ initial }: { initial: unknown }) => { modal.seeds.push(initial); return h("div", { "data-testid": "detail-modal" }, JSON.stringify(initial)); } }));

let root: Root | undefined; let el: HTMLDivElement | undefined;
function render(todos: Todo[] = []) { modal.seeds.length = 0; el = document.createElement("div"); document.body.append(el); root = createRoot(el); act(() => root?.render(h(TodoSection, { contractRef: "2026-07-10|가나상사", institutionRef: "미소재단", companyName: "가나상사", todos }))); return el; }
function input(label: string) { return el?.querySelector(`[aria-label="${label}"]`) as HTMLInputElement; }
function setValue(node: HTMLInputElement | HTMLSelectElement, value: string) { const proto = node instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype; act(() => { Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(node, value); node.dispatchEvent(new Event("change", { bubbles: true })); node.dispatchEvent(new Event("input", { bubbles: true })); }); }
afterEach(() => { act(() => root?.unmount()); el?.remove(); root = undefined; el = undefined; });

describe("Todo 및 History 입력", () => {
  it("제목·날짜·시·분을 한 줄에서 받고 추가 시 상세 팝업으로 넘긴다", () => {
    const node = render(); setValue(input("기록 제목"), "담당자 통화"); setValue(input("기록 날짜"), "2026-09-28");
    setValue(node.querySelector('[aria-label="시"]') as HTMLSelectElement, "14"); setValue(node.querySelector('[aria-label="분"]') as HTMLSelectElement, "30");
    act(() => [...node.querySelectorAll("button")].find((b) => b.textContent === "추가")!.click());
    expect(node.querySelector('[data-testid="detail-modal"]')).not.toBeNull();
    expect(modal.seeds.at(-1)).toMatchObject({ 기록종류: "todo", 제목: "담당자 통화", 예정일자: "2026-09-28", hour: "14", minute: "30" });
    expect(node.textContent).not.toContain("ToDo 추가 (상세)");
  });
  it("History 토글과 20시의 00분 고정을 적용한다", () => {
    const node = render(); act(() => [...node.querySelectorAll("button")].find((b) => b.textContent === "History")!.click());
    setValue(input("기록 제목"), "현장 미팅 완료"); setValue(node.querySelector('[aria-label="시"]') as HTMLSelectElement, "20");
    const minute = node.querySelector('[aria-label="분"]') as HTMLSelectElement; expect(minute.disabled).toBe(true); expect(minute.value).toBe("00");
    act(() => [...node.querySelectorAll("button")].find((b) => b.textContent === "추가")!.click());
    expect(modal.seeds.at(-1)).toMatchObject({ 기록종류: "history", hour: "20", minute: "00" });
  });
  it("History에는 완료 체크박스를 표시하지 않고 Todo에는 표시한다", () => {
    const base = { id: "1", contractRef: "c", institutionRef: "i", 업체명: "가나", type: "기타", 예정일자: "2026-09-28", 예정시각: "09:00", 장소: "", 상세: "", showOnCalendar: true, 완료여부: false, 생성시각: "2026-09-27T00:00:00Z", 분류: "기타" } as const;
    const node = render([{ ...base, 제목: "할 일", 기록종류: "todo" }, { ...base, id: "2", 제목: "한 일", 기록종류: "history" }] as Todo[]);
    expect(node.querySelectorAll('input[aria-label="완료 토글"]')).toHaveLength(1); expect(node.textContent).toContain("Todo"); expect(node.textContent).toContain("History");
  });
});
