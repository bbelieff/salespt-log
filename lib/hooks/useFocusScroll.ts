/**
 * useFocusScroll — 캘린더 → 탭 이동 시 대상 카드 스크롤 + 3초 하이라이트 링.
 * active=true 가 되면 ref 요소로 smooth scroll + ring=true(3초 후 자동 false).
 * 사용: MeetingResultCard(미팅 focus) · TodoSection(투두 focus).
 */
"use client";

import { useEffect, useRef, useState } from "react";

export function useFocusScroll<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T | null>(null);
  const [ring, setRing] = useState(false);
  useEffect(() => {
    if (!active) return;
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setRing(true);
    const t = setTimeout(() => setRing(false), 3000);
    return () => clearTimeout(t);
  }, [active]);
  return { ref, ring };
}
