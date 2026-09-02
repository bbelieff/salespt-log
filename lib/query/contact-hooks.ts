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
import { track, EVENTS } from "@/analytics";
import { leadsPickerKey } from "./db-hooks";

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
    // 2026-05-17: 주차 스와이프 시 깜빡임 제거 — 이전 데이터 유지 후 새 데이터로 swap.
    placeholderData: (prev) => prev,
    // 2026-06: /contact↔/calendar 빠른 전환 시 60s 내 재요청 억제 → 시트 read 폭주(429)
    // 차단. 저장 등 뮤테이션은 invalidateQueries 로 즉시 재요청되므로 신선도 보존.
    staleTime: 60_000,
    // BBE-242 처방4(2026-08-27): 기본 gcTime(5분)이면 5분+ 자리비움 후 리마운트 시
    // 캐시가 완전히 비어 로딩부터 다시 시작 — 10분으로 올려 stale-즉시표시+백그라운드
    // 갱신 창을 넓힌다. invalidateQueries 는 gcTime 과 무관하게 즉시 재요청시키므로
    // 뮤테이션 후 신선도는 그대로 보존.
    gcTime: 10 * 60_000,
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
    // 2026-05-17: 동일 — 주차 이동 시 빈 화면 방지.
    placeholderData: (prev) => prev,
    staleTime: 60_000, // 2026-06: 화면 전환 read 폭주 억제 (뮤테이션은 invalidate).
    gcTime: 10 * 60_000, // BBE-242 처방4 — useDay 주석 참고.
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
    staleTime: 60_000, // 2026-06: 캘린더↔컨택 전환 read 폭주 억제 (뮤테이션은 invalidate).
    gcTime: 10 * 60_000, // BBE-242 처방4 — useDay 주석 참고.
  });
}

// 수납 탭(useDailyRevenue / useSaveDailyRevenue / paymentKey)은
// PR #38·39·40에서 contract-payment로 모델 재정의되어 폐기됨.
// 새 훅: lib/query/contract-payment-hooks.ts

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
      fetchJSON<{ ok: true; directProductionHold?: boolean }>(`/api/daily/${date}`, {
        method: "POST",
        body: JSON.stringify(channels),
      }),
    onSuccess: (_, { date, channels }) => {
      track(EVENTS.METRICS_SAVED, {
        channel_count: Object.keys(channels ?? {}).length,
      });
      qc.invalidateQueries({ queryKey: dayKey(date) });
    },
  });
}

/** 기록 옮기기 — 하루치 지표를 다른 날짜·채널로. 미팅 행 이동은 별도 PATCH.
 *  양쪽 날짜 캐시를 모두 무효화해야 옮긴 결과가 두 화면에 함께 보인다. */
