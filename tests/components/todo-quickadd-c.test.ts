// @vitest-environment jsdom
/**
 * Scope C2/C4 — TodoSection 빠른 추가(quick-add) 실제 렌더 회귀.
 *
 * 순수 큐 테스트로는 잡히지 않던 UI 계약을 DOM 으로 고정한다:
 *  ① 저장 중에도 입력·추가 버튼이 막히지 않는다(연속 타이핑 보존 — 상위 리뷰 CRITICAL A).
 *  ② 매 제출에 UUID operationId 가 실린다(서버 멱등 키).
 *  ③ 애매한 실패 뒤 같은 내용 재시도는 같은 키(서버가 원본 반환),
 *     제목이 바뀌면 새 키(같은 키 다른 내용은 409 회피).
 *     실패한 A 의 키는 서명별로 보관돼 B 제출 뒤 A 로 돌아와도 재사용된다(A/B/A).
 *  ⑤ 409(TodoOperationConflict) 실패도 초안을 지우지 않는다.
 *  ④ 같은 제목·날짜를 다시 추가해도 억제되지 않는다(정상 중복 허용 —
 *     구 presence 매칭 삭제 회귀).
 * C4 추가: 지연 ACK 가 새 입력 B 를 지우지 않음(stale 무효), 오래된 에러가 B 에
 * 라벨을 붙이지 않음, 스코프 전환 후 이전 ACK 무시, before-ACK 중복 Enter/blur
 * 1회 결합, 그룹 blur 1회 제출(내부 이동·버튼 중복 없음), mount/empty 무쓰기.
 */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TodoSection from "@/app/(app)/payment/_components/TodoSection";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  pending: false,
}));

vi.mock("@/query/todos-hooks", async (importOriginal) => {
  const orig =
    await importOriginal<typeof import("@/query/todos-hooks")>();
  return {
    ...orig,
    useCreateTodo: () => ({ mutate: mocks.mutate, isPending: mocks.pending }),
    usePatchTodo: () => ({ mutate: vi.fn() }),
    useRemoveTodo: () => ({ mutate: vi.fn() }),
  };
});

let root: Root | undefined;
let el: HTMLDivElement | undefined;

function renderSection() {
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
  act(() => {
    root?.render(
      h(TodoSection, {
        contractRef: "2026-07-10|가나상사",
        institutionRef: "미소재단",
        companyName: "가나상사",
        todos: [],
      }),
    );
  });
}

function quickInput() {
  const input = el?.querySelector<HTMLInputElement>(
    'input[aria-label="할 일 빠르게 추가"]',
  );
  if (!input) throw new Error("quick-add input is missing");
  return input;
}

function addButton() {
  const btn = el?.querySelector<HTMLButtonElement>(
    'button[aria-label="할 일 추가"]',
  );
  if (!btn) throw new Error("quick-add button is missing");
  return btn;
}

function changeInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  if (!setter) throw new Error("HTML input value setter is unavailable");
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function pressEnter(input: HTMLInputElement) {
  act(() => {
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
  });
}

function lastMutate() {
  const calls = mocks.mutate.mock.calls as Array<
    [Record<string, unknown>, { onSuccess?: () => void; onError?: (e: Error) => void }]
  >;
  if (calls.length === 0) throw new Error("mutate was never called");
  return calls[calls.length - 1]!;
}

function rerenderSection(props: {
  contractRef: string;
  institutionRef: string;
  companyName?: string;
  draftInstitution?: string;
}) {
  act(() => {
    root?.render(
      h(TodoSection, {
        companyName: "가나상사",
        todos: [],
        ...props,
      }),
    );
  });
}

/** 그룹 바깥으로 포커스가 나갈 때 — 유효 제목이면 1회 제출해야 한다. */
function blurQuickOutside() {
  const input = quickInput();
  const outside = document.createElement("button");
  document.body.append(outside);
  act(() => {
    input.dispatchEvent(
      new FocusEvent("focusout", { bubbles: true, relatedTarget: outside }),
    );
  });
  outside.remove();
}

