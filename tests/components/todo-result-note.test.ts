// @vitest-environment jsdom
/** 「+ 다음」 연계 할 일 + 완료한 할 일의 결과 한 줄(R 컬럼) — 「+ 결과」 태그 → 한 줄 입력 → Enter 저장 / Esc·빈 blur 원래대로 / 결과 고치기. */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Todo } from "@/types";
import TodoRow from "@/app/(app)/payment/_components/TodoRow";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const base: Todo = { id: "t1", contractRef: "c", institutionRef: "미소재단", 업체명: "가나상사", type: "기타", 제목: "재무제표 3년치 요청", 예정일자: "2026-10-22", 예정시각: "09:00", 장소: "", 상세: "", showOnCalendar: true, 완료여부: true, 생성시각: "", 분류: "", 기록종류: "todo", slot: 1, result: "", prevId: "" };
let root: Root | undefined; let el: HTMLDivElement | undefined; const save = vi.fn(); const createNext = vi.fn(async () => {});
function render(over: Partial<Todo> = {}) { save.mockReset(); createNext.mockReset().mockResolvedValue(undefined); el = document.createElement("div"); document.body.append(el); root = createRoot(el); act(() => root?.render(h(TodoRow, { todo: { ...base, ...over }, onToggleDone: vi.fn(), onSaveResult: save, onCreateNext: createNext, onRemove: vi.fn() }))); return el; }
const memo = () => el?.querySelector('[aria-label="결과 메모"]') as HTMLInputElement | null;
const q = (sel: string) => el?.querySelector(sel) as HTMLElement | null;
function type(v: string) { act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(memo()!, v); memo()!.dispatchEvent(new Event("input", { bubbles: true })); }); }
function key(k: string) { act(() => { memo()!.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })); }); }
afterEach(() => { act(() => root?.unmount()); el?.remove(); root = undefined; el = undefined; });

describe("완료 Todo 결과 메모", () => {
  it("결과 없는 완료 Todo 는 「+ 결과」 태그 → 누르면 입력, Enter 로 저장", () => {
    render();
    const tag = q('[aria-label="재무제표 3년치 요청 결과 적기"]')!; expect(tag.textContent).toContain("+ 결과");
    act(() => tag.click()); expect(memo()).not.toBeNull(); expect(document.activeElement).toBe(memo());
    type("  다음 주 재요청 "); key("Enter");
    expect(save).toHaveBeenCalledWith("다음 주 재요청"); expect(memo()).toBeNull();
  });
  it("Esc 나 빈 채로 다른 곳을 누르면 원래대로 닫히고 저장 안 함", () => {
    render(); act(() => q('[aria-label$="결과 적기"]')!.click()); type("쓰다 말았음"); key("Escape");
    expect(memo()).toBeNull(); expect(save).not.toHaveBeenCalled(); expect(el?.textContent).toContain("+ 결과");
    act(() => q('[aria-label$="결과 적기"]')!.click()); act(() => { memo()!.blur(); memo()?.dispatchEvent(new FocusEvent("focusout", { bubbles: true })); });
    expect(memo()).toBeNull(); expect(save).not.toHaveBeenCalled();
  });
  it("Enter 를 빈 칸으로 누르면 저장하지 않는다", () => {
    render(); act(() => q('[aria-label$="결과 적기"]')!.click()); key("Enter");
    expect(save).not.toHaveBeenCalled();
  });
  it("결과가 있으면 초록 「결과 · …」 → 누르면 같은 입력으로 고친다", () => {
    render({ result: "메일로 받음" });
    const r = q('[aria-label="결과 고치기"]')!; expect(r.textContent).toBe("결과 · 메일로 받음"); expect(el?.textContent).not.toContain("+ 결과");
    act(() => r.click()); expect(memo()!.value).toBe("메일로 받음");
    type("팩스로 받음"); key("Enter"); expect(save).toHaveBeenCalledWith("팩스로 받음");
  });
  it("고치는 중 내용을 지우고 Enter 면 결과를 지운다", () => {
    render({ result: "메일로 받음" }); act(() => q('[aria-label="결과 고치기"]')!.click()); type(""); key("Enter");
    expect(save).toHaveBeenCalledWith("");
  });
  it("미완료 Todo·History 에는 태그도 결과 칸도 없다", () => {
    render({ 완료여부: false, result: "남은 값" }); expect(el?.textContent).not.toContain("+ 결과"); expect(q('[aria-label="결과 고치기"]')).toBeNull(); expect(q("button.group")).toBeNull();
    act(() => root?.unmount()); el?.remove();
    render({ 기록종류: "history", 완료여부: true }); expect(el?.textContent).not.toContain("+ 결과");
  });
});

