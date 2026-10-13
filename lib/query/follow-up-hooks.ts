"use client";
import { useQuery } from "@tanstack/react-query";
import { addDays, fmtISO, parseISO } from "@/util/week";
import { UPCOMING_DAYS } from "@/lib/analytics/dashboard-follow-ups";
import type { Meeting } from "@/types";
export const followUpMeetingsKey = () => ["meeting-follow-ups"] as const;
export function useFollowUpMeetings(today: string, opts: { enabled?: boolean; staleTime?: number } = {}) {
  return useQuery({
    queryKey: [...followUpMeetingsKey(), today],
    queryFn: async (): Promise<{ meetings: Meeting[] }> => {
      const response = await fetch(`/api/meetings/follow-ups?through=${encodeURIComponent(fmtISO(addDays(parseISO(today), UPCOMING_DAYS)))}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "미팅 목록을 불러오지 못했습니다.");
      return body;
    },
    enabled: opts.enabled ?? true, staleTime: opts.staleTime ?? 5 * 60_000,
    gcTime: 10 * 60_000, retry: false, meta: { background: true },
  });
}
