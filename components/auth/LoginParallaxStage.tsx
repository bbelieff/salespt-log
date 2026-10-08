/**
 * LoginParallaxStage — 로그인 로고 무대 + PC 포인터 패럴랙스(2026-10-09 belie 승인 목업, 인터랙션 ③).
 *
 * - 마우스(hover + 정밀 포인터)가 움직일 때만 화면 중앙 기준 -1~1 값을 `--lp-x`·`--lp-y` 로
 *   가장 가까운 `<main>` 에 쓴다. 각 층은 CSS `translate` 로 깊이만큼 움직인다(LoginScene 참고).
 *   transform 은 기존 숨쉬기·팝 애니메이션이 쓰고 있어 건드리지 않는다.
 * - 터치 기기·움직임 줄이기 설정에서는 아무것도 쓰지 않는다(층은 0 위치 그대로).
 * - 훅이 여기 있는 이유: LoginScene 은 테스트에서 일반 함수로 호출된다.
 */
"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

export default function LoginParallaxStage({ style, children }: { style?: CSSProperties; children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = ref.current?.closest("main");
    if (!host || !window.matchMedia) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let x = 0;
    let y = 0;
    const write = () => {
      raf = 0;
      host.style.setProperty("--lp-x", x.toFixed(3));
      host.style.setProperty("--lp-y", y.toFixed(3));
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(write); };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || !fine.matches || reduce.matches) return;
      x = Math.max(-1, Math.min(1, (e.clientX / window.innerWidth) * 2 - 1));
      y = Math.max(-1, Math.min(1, (e.clientY / window.innerHeight) * 2 - 1));
      queue();
    };
    // 창 밖으로 나가면 제자리로.
    const onLeave = (e: MouseEvent) => {
      if (e.relatedTarget || (x === 0 && y === 0)) return;
      x = 0;
      y = 0;
      queue();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("mouseout", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("mouseout", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className="relative flex flex-1 items-center justify-center py-12" style={style}>
      {children}
    </div>
  );
}
