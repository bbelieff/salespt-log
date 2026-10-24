"use client";
import { useQuery } from "@tanstack/react-query";
import type { BadgeState } from "@/lib/analytics/badges";

export const badgesKey = () => ["badges"] as const;
export interface BadgesResponse { badges: BadgeState[]; partial: boolean }

/** 지금 보는 수강생의 배지. 헤더 메뉴·배지 수집 화면이 같은 캐시를 쓴다. */
export function useBadges(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: badgesKey(),
    queryFn: async (): Promise<BadgesResponse> => {
      const response = await fetch("/api/badges", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "배지를 불러오지 못했습니다.");
      return body;
    },
    enabled: opts.enabled ?? true, staleTime: 10 * 60_000, gcTime: 30 * 60_000, retry: false, meta: { background: true },
  });
}
