/**
 * React Query 훅 — 사용자 프로필 (TopHeader 표시용).
 * 캐시: ['me'] — 1시간 stale (시트 B3/C3 거의 안 바뀜).
 */
"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { MeProfile } from "@/service";

/** /api/me 확장 — admin 메타 포함. */
export interface MeView extends MeProfile {
  isAdmin?: boolean;
  sessionEmail?: string;
  impersonating?: string | null;
}

const meKey = () => ["me"] as const;

async function fetchMe(): Promise<MeView> {
  const res = await fetch("/api/me");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `me fetch ${res.status}`);
  }
  return (await res.json()) as MeView;
}

export function useMe(): UseQueryResult<MeView> {
  return useQuery({
    queryKey: meKey(),
    queryFn: fetchMe,
    staleTime: 60 * 60 * 1000, // 1시간
    gcTime: 60 * 60 * 1000,
  });
}
