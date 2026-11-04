/**
 * useKeepFocusedInPlace — 자동저장·새 기록 추가로 화면이 다시 그려질 때, 지금 적고 있는 칸이
 * 화면에서 위아래로 움직이지 않게 스크롤을 되돌린다(belie 2026-11-05 「모바일 todo 작성 중 자동저장하면 스크롤이 내려가 헷갈려」).
 *
 * deps 가 바뀐 렌더에서: 그리기 전(렌더 중) 입력 칸의 화면 위치를 재고, 그린 뒤(layout effect) 다시 재서
 * 달라진 만큼 window 를 스크롤한다. 칸이 scope 안의 입력(input·textarea·select)일 때만.
 */
"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

function focusedField(scope: HTMLElement | null): HTMLElement | null {
  const el = typeof document === "undefined" ? null : document.activeElement;
  if (!(el instanceof HTMLElement) || !scope?.contains(el)) return null;
  return el.matches("input, textarea, select") ? el : null;
}

export function useKeepFocusedInPlace(scope: RefObject<HTMLElement | null>, deps: readonly unknown[]) {
  const prevDeps = useRef<readonly unknown[] | null>(null);
  const before = useRef<{ el: HTMLElement; top: number } | null>(null);
  const changed = !prevDeps.current || deps.length !== prevDeps.current.length || deps.some((d, i) => !Object.is(d, prevDeps.current![i]));
  if (changed) {
    // 렌더 중에는 DOM 이 아직 이전 모습이다 — 바뀌기 전 위치.
    const el = focusedField(scope.current);
    before.current = el ? { el, top: el.getBoundingClientRect().top } : null;
  }
  prevDeps.current = deps;
  useLayoutEffect(() => {
    const b = before.current;
    before.current = null;
    if (!b || !b.el.isConnected || document.activeElement !== b.el) return;
    const delta = b.el.getBoundingClientRect().top - b.top;
    if (Math.abs(delta) >= 1) window.scrollBy(0, delta);
  });
}
