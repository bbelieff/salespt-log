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
 *   · 페이지가 최상단 아닐 때 미발동. 당김 중 preventDefault 로 iOS 고무줄과
 *     이중 동작 차단(passive:false).
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

const THRESHOLD = 70; // px — 당김 임계
const MAX_PULL = 110; // 표시 상한 (저항감)

export default function PullToRefresh() {
  const router = useRouter();
  const qc = useQueryClient();
  const [pull, setPull] = useState(0); // 현재 당김(px) — 0 이면 숨김
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const canceled = useRef(false);

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
      if (dy <= 0 || root().scrollTop > 0) {
        setPull(0);
        return;
      }
      // 당김 진행 — 고무줄과 이중 동작 방지
      if (e.cancelable) e.preventDefault();
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
    document.addEventListener("touchmove", onMove, { passive: false });
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
