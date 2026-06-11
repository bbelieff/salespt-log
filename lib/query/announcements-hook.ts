/**
 * React Query 훅 — 새소식 (공지 + 업데이트, announcement-popup §3).
 * 캐시: ['announcements'] — 10분 stale (서버 캐시와 동일 주기).
 * AnnouncementsGate(자동 팝업) + TopHeader(점 뱃지)가 공유.
 */
"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { AnnouncementsView } from "@/service";

async function fetchAnnouncements(): Promise<AnnouncementsView> {
  const res = await fetch("/api/announcements");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `announcements fetch ${res.status}`);
  }
  return (await res.json()) as AnnouncementsView;
}

export function useAnnouncements(): UseQueryResult<AnnouncementsView> {
  return useQuery({
    queryKey: ["announcements"] as const,
    queryFn: fetchAnnouncements,
    staleTime: 10 * 60 * 1000, // 10분 — 서버 unstable_cache 와 동일
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
}