export interface MoveMetricsArgs {
  from: { date: string; channel: Channel; metrics?: ChannelDailyRowMetrics };
  to: { date: string; channel: Channel; metrics?: ChannelDailyRowMetrics };
  deltas: { inflow?: number; contactProgress?: number };
}
export interface MoveMetricsResult {
  ok: true;
  from: ChannelDailyRowMetrics;
  to: ChannelDailyRowMetrics;
  applied: { inflow?: number; contactProgress?: number };
}
export function useMoveDailyMetrics() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: MoveMetricsArgs) =>
      fetchJSON<MoveMetricsResult>(`/api/daily/move`, {
        method: "POST",
        body: JSON.stringify(args),
      }),
    onSuccess: (_, { from, to }) => {
      qc.invalidateQueries({ queryKey: dayKey(from.date) });
      if (to.date !== from.date) qc.invalidateQueries({ queryKey: dayKey(to.date) });
      qc.invalidateQueries({ queryKey: ["week"] });
    },
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
      track(EVENTS.MEETING_BOOKED, {
        cross_day: Boolean(meeting.미팅날짜 && meeting.미팅날짜 !== date),
      });
      qc.invalidateQueries({ queryKey: dayKey(date) });
      if (meeting.미팅날짜 && meeting.미팅날짜 !== date) {
        qc.invalidateQueries({ queryKey: dayKey(meeting.미팅날짜) });
      }
      // 2026-05-19 fix: 일정탭 week view 도 invalidate — 추가미팅이 일정탭에
      // 안 보이던 버그. weekStart 계산 없이 전체 week 무효화.
      qc.invalidateQueries({ queryKey: ["week"] });
      // 발굴 피커: 이 미팅이 발굴을 소비했을 수 있음 → matched 재계산(전환된 발굴 숨김, KPI-④).
      qc.invalidateQueries({ queryKey: leadsPickerKey() });
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
      track(EVENTS.MEETING_UPDATED);
      if (date) qc.invalidateQueries({ queryKey: dayKey(date) });
      if (weekStart) qc.invalidateQueries({ queryKey: weekKey(weekStart) });
      // 2026-05-19 Phase 2: 계약→非계약 transition 시 02 row cascade →
      // 수납탭 캐시도 무효화.
      qc.invalidateQueries({ queryKey: ["payments"] });
      // 콜지기소 미팅 업체명 변경 시 vendor-name 폴백 matched 재계산(KPI-④ 대칭).
      qc.invalidateQueries({ queryKey: leadsPickerKey() });
    },
  });
}

export interface RevertMeetingArgs {
  /** 일정·계약 탭 캐시 invalidate */
  weekStart?: string;
  /** 컨택탭 캐시 invalidate (선택) */
  date?: string;
  id: string;
}

/**
 * 미팅 결과 되돌리기 (2026-05-17 [2a]).
 * 서버에서 상태별 cascade 수행 → 응답으로 cascade 요약 반환 (UI 토스트용).
 */
export function useRevertMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: RevertMeetingArgs) =>
      fetchJSON<{ ok: true; status: string; cascade: string }>(
        `/api/meeting/${id}/revert`,
        { method: "POST" },
      ),
    onSuccess: (_, { date, weekStart }) => {
      track(EVENTS.MEETING_REVERTED);
      if (date) qc.invalidateQueries({ queryKey: dayKey(date) });
      if (weekStart) qc.invalidateQueries({ queryKey: weekKey(weekStart) });
      // 되돌리기=미팅 소비 취소 → 발굴 matched 재계산(재선택 가능하게, KPI-④ 대칭).
      qc.invalidateQueries({ queryKey: leadsPickerKey() });
    },
  });
}

/** 케이스 종료 되살리기 (2026-05-19) — 자식 추가미팅 삭제. */
export function useReviveCaseClosure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; weekStart?: string }) =>
      fetchJSON<{ ok: true; cascade: string; childId: string | null }>(
        `/api/meeting/${id}/revive-case`,
        { method: "POST" },
      ),
    onSuccess: () => {
      track(EVENTS.CASE_REVIVED);
      qc.invalidateQueries({ queryKey: ["week"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      // 자식 미팅 삭제=소비 취소 가능 → 발굴 matched 재계산(KPI-④ 대칭).
      qc.invalidateQueries({ queryKey: leadsPickerKey() });
    },
  });
}

export function useRemoveMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: RemoveMeetingArgs) =>
      fetchJSON<{ ok: true }>(`/api/meeting/${id}`, { method: "DELETE" }),
    onSuccess: (_, { date }) => {
      track(EVENTS.MEETING_REMOVED);
      qc.invalidateQueries({ queryKey: dayKey(date) });
      qc.invalidateQueries({ queryKey: ["week"] });
      // 02 계약수납관리 cascade (PR #241) 후 수납탭도 무효화.
      qc.invalidateQueries({ queryKey: ["payments"] });
      // 미팅 삭제=발굴 소비 취소 → matched 재계산(전환됐던 발굴 재선택 가능, KPI-④ 대칭).
      qc.invalidateQueries({ queryKey: leadsPickerKey() });
    },
  });
}
