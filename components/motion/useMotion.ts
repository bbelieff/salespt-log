/**
 * 대시보드 움직임 공용(belie 2026-10-09 — 스크롤 인터랙션 도감 1~3순위).
 * - 등장 효과는 이 탭(세션)에서 처음 한 번만, 짧게. 다른 탭을 다녀와도 다시 돌지 않는다.
 * - 기기의 「동작 줄이기」가 켜져 있으면 돌지 않는다.
 */
"use client";

import { useEffect, useState } from "react";

const SEEN = "salespt:fx-seen:";

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** 이 효과를 지금 틀지 — 세션에서 처음 보는 key 이고 동작 줄이기가 꺼져 있을 때만 true. */
export function useFirstPlay(key: string): boolean {
  const [play] = useState(() => {
    if (typeof window === "undefined" || prefersReducedMotion()) return false;
    try {
      return sessionStorage.getItem(SEEN + key) !== "1";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(SEEN + key, "1");
    } catch {
      // 기억하지 못하면 다음에도 한 번 더 돈다 — 문제없다.
    }
  }, [key]);
  return play;
}
