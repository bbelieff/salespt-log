/**
 * React Query 훅 — 사용자 프로필 (TopHeader 표시용).
 * 캐시: ['me'] — 1시간 stale (시트 B3/C3 거의 안 바뀜).
 */
"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { MeProfile } from "@/service";

const meKey = () => ["me"] as const;

async function fetchMe(): Promise<MeProfile> {
  const res = await fetch("/api/me");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `me fetch ${res.status}`);
  }
  return (await res.json()) as MeProfile;
}

export function useMe(): UseQueryResult<MeProfile> {
  return useQuery({
    queryKey: meKey(),
    queryFn: fetchMe,
    staleTime: 60 * 60 * 1000, // 1시간
    gcTime: 60 * 60 * 1000,
  });
}
