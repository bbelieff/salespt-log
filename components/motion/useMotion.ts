/**
 * 대시보드 움직임 공용(belie 2026-10-09 — 스크롤 인터랙션 도감 1~3순위).
 * - 등장 효과는 대시보드를 열 때마다 돈다(belie 2026-10-09 — 처음 한 번만에서 바꿈). 1초 안.
 * - 기기의 「동작 줄이기」가 켜져 있으면 돌지 않는다.
 */
"use client";

import { useState } from "react";

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** 이 화면을 열 때 효과를 틀지 — 동작 줄이기가 꺼져 있으면 true. key 는 효과 이름(읽는 사람용). */
export function usePlayOnOpen(_key: string): boolean {
  const [play] = useState(() => typeof window !== "undefined" && !prefersReducedMotion());
  return play;
}
