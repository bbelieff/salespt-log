/**
 * useSwipe — 가벼운 좌우 스와이프 핸들러 (2026-05-17 [A3]).
 *
 * 라이브러리 의존성 X — touch event 만 사용. 50px threshold + 세로 우세 시 무시.
 * 컨택탭 / 일정계약탭 WeekHeader 영역에 적용해 주 단위 이동.
 */
"use client";

import { useRef } from "react";

interface Options {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** 최소 가로 이동 px (기본 50). */
  threshold?: number;
}

export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 50 }: Options) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      startX.current = t.clientX;
      startY.current = t.clientY;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (startX.current === null || startY.current === null) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - startX.current;
      const dy = t.clientY - startY.current;
      startX.current = null;
      startY.current = null;
      // 세로 우세 → 일반 스크롤로 처리, 무시
      if (Math.abs(dy) > Math.abs(dx)) return;
      if (Math.abs(dx) < threshold) return;
      if (dx < 0) onSwipeLeft?.();
      else onSwipeRight?.();
    },
  };
}