/** 그룹 내 이동(입력→추가 버튼) — 제출하면 안 된다(버튼 onClick 이 1회 담당). */
function blurQuickWithin() {
  const input = quickInput();
  const btn = addButton();
  act(() => {
    input.dispatchEvent(
      new FocusEvent("focusout", { bubbles: true, relatedTarget: btn }),
    );
  });
}

function clickAddButton() {
  act(() => {
    addButton().click();
  });
}

beforeEach(() => {
  mocks.mutate.mockReset();
  mocks.pending = false;
});

afterEach(() => {
  act(() => root?.unmount());
  el?.remove();
  root = undefined;
  el = undefined;
});

describe("TodoSection quick-add", () => {
  it("stays editable while a create is pending — no input lock after each keystroke", () => {
    renderSection();
    changeInput(quickInput(), "서류");
    mocks.pending = true;
    act(() => {
      root?.render(
        h(TodoSection, {
          contractRef: "2026-07-10|가나상사",
          institutionRef: "미소재단",
          companyName: "가나상사",
          todos: [],
        }),
      );
    });
    expect(quickInput().disabled).toBe(false);
    expect(quickInput().value).toBe("서류");
    expect(addButton().disabled).toBe(false);
  });

  it("sends a UUID operationId with showOnCalendar=false on Enter", () => {
    renderSection();
    changeInput(quickInput(), "서류 준비");
    pressEnter(quickInput());
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
    const [args] = lastMutate();
    expect(args).toMatchObject({
      contractRef: "2026-07-10|가나상사",
      institutionRef: "미소재단",
      업체명: "가나상사",
      type: "기타",
      제목: "서류 준비",
      예정시각: "",
      showOnCalendar: false,
    });
    expect(typeof args["operationId"]).toBe("string");
    expect(String(args["operationId"])).toMatch(UUID_RE);
  });

  it("retries the identical payload with the SAME key after an ambiguous failure", () => {
    renderSection();
    changeInput(quickInput(), "서류 준비");
    pressEnter(quickInput());
    const firstOp = String(lastMutate()[0]["operationId"]);
    // 응답 유실 흉내 — 실패하지만 서버에는 커밋됐을 수 있다.
    act(() => lastMutate()[1].onError?.(new Error("net down")));
    // 입력은 유지되고 같은 내용 그대로 Enter → 같은 키.
    expect(quickInput().value).toBe("서류 준비");
    expect(el?.textContent).toContain("net down");
    pressEnter(quickInput());
    expect(mocks.mutate).toHaveBeenCalledTimes(2);
    const [args2] = lastMutate();
    expect(String(args2["operationId"])).toBe(firstOp);
    expect(args2["제목"]).toBe("서류 준비");
  });

  it("mints a fresh key when the title changes after a failure", () => {
    renderSection();
    changeInput(quickInput(), "서류 준비");
    pressEnter(quickInput());
    const firstOp = String(lastMutate()[0]["operationId"]);
    act(() => lastMutate()[1].onError?.(new Error("net down")));
    changeInput(quickInput(), "통장 정리");
    pressEnter(quickInput());
    expect(mocks.mutate).toHaveBeenCalledTimes(2);
    expect(String(lastMutate()[0]["operationId"])).not.toBe(firstOp);
  });

  it("does not suppress a legitimate duplicate title after success", () => {
    renderSection();
    changeInput(quickInput(), "서류 준비");
    pressEnter(quickInput());
    const firstOp = String(lastMutate()[0]["operationId"]);
    act(() => lastMutate()[1].onSuccess?.());
    expect(quickInput().value).toBe("");
    // 같은 제목을 또 적으면 새 키로 다시 전송된다(구 presence 억제 삭제).
    changeInput(quickInput(), "서류 준비");
    pressEnter(quickInput());
    expect(mocks.mutate).toHaveBeenCalledTimes(2);
    const [args2] = lastMutate();
    expect(args2["제목"]).toBe("서류 준비");
    expect(String(args2["operationId"])).not.toBe(firstOp);
  });

  it("reuses the failed A operation ID across an interleaved B submit (A/B/A)", () => {
    renderSection();
    // A 제출 → 애매한 실패(서버 커밋 여부는 불명).
    changeInput(quickInput(), "서류 준비");
    pressEnter(quickInput());
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
    const opA = String(lastMutate()[0]["operationId"]);
    expect(opA).toMatch(UUID_RE);
    act(() => lastMutate()[1].onError?.(new Error("net down")));
    // 사용자가 제목을 B 로 바꿔 제출 → B 는 A 와 다른 키.
    changeInput(quickInput(), "통장 정리");
    pressEnter(quickInput());
    expect(mocks.mutate).toHaveBeenCalledTimes(2);
    const opB = String(lastMutate()[0]["operationId"]);
    expect(opB).toMatch(UUID_RE);
    expect(opB).not.toBe(opA);
    act(() => lastMutate()[1].onError?.(new Error("net down")));
    // 다시 A 로 돌아가 재시도 → 실패한 A 의 키를 재사용(중복 생성 방지).
    changeInput(quickInput(), "서류 준비");
    pressEnter(quickInput());
    expect(mocks.mutate).toHaveBeenCalledTimes(3);
    const [args3] = lastMutate();
    expect(args3["제목"]).toBe("서류 준비");
    expect(String(args3["operationId"])).toBe(opA);
  });

  it("keeps the draft on a 409 TodoOperationConflict instead of clearing", () => {
    renderSection();
    changeInput(quickInput(), "서류 준비");
    pressEnter(quickInput());
    const op = String(lastMutate()[0]["operationId"]);
    // 서버 409 — 같은 operation 으로 이미 커밋된 행과 내용이 다르다.
    act(() =>
      lastMutate()[1].onError?.(
        new Error("[todo-conflict] 같은 작업으로 이미 생성된 ToDo와 내용이 다릅니다: xxx"),
      ),
    );
    // 초안 유지(지우지 않음) + 오류 표시.
    expect(quickInput().value).toBe("서류 준비");
    expect(el?.textContent).toContain("todo-conflict");
    // 그대로 재시도 → 같은 키로 수렴(서버가 원본 행으로 응답).
    pressEnter(quickInput());
    expect(mocks.mutate).toHaveBeenCalledTimes(2);
    expect(String(lastMutate()[0]["operationId"])).toBe(op);
  });

  it("preserves newer typing B when the deferred ACK for A arrives", () => {
    renderSection();
    // A 제출 후 ACK 를 미루고 B 를 타이핑한다(C3 버그: B 가 지워졌다).
    changeInput(quickInput(), "서류 준비");
    pressEnter(quickInput());
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
    const firstCall = mocks.mutate.mock.calls[0] as [
      Record<string, unknown>,
      { onSuccess?: () => void; onError?: (e: Error) => void },
    ];
    changeInput(quickInput(), "통장 정리");
    // 지연된 A 성공이 도착해도 B 는 유지된다.
    act(() => firstCall[1].onSuccess?.());
    expect(quickInput().value).toBe("통장 정리");
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
    // B 는 그대로 제출 가능하고 A 와 다른 키다.
    pressEnter(quickInput());
    expect(mocks.mutate).toHaveBeenCalledTimes(2);
    expect(String(lastMutate()[0]["제목"])).toBe("통장 정리");
    expect(String(lastMutate()[0]["operationId"])).not.toBe(
      String(firstCall[0]["operationId"]),
    );
  });

  it("does not label newer typing B with the stale error for A", () => {
    renderSection();
    changeInput(quickInput(), "서류 준비");
    pressEnter(quickInput());
    const firstCall = mocks.mutate.mock.calls[0] as [
      Record<string, unknown>,
      { onSuccess?: () => void; onError?: (e: Error) => void },
    ];
    changeInput(quickInput(), "통장 정리");
    act(() => firstCall[1].onError?.(new Error("stale-A net down")));
    // B 입력 유지 + A 에러가 B 위에 표시되지 않는다.
    expect(quickInput().value).toBe("통장 정리");
    expect(el?.textContent ?? "").not.toContain("stale-A net down");
    // B 제출은 정상 동작한다.
    pressEnter(quickInput());
    expect(mocks.mutate).toHaveBeenCalledTimes(2);
    expect(String(lastMutate()[0]["제목"])).toBe("통장 정리");
  });

  it("ignores the stale ACK after a scope switch", () => {
    renderSection();
    changeInput(quickInput(), "서류 준비");
    pressEnter(quickInput());
    const firstCall = mocks.mutate.mock.calls[0] as [
      Record<string, unknown>,
      { onSuccess?: () => void; onError?: (e: Error) => void },
    ];
    // 계약·기관 전환 — 같은 마운트에 새 props.
    rerenderSection({
      contractRef: "2026-07-11|다라상사",
      institutionRef: "다른재단",
    });
    act(() => firstCall[1].onSuccess?.());
    // 전환된 스코프 입력이 지워지면 안 된다(현재 값 유지).
    expect(quickInput().value).toBe("서류 준비");
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
    // stale 에러도 무시된다.
    changeInput(quickInput(), "서류 준비");
    pressEnter(quickInput());
    expect(mocks.mutate).toHaveBeenCalledTimes(2);
    const secondCall = lastMutate();
    rerenderSection({
      contractRef: "2026-07-10|가나상사",
      institutionRef: "미소재단",
    });
    act(() => secondCall[1].onError?.(new Error("stale-scope boom")));
    expect(el?.textContent ?? "").not.toContain("stale-scope boom");
  });

  it("joins duplicate Enter + group blur before ACK into one request", () => {
    renderSection();
    changeInput(quickInput(), "서류 준비");
    pressEnter(quickInput());
    // ACK 전 중복 Enter + 바깥 blur — 모두 같은 동작이라 1회로 합친다.
    pressEnter(quickInput());
    blurQuickOutside();
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
    // 실패 뒤에는 재시도가 다시 전송된다(억제 해제).
    act(() => lastMutate()[1].onError?.(new Error("net down")));
    expect(quickInput().value).toBe("서류 준비");
    pressEnter(quickInput());
    expect(mocks.mutate).toHaveBeenCalledTimes(2);
  });

  it("group blur commits a valid title once; internal hop + button sends once; empty blur sends nothing", () => {
    // mount 만으로는 쓰기 없음.
    renderSection();
    expect(mocks.mutate).not.toHaveBeenCalled();
    // 빈 입력 blur — 쓰기 없음.
    blurQuickOutside();
    expect(mocks.mutate).not.toHaveBeenCalled();
    // 유효 제목 blur — 정확히 1회.
    changeInput(quickInput(), "서류 준비");
    blurQuickOutside();
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
    act(() => lastMutate()[1].onError?.(new Error("net down")));
    // 내부 이동(입력→버튼)은 blur 단독으로 쓰지 않는다.
    mocks.mutate.mockClear();
    // 현재 입력은 유지된 "서류 준비" — 같은 서명이지만 in-flight 가 비어 실패 키 재사용 경로다.
    // 먼저 성공시켜 in-flight·실패맵을 정리하고 새 제목으로 내부 이동을 검증한다.
    pressEnter(quickInput());
    act(() => lastMutate()[1].onSuccess?.());
    expect(quickInput().value).toBe("");
    mocks.mutate.mockClear();
    changeInput(quickInput(), "통장 정리");
    blurQuickWithin();
    expect(mocks.mutate).not.toHaveBeenCalled();
    clickAddButton();
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
    expect(String(lastMutate()[0]["제목"])).toBe("통장 정리");
  });
});
