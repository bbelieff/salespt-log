"use client";
/**
 * 선택 바탕이 옆 칩으로 미끄러지는 표시(2026-11-24 belie) — 할 일 구역의 급한 정도 칩, 대시보드 기간 칩(선택 사항).
 * 눌린 칩(aria-pressed=true)의 자리·크기를 재서 표시(.slide-thumb)를 그리로 옮긴다(transform·width·height 전환, sliding-thumb.css).
 * 칩 폭이 글자·건수에 따라 달라지거나 줄이 바뀌어 두 줄이 돼도 다시 잰다. 아직 못 쟀거나(서버 렌더·숨은 화면) 잴 수 없으면
 * 표시를 그리지 않고 칩이 제 바탕을 그대로 쓴다. 접근성 상태(aria-pressed)는 칩이 그대로 갖는다 — 표시는 장식(aria-hidden)이다.
 * 쓰는 법: 칩 묶음(position:relative)의 첫 자식으로 <span ref={thumb} className="slide-thumb" data-on={…} style={style} aria-hidden /> 를 둔다.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

type Box = { x: number; y: number; w: number; h: number };
const PRESSED = ':scope > [aria-pressed="true"]';

export function useSlidingThumb() {
  const thumb = useRef<HTMLSpanElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const measure = useRef(() => {
    const host = thumb.current?.parentElement;
    const el = host?.querySelector<HTMLElement>(PRESSED);
    const from = host?.getBoundingClientRect(), to = el?.getBoundingClientRect();
    // 소수점 자리까지 잰다(글자 배율로 칩이 반 픽셀 단위가 된다). 표시는 묶음의 안쪽 여백 상자 기준이라 테두리 두께를 뺀다.
    const next = host && from && to && to.width > 0 ? { x: to.left - from.left - host.clientLeft + host.scrollLeft, y: to.top - from.top - host.clientTop + host.scrollTop, w: to.width, h: to.height } : null;
    const near = (m: number, n: number) => Math.abs(m - n) < 0.05;
    setBox(prev => prev && next && near(prev.x, next.x) && near(prev.y, next.y) && near(prev.w, next.w) && near(prev.h, next.h) ? prev : next);
  });
  // 선택·글자·건수가 바뀌는 모든 그리기 뒤에 다시 잰다(값이 같으면 상태를 바꾸지 않는다).
  useLayoutEffect(() => { measure.current(); });
  // 창 폭·글꼴 적용으로 칩이 밀리거나 줄이 바뀌는 경우.
  useEffect(() => {
    const host = thumb.current?.parentElement;
    if (!host || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure.current());
    observer.observe(host);
    for (const child of host.children) if (child !== thumb.current) observer.observe(child);
    return () => observer.disconnect();
  }, []);
  const style: CSSProperties | undefined = box ? { width: box.w, height: box.h, transform: `translate(${box.x}px, ${box.y}px)` } : undefined;
  return { thumb, on: box !== null, style };
}
