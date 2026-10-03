// @vitest-environment jsdom

/**
 * Scope B autosave — DB RowCard behavioral regressions.
 *
 * Real component behavior (no source-string assertions): no request on mount,
 * debounced text-only writes, whole-row blur (or Enter) for money/date groups,
 * internal focus transfer never flushes, single
 * flight with in-flight join, failure keeps draft + visible retry, invalid
 * money/dates never sent, edit-during-save keeps the latest, undo restores
 * the previously ACKed payload. Saved is only claimed after server ACK.
 */
import * as React from "react";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RowCard from "@/app/(app)/db/_components/RowCard";
import { CHANNELS } from "@/app/(app)/db/_lib/channels";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const ROW = {
  row: 2,
  구매일: "2026-09-01",
  업체명: "원본상호",
  총액: 11000,
  부가세여부: false,
  주문개수: 10,
  기타: "",
};

let root: Root | undefined;
let container: HTMLDivElement | undefined;
let onSave!: ReturnType<typeof vi.fn>;
let onCollapse!: ReturnType<typeof vi.fn>;
let saveImpl!: (data: Record<string, unknown>) => Promise<void>;

function renderCard() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      createElement(RowCard, {
        channelKey: "purchase",
        channel: CHANNELS.purchase,
        index: 0,
        row: { ...ROW },
        expanded: true,
        pending: false,
        badgeCls: "badge-purchase",
        onExpand: vi.fn(),
        onCollapse,
        onSave,
        onDeleteRequest: vi.fn(),
      }),
    );
  });
}

function changeInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("HTML input value setter is unavailable");
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function advance(ms: number) {
  return act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

function settle() {
  return act(async () => {});
}

/** Focus leaves the whole row (not a hop between its fields). */
function blurRowGroup() {
  const card = document.querySelector(".row-card.expanded");
  if (!card) throw new Error("expanded row card is missing");
  const outside = document.createElement("button");
  document.body.append(outside);
  act(() => {
    card.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: outside }));
  });
  outside.remove();
}

/** Focus hops between two fields inside the same row — must never flush. */
function blurInsideGroupTo(target: HTMLElement) {
  const card = document.querySelector(".row-card.expanded");
  if (!card) throw new Error("expanded row card is missing");
  act(() => {
    card.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: target }));
  });
}

function focusInput(input: HTMLInputElement) {
  act(() => {
    input.focus();
  });
}

