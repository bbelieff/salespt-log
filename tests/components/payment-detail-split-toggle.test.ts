// @vitest-environment jsdom
/** 상세 두 칸 넓히기 전환(2026-11-01 belie) — 누를 때마다 업체정보 최대 ↔ 진행 최대, 그림이 넓은 칸을 보여 준다. */
import * as React from "react";
import { act, createElement as h, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import DetailSplitToggle, { DETAIL_SPLIT_MAX, DETAIL_SPLIT_MIN, nextDetailSplit } from "@/app/(app)/payment/_components/DetailSplitToggle";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | undefined;
let el: HTMLDivElement | undefined;
afterEach(() => { act(() => root?.unmount()); el?.remove(); root = undefined; el = undefined; });

describe("DetailSplitToggle", () => {
  it("다음 상태: 업체정보가 넓으면 진행 최대, 진행이 넓으면 업체정보 최대", () => {
    expect(nextDetailSplit(60)).toBe(DETAIL_SPLIT_MIN);
    expect(nextDetailSplit(DETAIL_SPLIT_MAX)).toBe(DETAIL_SPLIT_MIN);
    expect(nextDetailSplit(DETAIL_SPLIT_MIN)).toBe(DETAIL_SPLIT_MAX);
    expect(nextDetailSplit(45)).toBe(DETAIL_SPLIT_MAX);
  });

  it("누를 때마다 번갈아 바뀌고, 버튼 그림·설명이 지금 넓은 칸을 따라간다", () => {
    const seen: number[] = [];
    function Host() {
      const [pct, setPct] = useState(60);
      return h(DetailSplitToggle, { pct, onToggle: (next: number) => { seen.push(next); setPct(next); } });
    }
    el = document.createElement("div"); document.body.appendChild(el); root = createRoot(el);
    act(() => root!.render(h(Host)));
    const btn = () => el!.querySelector<HTMLButtonElement>("[data-payment-detail-split]")!;
    expect(btn().dataset.paymentDetailSplit).toBe("info");
    expect(btn().getAttribute("aria-label")).toContain("업체정보를 넓게 보는 중");
    act(() => btn().click());
    expect(btn().dataset.paymentDetailSplit).toBe("work");
    expect(btn().getAttribute("aria-label")).toContain("진행을 넓게 보는 중");
    act(() => btn().click());
    expect(btn().dataset.paymentDetailSplit).toBe("info");
    expect(seen).toEqual([DETAIL_SPLIT_MIN, DETAIL_SPLIT_MAX]);
    expect(btn().textContent).toBe(""); // 글자 대신 그림
  });
});
