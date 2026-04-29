/**
 * React Query 훅 — 컨택탭 데이터 페칭/뮤테이션.
 *
 * 캐시 키:
 *   - ['day', date]            → ContactDayView
 *
 * ⚠️ 중요: mutation 훅은 stateless (date를 hook 인자로 받지 않음).
 * date는 mutateAsync 호출 시 인자로 전달.
 *   - 이전: useSaveMetrics(date) → mutationFn이 date를 클로저로 캡처 →
 *           re-render 시 새 date로 갱신되어 race condition 발생
 *           (4/29 등록 중 5/1 navigate 시 5/1 row에 4/29 draft 저장됨)
 *   - 현재: useSaveMetrics() → mutateAsync({date, channels}) → 호출 시점의
 *           date가 그대로 mutationFn에 전달되어 closure stale 없음
 */
"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import type { Channel, Meeting } from "@/types";
import type {
  CalendarMonthView,
  ChannelDailyRowMetrics,
  ContactDayView,
  ScheduleWeekView,
} from "@/service";

// ── 키 ────────────────────────────────────────────────────────
export const dayKey = (date: string) => ["day", date] as const;
export const weekKey = (weekStart: string) => ["week", weekStart] as const;
export const monthKey = (yyyyMM: string) => ["month", yyyyMM] as const;

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

// ── 쿼리 ──────────────────────────────────────────────────────
export function useDay(date: string): UseQueryResult<ContactDayView> {
  return useQuery({
    queryKey: dayKey(date),
    queryFn: () => fetchJSON<ContactDayView>(`/api/daily/${date}`),
    enabled: !!date,
  });
}

/** 일정·계약 탭 — 한 주(7일) 미팅 (미팅날짜 기준). */
export function useWeekMeetings(
  weekStart: string,
): UseQueryResult<ScheduleWeekView> {
  return useQuery({
    queryKey: weekKey(weekStart),
    queryFn: () =>
      fetchJSON<ScheduleWeekView>(`/api/meetings/week/${weekStart}`),
    enabled: !!weekStart,
  });
}

/** 캘린더 탭 — 한 달 미팅 (yyyy-MM, 미팅날짜 기준, 읽기 전용). */
export function useMonthMeetings(
  yyyyMM: string,
): UseQueryResult<CalendarMonthView> {
  return useQuery({
    queryKey: monthKey(yyyyMM),
    queryFn: () =>
      fetchJSON<CalendarMonthView>(`/api/meetings/month/${yyyyMM}`),
    enabled: !!yyyyMM,
  });
}

// ── Mutation 입력 타입 ────────────────────────────────────────
export interface SaveMetricsArgs {
  date: string;
  channels: Partial<Record<Channel, ChannelDailyRowMetrics>>;
}
export interface AppendMeetingArgs {
  date: string; // 캐시 invalidate용 (현재 view date)
  meeting: Meeting;
}
export interface PatchMeetingArgs {
  /** 컨택탭 캐시 invalidate용 (현재 view date). 일정·계약 탭에서 호출 시 빈 문자열 가능. */
  date: string;
  /** 일정·계약 탭 캐시 invalidate용 (선택). 컨택탭에서 호출 시 미설정 OK. */
  weekStart?: string;
  id: string;
  partial: Partial<Omit<Meeting, "id">>;
}
export interface RemoveMeetingArgs {
  date: string;
  weekStart?: string;
  id: string;
}

// ── 뮤테이션 ──────────────────────────────────────────────────
export function useSaveMetrics() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ date, channels }: SaveMetricsArgs) =>
      fetchJSON<{ ok: true }>(`/api/daily/${date}`, {
        method: "POST",
        body: JSON.stringify(channels),
      }),
    onSuccess: (_, { date }) =>
      qc.invalidateQueries({ queryKey: dayKey(date) }),
  });
}

export function useAppendMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ meeting }: AppendMeetingArgs) =>
      fetchJSON<{ ok: true; id: string }>(`/api/meeting`, {
        method: "POST",
        body: JSON.stringify(meeting),
      }),
    onSuccess: (_, { date, meeting }) => {
      // 예약일 기준 view 캐시 invalidate (그 view에 등록 카드가 보여야 함).
      // 미팅날짜가 다른 날이면 그 날도 invalidate (일정·계약 탭 대비).
      qc.invalidateQueries({ queryKey: dayKey(date) });
      if (meeting.미팅날짜 && meeting.미팅날짜 !== date) {
        qc.invalidateQueries({ queryKey: dayKey(meeting.미팅날짜) });
      }
    },
  });
}

export function usePatchMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, partial }: PatchMeetingArgs) =>
      fetchJSON<{ ok: true }>(`/api/meeting/${id}`, {
        method: "PATCH",
        body: JSON.stringify(partial),
      }),
    onSuccess: (_, { date, weekStart }) => {
      if (date) qc.invalidateQueries({ queryKey: dayKey(date) });
      if (weekStart) qc.invalidateQueries({ queryKey: weekKey(weekStart) });
    },
  });
}

export function useRemoveMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: RemoveMeetingArgs) =>
      fetchJSON<{ ok: true }>(`/api/meeting/${id}`, { method: "DELETE" }),
    onSuccess: (_, { date }) =>
      qc.invalidateQueries({ queryKey: dayKey(date) }),
  });
}
