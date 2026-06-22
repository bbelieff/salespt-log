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
  DBBannerPost,
  DBLead,
  DBProduction,
  DBPurchase,
} from "@/types";
import type { DBOverview } from "@/service";
import { track, EVENTS } from "@/analytics";

export const dbKey = () => ["db"] as const;

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
    },
  });
}

// ── 현수막 게시 로그(1:N) append/remove (ADR-0023) ────────────
export function useAppendBannerPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: DBBannerPost) =>
      fetchJSON<{ ok: true; row: number }>(`/api/db/banner-post`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      track(EVENTS.DB_ROW_ADDED, { channel: "현수막게시" });
      qc.invalidateQueries({ queryKey: dbKey() });
    },
  });
}

export function useRemoveBannerPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (row: number) =>
      fetchJSON<{ ok: true }>(`/api/db/banner-post/${row}`, { method: "DELETE" }),
    onSuccess: () => {
      track(EVENTS.DB_ROW_REMOVED, { channel: "현수막게시" });
      qc.invalidateQueries({ queryKey: dbKey() });
    },
  });
}
