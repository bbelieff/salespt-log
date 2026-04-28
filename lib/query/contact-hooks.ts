/**
 * React Query 훅 — 컨택탭 데이터 페칭/뮤테이션.
 *
 * 캐시 키:
 *   - ['day', date]            → ContactDayView
 */
"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import type { Channel, Meeting } from "@/types";
import type { ChannelDailyRowMetrics, ContactDayView } from "@/service";

// ── 키 ────────────────────────────────────────────────────────
export const dayKey = (date: string) => ["day", date] as const;

// ── 페치 헬퍼 ─────────────────────────────────────────────────
async function fetchJSON<T>(
  input: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data?.error === "string" ? data.error : `HTTP ${res.status}`,
    );
  }
  return data as T;
}

// ── 쿼리/뮤테이션 ────────────────────────────────────────────
export function useDay(date: string): UseQueryResult<ContactDayView> {
  return useQuery({
    queryKey: dayKey(date),
    queryFn: () => fetchJSON<ContactDayView>(`/api/daily/${date}`),
    enabled: !!date,
  });
}

export function useSaveMetrics(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (channels: Partial<Record<Channel, ChannelDailyRowMetrics>>) =>
      fetchJSON<{ ok: true }>(`/api/daily/${date}`, {
        method: "POST",
        body: JSON.stringify(channels),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: dayKey(date) }),
  });
}

export function useAppendMeeting(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (meeting: Meeting) =>
      fetchJSON<{ ok: true; id: string }>(`/api/meeting`, {
        method: "POST",
        body: JSON.stringify(meeting),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: dayKey(date) }),
  });
}

export function usePatchMeeting(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      partial,
    }: {
      id: string;
      partial: Partial<Omit<Meeting, "id">>;
    }) =>
      fetchJSON<{ ok: true }>(`/api/meeting/${id}`, {
        method: "PATCH",
        body: JSON.stringify(partial),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: dayKey(date) }),
  });
}

export function useRemoveMeeting(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJSON<{ ok: true }>(`/api/meeting/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: dayKey(date) }),
  });
}
