"use client";
/**
 * 통화 집중(2026-11-07 belie 모바일 기획 2판 PR4) — 거는 창·대본 창·녹음 올리기·통화 정리 확인이 열린 동안
 * 새소식 팝업이 끼어들지 않게 한다. 연 쪽은 useCallFocus(true), 새소식은 callFocusHeld() 면 끝날 때(CALL_FOCUS_END)까지 미룬다.
 * 같은 화면 안의 잠깐 상태라 저장하지 않는다(모듈 변수).
 */
import { useEffect } from "react";

export const CALL_FOCUS_END = "salespt:call-focus-end";
let holds = 0;

export function holdCallFocus(): () => void {
  holds++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds = Math.max(0, holds - 1);
    if (holds === 0) window.dispatchEvent(new Event(CALL_FOCUS_END));
  };
}

export const callFocusHeld = () => holds > 0;

export function useCallFocus(active: boolean) {
  useEffect(() => (active ? holdCallFocus() : undefined), [active]);
}
