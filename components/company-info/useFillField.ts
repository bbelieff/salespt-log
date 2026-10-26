/**
 * 「공고필터」 펼침의 「채우기 →」(2026-10-26) — 업체정보가 접혀 있으면 펴고, 기본보기·거른 보기면
 * 그 칸이 보이는 보기로 바꾼 뒤 다음 그리기에서 그 칸으로 스크롤·포커스한다.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import type { CompanyInfo } from "@/types";

export function useFillField(bodyId: string, show: () => void) {
  const pending = useRef<keyof CompanyInfo | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    const key = pending.current;
    if (!key) return;
    const el = document.getElementById(bodyId)?.querySelector<HTMLElement>(`[id$="-${CSS.escape(String(key))}"]`);
    if (!el) return;
    pending.current = null;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.focus({ preventScroll: true });
  });
  return (key: keyof CompanyInfo) => {
    pending.current = key;
    show();
    setTick((t) => t + 1);
  };
}
