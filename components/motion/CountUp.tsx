/**
 * CountUp — 숫자를 짧게 올라가며 멈추게(처음), 값이 바뀌면 이전 값에서 이어서 움직이게 한다.
 * 동작 줄이기면 바로 최종 값. 화면낭독기는 늘 최종 값만 읽는다(aria-label).
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "./useMotion";

const DURATION = 700;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

interface Props {
  value: number;
  /** 처음 마운트 때 0부터 올라갈지(usePlayOnOpen 결과). 아니면 처음엔 바로 값. */
  play: boolean;
  format?: (n: number) => string;
  /** 소수 자리(중간 값 반올림용). */
  decimals?: number;
}

export function useCountUp(value: number, play: boolean, decimals = 0): number {
  const [shown, setShown] = useState(play ? 0 : value);
  const from = useRef(play ? 0 : value);
  useEffect(() => {
    const start = from.current;
    if (start === value || prefersReducedMotion()) {
      from.current = value;
      setShown(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const k = Math.pow(10, decimals);
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / DURATION);
      const v = start + (value - start) * ease(t);
      from.current = v;
      setShown(t < 1 ? Math.round(v * k) / k : value);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, decimals]);
  return shown;
}

export default function CountUp({ value, play, format = (n) => n.toLocaleString("ko-KR"), decimals = 0 }: Props) {
  const shown = useCountUp(value, play, decimals);
  return <span aria-label={format(value)}><span aria-hidden="true">{format(shown)}</span></span>;
}
