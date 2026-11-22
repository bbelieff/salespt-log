/**
 * 여러 줄 칸 높이를 내용에 맞춘다 — 값이 바뀔 때, 그리고 칸 너비가 바뀔 때(창 넓히기·접힌 판 펴기).
 * rows 는 처음 그릴 때의 바탕값이고, 긴 줄이 접혀 생긴 줄은 여기서 잰다. 숨겨져 높이가 0 이면 건드리지 않는다.
 * (2026-11-17 업체정보 칸에서 시작 → 2026-11-22 실무/수납 로드맵 메모에도 씀)
 */
import { useLayoutEffect, useRef } from "react";

export function useAutoGrow(value: string, on = true) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!on || !el) return;
    let width = -1;
    const fit = () => {
      el.style.height = "auto";
      if (el.scrollHeight > 0) el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
      width = el.clientWidth;
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => { if (el.clientWidth !== width) fit(); });
    observer.observe(el);
    return () => observer.disconnect();
  }, [value, on]);
  return ref;
}
