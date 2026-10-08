"use client";

/**
 * MobileChartCarousel — 대시보드 아래 차트 3종(영업 퍼널 · 주차 추이 · 채널별 성과)을
 * 1024px 미만에서 옆으로 넘기는 카드로 보여 준다(2026-10-09 belie 승인 목업, 인터랙션 ②).
 *
 * - 모바일: 가로 스크롤 + CSS scroll-snap(한 장씩 멈춤). 다음 카드가 살짝 보여 넘길 수 있음을 알린다.
 *   위 칩을 누르면 그 차트로, 아래 점은 현재 위치. 움직임 줄이기 설정이면 즉시 이동.
 * - PC(pc: 1024px+): 래퍼·스크롤러가 `pc:contents` 로 풀려 슬라이드(부모가 넘긴 그리드 칸)가
 *   그대로 대시보드 그리드의 칸이 된다 — PC 배치·높이 정렬은 바뀌지 않는다. 칩·점은 pc:hidden.
 * - 슬라이드 폭·스냅 클래스는 부모(page.tsx)의 각 차트 칸에 둔다(그리드 칸 수 검사가 page.tsx 를 본다).
 */
import { Children, useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  /** 칩·슬라이드 이름 (children 순서와 같다). */
  labels: readonly string[];
  children: ReactNode;
}

export default function MobileChartCarousel({ labels, children }: Props) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const count = Children.count(children);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const slides = Array.from(el.children) as HTMLElement[];
        if (slides.length === 0) return;
        // 스크롤러(relative) 왼쪽 안쪽 가장자리에 가장 가까운 슬라이드가 현재 카드.
        const target = el.scrollLeft + (parseFloat(getComputedStyle(el).paddingLeft) || 0);
        let best = 0;
        let bestDist = Infinity;
        slides.forEach((s, i) => {
          const d = Math.abs(s.offsetLeft - target);
          if (d < bestDist) { bestDist = d; best = i; }
        });
        setActive(best);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const go = (i: number) => {
    const el = scrollerRef.current;
    const slide = el?.children[i] as HTMLElement | undefined;
    if (!el || !slide) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    el.scrollTo({ left: slide.offsetLeft - pad, behavior: reduce ? "auto" : "smooth" });
    setActive(i);
  };

  return (
    <div className="space-y-2 pc:contents" role="region" aria-roledescription="carousel" aria-label="차트">
      <div className="flex flex-wrap gap-1.5 pc:hidden" role="group" aria-label="차트 고르기">
        {labels.map((label, i) => (
          <button
            key={label}
            type="button"
            aria-pressed={active === i}
            onClick={() => go(i)}
            className={`h-8 whitespace-nowrap rounded-full border px-3 text-xs font-semibold ${active === i ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-500"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div ref={scrollerRef} className="chart-snap-scroller relative -mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-1 scroll-px-3 pc:contents">
        {children}
      </div>
      <div className="flex justify-center gap-1.5 pc:hidden" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className={`h-1.5 w-1.5 rounded-full ${active === i ? "bg-blue-700" : "bg-slate-300"}`} />
        ))}
      </div>
    </div>
  );
}
