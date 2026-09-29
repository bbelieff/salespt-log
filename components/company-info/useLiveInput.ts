/**
 * useLiveInput — 입력하는 동시에 모양을 잡는 칸(쉼표·대시)의 커서 보정(lib/util/live-format.ts).
 * 값이 바뀐 뒤 그린 직후(layout effect) 커서를 "친 글자 뒤" 로 되돌린다 — 쉼표가 끼어도 튀지 않게.
 */
"use client";

import { useLayoutEffect, useRef, type ChangeEvent } from "react";
import type { LiveResult } from "@/util/live-format";

export function useLiveInput(
  format: (raw: string, caret: number, prev: string) => LiveResult | null,
  value: string,
  onChange: (v: string) => void,
) {
  const ref = useRef<HTMLInputElement>(null);
  const pending = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (pending.current !== null && el && document.activeElement === el) el.setSelectionRange(pending.current, pending.current);
    pending.current = null;
  });
  const handle = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const r = format(raw, e.target.selectionStart ?? raw.length, value);
    if (!r) return onChange(raw);
    pending.current = r.caret;
    onChange(r.value);
  };
  return { ref, onChange: handle };
}
