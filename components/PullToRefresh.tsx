/**
 * PullToRefresh — 모바일 당겨서 새로고침 (feat/pull-to-refresh).
 *
 * PWA standalone 에는 브라우저 기본 당김 새로고침이 없어 자체 구현.
 * 동작: 페이지 루트 스크롤 최상단(scrollTop=0)에서 아래로 당김(임계 70px) →
 * 스피너 → 놓으면 react-query 활성 쿼리 invalidate + router.refresh()
 * (전체 리로드 아님 — 입력 중 폼 값 보존).
 *
 * 가드(제스처 충돌 금지):
 *   · 모바일 전용 — pointer:coarse + 뷰포트 <1024(pc). PC 무변화.
 *   · 가로 제스처(위클리 스와이프) 감지 시 그 터치 세션 무시(|dx|>|dy| 1회로 취소).
 *   · 모달/시트(fixed 컨테이너) 내부 터치 무시 — 내부 스크롤과 충돌 방지.
 *   · 페이지가 최상단 아닐 때 미발동.
 *   · ★리스너는 전부 passive(2026-10-24 — 안드로이드에서 특히 스크롤이 뻑뻑). 예전엔 touchmove 를
 *     passive:false 로 달아 preventDefault 로 브라우저 기본 당김·고무줄을 막았는데, 문서 전체에 막을 수
 *     있는 touchmove 가 있으면 안드로이드 크롬은 **모든 스크롤**을 JS 응답까지 기다린다. 이제 기본 당김·
 *     고무줄은 CSS `overscroll-behavior-y: none`(globals.css, 모바일 터치 화면)으로 끈다.
 *   · ★안쪽 스크롤 영역(표·목록·패널)이 맨 위가 아니면 미발동(2026-10-24 belie 「모바일 위아래
 *     스크롤이 잘 안 됨」). 높이 고정 화면은 페이지 자체가 늘 최상단이라, 이 가드가 없으면
 *     안쪽 목록을 위로 올리는 손가락(아래로 끌기)마다 preventDefault 가 걸려 스크롤이 멈췄다.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

const THRESHOLD = 70; // px — 당김 임계

/** 터치 지점의 조상 중 세로로 스크롤되는 안쪽 영역(페이지 루트 제외) — 터치 시작 때 한 번만 구한다. */
export function verticalScrollers(target: EventTarget | null): Element[] {
  const rootEl = document.scrollingElement ?? document.documentElement;
  const found: Element[] = [];
  for (let el = target instanceof Element ? target : null; el && el !== rootEl && el !== document.body; el = el.parentElement) {
    if (el.scrollHeight > el.clientHeight) {
      const oy = getComputedStyle(el).overflowY;
      if (oy === "auto" || oy === "scroll" || oy === "overlay") found.push(el);
    }
  }
  return found;
}

/** 터치 지점의 안쪽 스크롤 영역 중 맨 위가 아닌 것이 있으면 true. */
export function insideScrolledArea(target: EventTarget | null): boolean {
  return verticalScrollers(target).some((el) => el.scrollTop > 0);
}
const MAX_PULL = 110; // 표시 상한 (저항감)

export default function PullToRefresh() {
  const router = useRouter();
  const qc = useQueryClient();
  const [pull, setPull] = useState(0); // 현재 당김(px) — 0 이면 숨김
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const canceled = useRef(false);
  const scrollers = useRef<Element[]>([]);

  useEffect(() => {
    // 모바일 전용 — 데스크톱(PC)은 리스너 자체를 안 단다.
    const isMobile =
      window.matchMedia("(pointer: coarse)").matches && window.innerWidth < 1024;
    if (!isMobile) return;

    const root = () => document.scrollingElement ?? document.documentElement;

    const onStart = (e: TouchEvent) => {
      start.current = null;
      canceled.current = false;
      if (root().scrollTop > 0) return; // 최상단에서만
      const t = e.target as HTMLElement | null;
      if (t?.closest(".fixed")) return; // 모달/시트/토스트 내부 무시
      scrollers.current = verticalScrollers(t);
      if (scrollers.current.some((el) => el.scrollTop > 0)) return; // 안쪽 목록이 내려가 있으면 그 목록 스크롤이 우선
      const touch = e.touches[0];
      if (touch) start.current = { x: touch.clientX, y: touch.clientY };
    };

    const onMove = (e: TouchEvent) => {
      if (!start.current || canceled.current || refreshing) return;
      const touch = e.touches[0];
      if (!touch) return;
      const dx = touch.clientX - start.current.x;
      const dy = touch.clientY - start.current.y;
      // 가로 제스처(스와이프) 우세 → 이 세션 포기
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
        canceled.current = true;
        setPull(0);
        return;
      }
      // 같은 터치 안에서 먼저 위로 밀어 안쪽 목록이 내려갔다면, 되돌아오는 손가락은 목록 스크롤이다.
      if (dy <= 0 || root().scrollTop > 0 || scrollers.current.some((el) => el.scrollTop > 0)) {
        setPull(0);
        return;
      }
      // 당김 진행 — preventDefault 없음(passive). 기본 당김·고무줄은 CSS overscroll-behavior 가 끈다.
      setPull(Math.min(MAX_PULL, dy * 0.5)); // 저항 0.5
    };

    const onEnd = () => {
      if (!start.current || canceled.current) return;
      start.current = null;
      setPull((p) => {
        if (p >= THRESHOLD * 0.5 && !refreshing) {
          setRefreshing(true);
          void Promise.all([qc.invalidateQueries(), Promise.resolve(router.refresh())])
            .finally(() => {
              // 짧은 최소 표시(스피너 깜빡임 방지)
              setTimeout(() => {
                setRefreshing(false);
                setPull(0);
              }, 600);
            });
          return p;
        }
        return 0;
      });
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
    };
    // refreshing 은 ref 적 사용 — 리스너 재바인딩 불필요한 수준의 가드라 deps 고정.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = pull > 8 || refreshing;
  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed left-1/2 z-[200] -translate-x-1/2"
      style={{ top: Math.min(pull, MAX_PULL) - 4 }}
      aria-live="polite"
      aria-label={refreshing ? "새로고침 중" : "당겨서 새로고침"}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-100 bg-white shadow-md">
        <svg
          className={`h-5 w-5 text-brand-red ${refreshing ? "animate-spin" : ""}`}
          style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 4v5h5M20 20v-5h-5M5.07 9A8 8 0 0119.07 12M18.93 15A8 8 0 014.93 12"
          />
        </svg>
      </div>
    </div>
  );
}