function pressEnter(input: HTMLInputElement) {
  act(() => {
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
}

const nameInput = () =>
  document.querySelector<HTMLInputElement>('input[data-field="업체명"]')!;
const countInput = () =>
  document.querySelector<HTMLInputElement>('input[data-field="주문개수"]')!;
const dateInput = () =>
  document.querySelector<HTMLInputElement>('input[data-field="구매일"]')!;

beforeEach(() => {
  vi.useFakeTimers();
  saveImpl = async () => undefined;
  // Stable delegating mock: RowCard reads onSave through a ref, so tests can
  // swap saveImpl mid-flight without a re-render.
  onSave = vi.fn((data: Record<string, unknown>) => saveImpl(data));
  onCollapse = vi.fn();
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("db row autosave", () => {
  it("removes the ordinary save button and sends nothing on mount, blur, or refetch render", async () => {
    renderCard();
    expect(document.querySelector(".row-card.expanded")).not.toBeNull();
    expect(
      [...document.querySelectorAll("button")].some((b) => b.textContent?.includes("저장")),
    ).toBe(false);
    await advance(2000);
    blurRowGroup();
    await settle();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves a debounced text edit exactly once and stays quiet afterwards", async () => {
    renderCard();
    changeInput(nameInput(), "바뀐상호");
    await advance(800);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ 업체명: "바뀐상호", 구매일: "2026-09-01" });
    expect(document.body.textContent).toContain("저장됨");
    await advance(3000);
    blurRowGroup();
    await settle();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("joins an in-flight save on repeated group blur instead of duplicating it", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    onSave = vi.fn(() => gate.then(() => undefined));
    renderCard();
    changeInput(nameInput(), "블러상호");
    blurRowGroup();
    blurRowGroup();
    await advance(1000);
    blurRowGroup();
    await settle();
    expect(onSave).toHaveBeenCalledTimes(1);
    act(() => release());
    await settle();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain("저장됨");
  });

  it("flushes on Enter without waiting for the debounce", async () => {
    renderCard();
    changeInput(countInput(), "12");
    pressEnter(countInput());
    await settle();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ 주문개수: 12 });
  });

  it("keeps the latest edit made during a save and never lets a stale response clear it", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    onSave = vi.fn(() => gate.then(() => undefined));
    renderCard();
    changeInput(nameInput(), "첫번째");
    blurRowGroup();
    await settle();
    expect(onSave).toHaveBeenCalledTimes(1);
    changeInput(nameInput(), "두번째");
    await advance(800);
    await settle();
    act(() => release());
    await settle();
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave.mock.calls[1]?.[0]).toMatchObject({ 업체명: "두번째" });
    expect(document.body.textContent).toContain("저장됨");
    expect(document.body.textContent).not.toContain("다시 시도");
  });

  it("keeps the draft and shows retry on rejection, and never claims saved before ACK", async () => {
    saveImpl = async () => {
      throw new Error("sheet busy");
    };
    renderCard();
    changeInput(nameInput(), "실패상호");
    await advance(800);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain("저장됨");
    expect(document.body.textContent).toContain("다시 시도");
    expect(nameInput().value).toBe("실패상호");
    saveImpl = async () => undefined;
    await act(async () => {
      [...document.querySelectorAll("button")]
        .find((b) => b.textContent === "다시 시도")
        ?.click();
    });
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).toContain("저장됨");
  });

  it("blocks invalid money, preserves the input, and sends after correction", async () => {
    renderCard();
    changeInput(countInput(), "-5");
    expect(document.body.textContent).toContain("0 이상");
    await advance(1000);
    blurRowGroup();
    await settle();
    expect(onSave).not.toHaveBeenCalled();
    expect(countInput().value).toBe("-5");
    changeInput(countInput(), "3");
    // 주문개수 is a money-group input: debounce alone never sends it.
    await advance(1200);
    expect(onSave).not.toHaveBeenCalled();
    blurRowGroup();
    await settle();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ 주문개수: 3 });
  });

  it("holds a money edit under focus past the debounce with no request, then writes once on row exit", async () => {
    renderCard();
    const count = countInput();
    focusInput(count);
    changeInput(count, "15");
    await advance(800);
    await advance(800);
    expect(onSave).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("저장됨");
    blurRowGroup();
    await settle();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ 주문개수: 15, 구매일: "2026-09-01" });
    expect(document.body.textContent).toContain("저장됨");
  });

  it("sends nothing on focus transfer inside the row and writes money+date coherently once on row exit", async () => {
    renderCard();
    changeInput(countInput(), "15");
    blurInsideGroupTo(dateInput());
    await advance(1000);
    expect(onSave).not.toHaveBeenCalled();
    changeInput(dateInput(), "2026-09-02");
    blurInsideGroupTo(countInput());
    await advance(1000);
    expect(onSave).not.toHaveBeenCalled();
    blurRowGroup();
    await settle();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ 주문개수: 15, 구매일: "2026-09-02" });
    await advance(2000);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("blocks a cleared date without sending and keeps the row open", async () => {
    renderCard();
    changeInput(dateInput(), "");
    expect(document.body.textContent).toContain("구매일");
    await advance(1000);
    blurRowGroup();
    await settle();
    expect(onSave).not.toHaveBeenCalled();
    expect(onCollapse).not.toHaveBeenCalled();
  });

  it("offers lightweight undo that restores the previously saved payload", async () => {
    renderCard();
    changeInput(nameInput(), "첫저장");
    await advance(800);
    changeInput(nameInput(), "둘째저장");
    await advance(800);
    expect(onSave).toHaveBeenCalledTimes(2);
    await act(async () => {
      [...document.querySelectorAll("button")]
        .find((b) => b.textContent === "되돌리기")
        ?.click();
    });
    expect(onSave).toHaveBeenCalledTimes(3);
    expect(onSave.mock.calls[2]?.[0]).toMatchObject({ 업체명: "첫저장" });
    expect(nameInput().value).toBe("첫저장");
  });

  it("keeps an explicit delete affordance while the save footer is gone", () => {
    renderCard();
    const del = [...document.querySelectorAll("button")].find((b) =>
      b.getAttribute("aria-label")?.includes("삭제"),
    );
    expect(del).not.toBeUndefined();
  });
});
