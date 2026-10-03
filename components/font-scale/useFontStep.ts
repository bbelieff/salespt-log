/**
 * useFontStep — 범위별 글자 크기 단계(0~3)를 이 기기 브라우저에 기억한다(lib/util/font-scale.ts).
 * 같은 범위의 다른 박스(예: 모바일 펼침·PC 상세)도 바로 따라오게 창 이벤트로 알린다.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { clampFontStep, fontStepStorageKey, type FontScope } from "@/util/font-scale";

const EVENT = "salespt-font-step-change";

export function useFontStep(scope: FontScope): [number, (next: number) => void] {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const read = () => {
      try {
        setStep(clampFontStep(window.localStorage.getItem(fontStepStorageKey(scope))));
      } catch {
        // 저장소가 막힌 창 — 기본 크기
      }
    };
    read();
    const onChange = (e: Event) => {
      if ((e as CustomEvent<FontScope>).detail === scope) read();
    };
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, [scope]);
  const update = useCallback(
    (next: number) => {
      const v = clampFontStep(next);
      setStep(v);
      try {
        window.localStorage.setItem(fontStepStorageKey(scope), String(v));
      } catch {
        // 저장 실패 — 이번 화면에서만
      }
      window.dispatchEvent(new CustomEvent(EVENT, { detail: scope }));
    },
    [scope],
  );
  return [step, update];
}
