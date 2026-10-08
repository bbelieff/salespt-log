// @vitest-environment jsdom

/**
 * 콜·지·기·소 수동 저장(belie 2026-10-08) + 펼친 카드 제목 줄 접기(전 채널).
 *
 * 수동 저장 채널은 디바운스·행 블러·Enter 어느 것으로도 전송하지 않고, 「저장」 버튼으로만
 * 한 번 보낸다. × / 제목 줄은 몰래 저장하지 않고 접기만 요청한다(미저장은 부모 가드가 묻는다).
 * 자동저장 채널(매입DB)은 제목 줄을 눌러도 기존 × 와 같이 플러시 후 접는다.
 */
import * as React from "react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RowCard from "@/app/(app)/db/_components/RowCard";
import { CHANNELS, type ChannelKey } from "@/app/(app)/db/_lib/channels";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const ROWS: Record<"referral" | "purchase", Record<string, unknown>> = {
  referral: { row: 5, 구분: "콜드콜", 접수일: "2026-10-01", 대표자명: "김믿음", 업체명: "에이스", 소개처: "", 연락처: "", 조건: "" },
  purchase: { row: 2, 구매일: "2026-09-01", 업체명: "원본상호", 총액: 11000, 부가세여부: false, 주문개수: 10, 기타: "" },
};

let root: Root | undefined;
let container: HTMLDivElement | undefined;
let onSave!: ReturnType<typeof vi.fn>;
let onCollapse!: ReturnType<typeof vi.fn>;

function renderCard(key: "referral" | "purchase") {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      createElement(RowCard, {
        channelKey: key as ChannelKey,
        channel: CHANNELS[key],
        index: 0,
        row: { ...ROWS[key] },
        expanded: true,
        pending: false,
        badgeCls: `badge-${key}`,
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
  act(() => {
    setter!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const settle = () => act(async () => {});
const advance = (ms: number) => act(async () => { vi.advanceTimersByTime(ms); });
const input = (field: string) => document.querySelector<HTMLInputElement>(`input[data-field="${field}"]`)!;
const buttonByText = (text: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
const header = () => document.querySelector<HTMLButtonElement>('button[aria-label$="행 접기"]')!;

function blurRow() {
  const card = document.querySelector(".row-card.expanded")!;
  const outside = document.createElement("button");
  document.body.append(outside);
  act(() => {
    card.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: outside }));
  });
  outside.remove();
}

beforeEach(() => {
  vi.useFakeTimers();
  onSave = vi.fn(async () => undefined);
  onCollapse = vi.fn();
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("콜·지·기·소 수동 저장", () => {
  it("is the only manual-save channel", () => {
    expect(CHANNELS.referral.manualSave).toBe(true);
    for (const k of ["purchase", "direct", "banner"] as const) expect(CHANNELS[k].manualSave).toBeFalsy();
  });

  it("never sends on debounce, row blur or Enter — only the 저장 button, once", async () => {
    renderCard("referral");
    const save = buttonByText("저장");
    expect(save).toBeDefined();
    expect(save!.disabled).toBe(true);

    changeInput(input("업체명"), "바뀐상호");
    await advance(3000);
    blurRow();
    act(() => {
      input("업체명").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    await settle();
    expect(onSave).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("저장하지 않은 변경이 있어요");

    expect(buttonByText("저장")!.disabled).toBe(false);
    act(() => buttonByText("저장")!.click());
    await settle();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ 업체명: "바뀐상호", 대표자명: "김믿음" });
    expect(document.body.textContent).toContain("저장됨");
    expect(buttonByText("저장")!.disabled).toBe(true);
  });

  it("× and the title row collapse without saving (the parent guard asks about unsaved edits)", async () => {
    renderCard("referral");
    changeInput(input("업체명"), "바뀐상호");
    act(() => header().click());
    await settle();
    expect(onCollapse).toHaveBeenCalledTimes(1);
    act(() => document.querySelector<HTMLButtonElement>('button[aria-label="접기"]')!.click());
    await settle();
    expect(onCollapse).toHaveBeenCalledTimes(2);
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe("펼친 카드 제목 줄 접기 (자동저장 채널)", () => {
  it("collapses on title-row click after flushing a pending edit, with no save button", async () => {
    renderCard("purchase");
    expect(buttonByText("저장")).toBeUndefined();
    changeInput(input("업체명"), "바뀐상호");
    act(() => header().click());
    await settle();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onCollapse).toHaveBeenCalledTimes(1);
  });

  it("delete stays a separate action that does not collapse the card", async () => {
    renderCard("purchase");
    act(() => document.querySelector<HTMLButtonElement>('button[aria-label$="행 삭제"]')!.click());
    await settle();
    expect(onCollapse).not.toHaveBeenCalled();
  });
});