describe("「+ 다음」 연계 할 일", () => {
  const next = () => el?.querySelector('[aria-label="다음 할 일"]') as HTMLInputElement | null;
  const nextDate = () => el?.querySelector('[aria-label="다음 할 일 날짜"]') as HTMLInputElement | null;
  const kst1 = () => new Date(Date.now() + 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  function fill(node: HTMLInputElement, v: string) { act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(node, v); node.dispatchEvent(new Event("input", { bubbles: true })); }); }
  it("완료 Todo·History 에 보이고, 미완료 Todo 에는 없다", () => {
    render(); expect(q('[aria-label$="다음 할 일 적기"]')).not.toBeNull(); act(() => root?.unmount()); el?.remove();
    render({ 기록종류: "history", 완료여부: false }); expect(q('[aria-label$="다음 할 일 적기"]')).not.toBeNull(); act(() => root?.unmount()); el?.remove();
    render({ result: "메일로 받음" }); expect(q('[aria-label$="다음 할 일 적기"]')).not.toBeNull(); act(() => root?.unmount()); el?.remove();
    render({ 완료여부: false }); expect(q('[aria-label$="다음 할 일 적기"]')).toBeNull();
  });
  it("누르면 제목+날짜(기본 내일) 한 줄 → Enter 로 새 할 일 저장 후 닫힘", async () => {
    render({ 기록종류: "history", 완료여부: false }); act(() => q('[aria-label$="다음 할 일 적기"]')!.click());
    expect(document.activeElement).toBe(next()); expect(nextDate()!.value).toBe(kst1());
    fill(next()!, " 보완 서류 받기 "); fill(nextDate()!, "2026-10-30");
    await act(async () => { next()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
    expect(createNext).toHaveBeenCalledWith("보완 서류 받기", "2026-10-30"); expect(next()).toBeNull();
  });
  it("Esc·취소로 저장 없이 닫힘, 바깥(달력)으로 초점이 가도 입력칸 유지, 실패면 입력 유지 + 이유", async () => {
    render(); act(() => q('[aria-label$="다음 할 일 적기"]')!.click()); fill(next()!, "쓰다 말았음");
    act(() => { next()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(next()).toBeNull(); expect(createNext).not.toHaveBeenCalled();
    act(() => q('[aria-label$="다음 할 일 적기"]')!.click()); act(() => { next()!.blur(); });
    expect(next()).not.toBeNull(); // 2026-10-27: 휴대폰에서 달력을 열면 초점이 빠져도 빈 입력칸이 닫히지 않아야 한다
    act(() => q('[aria-label="다음 할 일 적기 취소"]')!.click());
    expect(next()).toBeNull(); expect(createNext).not.toHaveBeenCalled();
    createNext.mockRejectedValueOnce(new Error("네트워크 오류"));
    act(() => q('[aria-label$="다음 할 일 적기"]')!.click()); fill(next()!, "다시 전화");
    await act(async () => { next()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
    expect(next()!.value).toBe("다시 전화"); expect(el?.querySelector('[role="alert"]')?.textContent).toContain("네트워크 오류");
  });
});

describe("일정 눌러 고치기 (2026-10-28)", () => {
  it("고치기를 줄 수 있으면 일정이 버튼 — 누르면 고치기 창, 없으면 그냥 글자", () => {
    const edit = vi.fn();
    el = document.createElement("div"); document.body.append(el); root = createRoot(el);
    act(() => root?.render(h(TodoRow, { todo: { ...base, 완료여부: false }, onToggleDone: vi.fn(), onSaveResult: vi.fn(), onEdit: edit, onRemove: vi.fn() })));
    const when = q('[aria-label="재무제표 3년치 요청 일정 고치기 (10/22 09:00)"]')!;
    expect(when.tagName).toBe("BUTTON");
    act(() => when.click());
    expect(edit).toHaveBeenCalledTimes(1);
    act(() => root?.render(h(TodoRow, { todo: base, onToggleDone: vi.fn(), onSaveResult: vi.fn(), onRemove: vi.fn() })));
    expect(q('[aria-label$="일정 고치기 (10/22 09:00)"]')).toBeNull();
    expect(el?.textContent).toContain("10/22 09:00");
  });
});
