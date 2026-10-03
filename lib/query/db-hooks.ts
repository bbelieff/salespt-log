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
export function useLeadCandidates(
  /** 컨택탭이 콜지기소 패널일 때만 켠다 — 다른 채널을 보는 동안 불필요한 요청 0 (2026-09-02). */
  enabled = true,
): UseQueryResult<LeadCandidate[]> {
  return useQuery({
    enabled,
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
  /** Scope B autosave operation identity — server replays instead of duplicating. */
  idempotencyKey?: string;
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

/**
 * Same-key/different-payload conflict — the server kept the FIRST commit and
 * tells us its physical row so the client PATCHes it instead of appending.
 * Never a second row: the error carries where the original lives.
 */
export class DbCreateConflictError extends Error {
  readonly row: number | null;
  constructor(row: number | null) {
    super("db_idempotency_conflict");
    this.name = "DbCreateConflictError";
    this.row = row;
  }
}

/** Extract the conflicted original row from any thrown creation error. */
export function dbConflictRowOf(error: unknown): number | null {
  if (error instanceof DbCreateConflictError) return error.row;
  if (
    error instanceof Error &&
    error.message === "db_idempotency_conflict" &&
    typeof (error as unknown as { row?: unknown }).row === "number"
  ) {
    return (error as unknown as { row: number }).row;
  }
  return null;
}

export function useAppendDB() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ channel, data, idempotencyKey }: AppendArgs) => {
      const res = await fetch(`/api/db/${enc(channel)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
        },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409 && body?.error === "db_idempotency_conflict") {
        throw new DbCreateConflictError(
          typeof body?.row === "number" ? body.row : null,
        );
      }
      if (!res.ok) {
        throw new Error(
          typeof body?.error === "string" ? body.error : `HTTP ${res.status}`,
        );
      }
      return body as { ok: true; row: number; idempotent: boolean; replayed: boolean };
    },
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
