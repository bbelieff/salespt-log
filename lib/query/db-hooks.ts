/**
 * React Query 훅 — DB관리 탭 (PR 09 db-management).
 *
 * 4채널 raw log read/write. mutation은 stateless 패턴 (date/row를 args로).
 */
"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import type {
  DBBanner,
  DBLead,
  DBProduction,
  DBPurchase,
} from "@/types";
import type { DBOverview, LeadCandidate } from "@/service";
import { track, EVENTS } from "@/analytics";

export const dbKey = () => ["db"] as const;
/** 발굴 피커 후보 목록(matched 파생 포함) — DBOverview 와 별 쿼리(전환된 발굴 숨김용). */
export const leadsPickerKey = () => ["leads-picker"] as const;

async function fetchJSON<T>(input: string, init?: RequestInit): Promise<T> {
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

export function useDBOverview(): UseQueryResult<DBOverview> {
  return useQuery({
    queryKey: dbKey(),
    queryFn: () => fetchJSON<DBOverview>(`/api/db`),
    // 2026-06: 화면 전환 시 60s 내 재요청 억제 → 시트 read 폭주(429) 차단.
    // 뮤테이션은 invalidateQueries 로 즉시 재요청 → 신선도 보존.
    staleTime: 60_000,
    gcTime: 10 * 60_000, // BBE-242 처방4(2026-08-27) — contact-hooks.ts useDay 주석 참고.
  });
}

/**
 * 발굴 피커 후보 — `/api/leads`(listLeadCandidates). 각 항목에 `matched`(전환 여부) 파생 포함.
 * 피커가 `!matched` 로 필터해 이미 미팅으로 전환된 발굴을 숨긴다(lead-chain §4-1, KPI-④).
 * DBOverview 와 별 쿼리 — 미팅 생성(useAppendMeeting)·03 발굴 편집이 invalidate 해 신선도 보존.
 */
export function useLeadCandidates(): UseQueryResult<LeadCandidate[]> {
  return useQuery({
    queryKey: leadsPickerKey(),
    queryFn: async () =>
      (await fetchJSON<{ leads: LeadCandidate[] }>(`/api/leads`)).leads,
    staleTime: 60_000,
    gcTime: 10 * 60_000, // BBE-242 처방4(2026-08-27) — contact-hooks.ts useDay 주석 참고.
  });
}

// ── Channel 키 (URL encode 필요) ─────────────────────────────
export type DBChannel = "매입DB" | "직접생산" | "현수막" | "콜·지·기·소";

const enc = (ch: DBChannel) => encodeURIComponent(ch);

// ── 입력 타입 union ───────────────────────────────────────────
type DBRow = DBPurchase | DBProduction | DBBanner | DBLead;

interface AppendArgs {
  channel: DBChannel;
  data: DBRow;
}
interface PatchArgs {
  channel: DBChannel;
  row: number;
  data: DBRow;
}
interface RemoveArgs {
  channel: DBChannel;
  row: number;
}

export function useAppendDB() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ channel, data }: AppendArgs) =>
      fetchJSON<{ ok: true; row: number }>(`/api/db/${enc(channel)}`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_res, { channel }) => {
      track(EVENTS.DB_ROW_ADDED, { channel });
      qc.invalidateQueries({ queryKey: dbKey() });
      if (channel === "콜·지·기·소") qc.invalidateQueries({ queryKey: leadsPickerKey() });
    },
  });
}

export function usePatchDB() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ channel, row, data }: PatchArgs) =>
      fetchJSON<{ ok: true }>(`/api/db/${enc(channel)}/${row}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_res, { channel }) => {
      track(EVENTS.DB_ROW_UPDATED, { channel });
      qc.invalidateQueries({ queryKey: dbKey() });
      if (channel === "콜·지·기·소") qc.invalidateQueries({ queryKey: leadsPickerKey() });
    },
  });
}

export function useRemoveDB() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ channel, row }: RemoveArgs) =>
      fetchJSON<{ ok: true }>(`/api/db/${enc(channel)}/${row}`, {
        method: "DELETE",
      }),
    onSuccess: (_res, { channel }) => {
      track(EVENTS.DB_ROW_REMOVED, { channel });
      qc.invalidateQueries({ queryKey: dbKey() });
      if (channel === "콜·지·기·소") qc.invalidateQueries({ queryKey: leadsPickerKey() });
    },
  });
}
