/**
 * React Query 훅 — DB관리시트 목록 읽기(읽기 전용 관찰자).
 *
 * 캐시 키: ['db-sheet'] — DB관리시트 화면(use-db-sheet.ts)이 저장할 때마다 이 키를 무효화한다.
 * 쓰는 곳: 컨택 화면 ContactDbLeads, 대시보드 「오늘 챙길 일」(DashboardFollowUps).
 * 같은 키·같은 응답 모양({ leads })을 한 곳에서만 정의해 두 화면이 캐시를 그대로 나눠 쓴다.
 */
"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { DbSheetLead } from "@/types/db-sheet";

export const dbSheetKey = () => ["db-sheet"] as const;

export interface DbSheetLeadsResponse {
  leads: DbSheetLead[];
}

/** 서버 응답 문구와 HTTP 상태를 함께 들고 온다 — 「이 계정은 지원 안 함」과 일시 장애를 구분하려고. */
export class DbSheetLoadError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "DbSheetLoadError";
  }
}

/**
 * GET /api/db-sheet 가 503 으로 「이 계정은 DB관리시트를 쓸 수 없다」고 답한 경우.
 * lib/service/db-sheet.ts resolveDbSheetContext 의 DbSheetUnavailable 문구 2종과 짝이다
 * (tests/components/db-sheet-hooks.test.ts 가 두 문구가 여기에 걸리는지 지킨다).
 * 일시 장애(「저장소에 연결하지 못했습니다」)는 여기에 걸리지 않아 오류로 보인다.
 */
const UNSUPPORTED_MESSAGE = /지원하지 않습니다|연결을 확인할 수 없습니다/;
export function isDbSheetUnsupported(error: unknown): boolean {
  return error instanceof DbSheetLoadError && error.status === 503 && UNSUPPORTED_MESSAGE.test(error.message);
}

export async function fetchDbSheetLeads(): Promise<DbSheetLeadsResponse> {
  const response = await fetch("/api/db-sheet", { cache: "no-store" });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
      ? (payload as { error: string }).error
      : "DB 목록을 불러오지 못했습니다.";
    throw new DbSheetLoadError(message, response.status);
  }
  return payload as DbSheetLeadsResponse;
}

export interface DbSheetLeadsOptions {
  /** 대시보드처럼 다른 조회가 끝난 뒤에 읽을 때 false 로 늦춘다. */
  enabled?: boolean;
  /** 대시보드 관찰자는 5분 — 저장 시 무효화로만 갱신한다. 생략하면 QueryClient 기본값. */
  staleTime?: number;
  /** true 면 전역 로딩 오버레이 집계에서 뺀다(LoadingProvider meta.background) — 카드 자체 스켈레톤을 쓴다. */
  background?: boolean;
}

export function useDbSheetLeads(opts: DbSheetLeadsOptions = {}): UseQueryResult<DbSheetLeadsResponse> {
  return useQuery({
    queryKey: dbSheetKey(),
    queryFn: fetchDbSheetLeads,
    retry: false,
    gcTime: 10 * 60_000,
    // 값이 없을 때는 키 자체를 넣지 않는다 — undefined 를 넘기면 QueryClient 기본 staleTime 을 덮어쓴다.
    ...(opts.enabled === undefined ? {} : { enabled: opts.enabled }),
    ...(opts.staleTime === undefined ? {} : { staleTime: opts.staleTime }),
    ...(opts.background ? { meta: { background: true } } : {}),
  });
}
